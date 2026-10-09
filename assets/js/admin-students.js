/* ============================================================
   admin-students.js — الطلاب + الشهادات + الإشعارات + CSV
   التحميل: users + progress (قراءتان) → كل الفلترة محلياً
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, getDocs, getDoc, doc, setDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAdmin } from './admin-guard.js';
import { normalizeAr } from './courses-data.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let students = [];
let progressByUid = new Map();
let certTarget = null;   /* الطالب المستهدف في نافذة الشهادة */
let notifTarget = null;  /* الطالب المستهدف في نافذة الإشعار */

const ctx = await requireAdmin();
if (ctx) main();

async function main() {
  bindModals();
  bindEvents();
  await loadData();
  document.getElementById('adminSkeleton').hidden = true;
  document.getElementById('adminContent').hidden = false;
}

async function loadData() {
  try {
    const [usersSnap, progressSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'progress')).catch(() => ({ docs: [] }))
    ]);

    students = usersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

    /* تجميع تقدم كل طالب: عدد الكورسات + الدروس المكتملة */
    progressByUid = new Map();
    progressSnap.docs.forEach((d) => {
      const p = d.data();
      if (!p.uid) return;
      const cur = progressByUid.get(p.uid) || { courses: 0, lessons: 0 };
      cur.courses += 1;
      cur.lessons += (p.completedLessons?.length || 0);
      progressByUid.set(p.uid, cur);
    });

    renderList();
  } catch (err) {
    console.error(err);
    toast('تعذر تحميل بيانات الطلاب.', 'error');
  }
}

/* ==================== القائمة ==================== */
function renderList() {
  const q = normalizeAr($('#searchInput').value);
  const list = q
    ? students.filter((s) =>
        normalizeAr(`${s.fullName || ''} ${s.email || ''} ${s.phone || ''}`).includes(q))
    : students;

  $('#studentsEmpty').hidden = students.length > 0;

  $('#studentsList').innerHTML = list.map((s) => {
    const prog = progressByUid.get(s.id) || { courses: 0, lessons: 0 };
    const avatar = s.photoBase64 || s.photoURL || '/assets/icons/icon.svg';
    const joined = s.createdAt?.seconds
      ? new Date(s.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '—';
    const loc = [s.location?.city, s.location?.country].filter(Boolean).join('، ') || '—';
    return `
    <div class="row-card card">
      <img class="row-avatar" src="${esc(avatar)}" alt="" loading="lazy"
           onerror="this.src='/assets/icons/icon.svg'">
      <div class="row-main">
        <span class="row-title">${esc(s.fullName || 'بدون اسم')}</span>
        ${s.profileCompleted ? '' : '<span class="badge badge-warning">ملف غير مكتمل</span>'}
      </div>
      <div class="row-meta">
        <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-mail"></use></svg>${esc(s.email || '—')}</span>
        <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-phone"></use></svg><span dir="ltr">${esc(s.fullPhone || '—')}</span></span>
        <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-calendar"></use></svg>السن: ${esc(String(s.age || '—'))}</span>
        <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-map-pin"></use></svg>${esc(loc)}</span>
        <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-star"></use></svg>${Number(s.points || 0)} نقطة</span>
        <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-book-open"></use></svg>${prog.courses} كورسات / ${prog.lessons} دروس</span>
        <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-clock"></use></svg>انضم: ${esc(joined)}</span>
      </div>
      <div class="row-actions">
        <button type="button" class="btn btn-accent btn-sm" data-cert="${s.id}">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-award"></use></svg>
          إصدار شهادة
        </button>
        <button type="button" class="btn btn-outline btn-sm" data-notif="${s.id}">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-bell"></use></svg>
          إشعار
        </button>
      </div>
    </div>`;
  }).join('');
}

function bindEvents() {
  $('#searchInput').addEventListener('input', renderList);

  $('#studentsList').addEventListener('click', (e) => {
    const c = e.target.closest('[data-cert]');
    const n = e.target.closest('[data-notif]');
    if (c) openCertModal(c.dataset.cert);
    if (n) openNotifModal(n.dataset.notif);
  });

  $('#exportBtn').addEventListener('click', exportCSV);
}

/* ==================== إصدار الشهادة ==================== */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* بدون أحرف ملتبسة */
function genCode() {
  const seg = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  return `AFA-${seg(6)}-${seg(4)}`;
}

function openCertModal(uid) {
  const s = students.find((x) => x.id === uid);
  if (!s) return;
  certTarget = s;
  $('#certName').value = s.fullName || '';
  $('#certCourse').value = '';
  $('#certPdf').value = '';
  $('#certCode').value = genCode();
  $('#certNotify').checked = true;
  openModal('#certModal');
}

 $('#regenCode')?.addEventListener('click', () => { $('#certCode').value = genCode(); });

async function submitCert(e) {
  e.preventDefault();
  const studentName = $('#certName').value.trim();
  const courseTitle = $('#certCourse').value.trim();
  const pdfURL = $('#certPdf').value.trim();
  const code = $('#certCode').value.trim().toUpperCase();

  if (!studentName || !courseTitle) return toast('الاسم واسم الكورس مطلوبان.', 'warning');
  if (!code) return toast('أدخل كود التحقق.', 'warning');

  const btn = $('#certSubmit');
  btn.classList.add('loading');

  try {
    /* منع تكرار الكود */
    const exists = await getDoc(doc(db, 'certificates', code));
    if (exists.exists()) {
      btn.classList.remove('loading');
      return toast('هذا الكود مستخدم من قبل — اضغط زر التحديث لتوليد كود جديد.', 'error');
    }

    await setDoc(doc(db, 'certificates', code), {
      uid: certTarget.id,
      studentName,
      courseTitle,
      pdfURL,
      status: 'active',
      issuedAt: serverTimestamp()
    });

    /* إشعار تلقائي للطالب */
    if ($('#certNotify').checked) {
      await addDoc(collection(db, 'notifications'), {
        uid: certTarget.id,
        type: 'certificate',
        title: '🎓 شهادتك جاهزة!',
        body: `تم إصدار شهادتك لكورس "${courseTitle}" — تفقدية من صفحة شهاداتي.`,
        link: '/certificates.html',
        createdAt: serverTimestamp()
      });
    }

    toast(`تم إصدار الشهادة بنجاح — الكود: ${code}`, 'success', 6000);
    closeModals();
  } catch (err) {
    console.error(err);
    toast('تعذر إصدار الشهادة.', 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

/* ==================== إشعار يدوي ==================== */
function openNotifModal(uid) {
  const s = students.find((x) => x.id === uid);
  if (!s) return;
  notifTarget = s;
  $('#notifType').value = 'course';
  $('#notifTitle').value = '';
  $('#notifBody').value = '';
  $('#notifLink').value = '';
  openModal('#notifModal');
}

async function submitNotif(e) {
  e.preventDefault();
  const title = $('#notifTitle').value.trim();
  if (!title) return toast('عنوان الإشعار مطلوب.', 'warning');

  const btn = $('#notifSubmit');
  btn.classList.add('loading');
  try {
    await addDoc(collection(db, 'notifications'), {
      uid: notifTarget.id,
      type: $('#notifType').value,
      title,
      body: $('#notifBody').value.trim(),
      link: $('#notifLink').value.trim(),
      createdAt: serverTimestamp()
    });
    toast('تم إرسال الإشعار — سيظهر للطالب فوراً.', 'success');
    closeModals();
  } catch (err) {
    console.error(err);
    toast('تعذر إرسال الإشعار.', 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

/* ==================== النوافذ ==================== */
function openModal(sel) { $(sel).classList.add('open'); }
function closeModals() {
  document.querySelectorAll('.modal-overlay.open').forEach((m) => m.classList.remove('open'));
}
function bindModals() {
  document.querySelectorAll('.modal-overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => { if (e.target === ov) closeModals(); });
    ov.querySelectorAll('[data-close-modal]').forEach((b) =>
      b.addEventListener('click', closeModals));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
  $('#certForm').addEventListener('submit', submitCert);
  $('#notifForm').addEventListener('submit', submitNotif);
}

/* ==================== تصدير CSV (يفتح في Excel) ==================== */
function exportCSV() {
  if (!students.length) return toast('لا توجد بيانات للتصدير.', 'warning');

  const headers = [
    'الاسم الثلاثي', 'البريد الإلكتروني', 'الهاتف', 'السن',
    'المدينة', 'الدولة', 'النقاط', 'عدد الكورسات', 'الدروس المكتملة',
    'الملف مكتمل', 'تاريخ التسجيل', 'آخر دخول'
  ];
  const fmt = (ts) => ts?.seconds ? new Date(ts.seconds * 1000).toLocaleDateString('ar-EG') : '';

  const rows = students.map((s) => {
    const p = progressByUid.get(s.id) || { courses: 0, lessons: 0 };
    return [
      s.fullName || '', s.email || '', s.fullPhone || s.phone || '', s.age || '',
      s.location?.city || '', s.location?.country || '',
      Number(s.points || 0), p.courses, p.lessons,
      s.profileCompleted ? 'نعم' : 'لا', fmt(s.createdAt), fmt(s.lastLoginAt)
    ];
  });

  /* BOM لدعم العربية في Excel + تهريب علامات الاقتباس */
  const csv = '\uFEFF' + [headers, ...rows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`تم تصدير ${students.length} طالباً إلى ملف CSV.`, 'success');
}
