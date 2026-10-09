/* ============================================================
   certificates.js — صفحة شهادات الطالب
   تحميل → إرسال إيميل الشهادات الجديدة (EmailJS) → عرض ومشاركة
   ============================================================ */

import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAuth, initHeaderAuth } from './auth.js';
import { ensureCertificatesEmails } from './emailjs.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);

const VERIFY_URL = 'https://courses.freelancearab.com/verify.html';

const ctx = await requireAuth();
if (ctx) main(ctx);

async function main({ user, profile }) {
  initHeaderAuth({ user, profile });

  let certs = [];
  try {
    /* uid + status معاً → مطلوب لمطابقة قواعد الأمان (Index مركّب — انظر التعليمات) */
    const snap = await getDocs(query(
      collection(db, 'certificates'),
      where('uid', '==', user.uid),
      where('status', '==', 'active')
    ));
    certs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.issuedAt?.seconds ?? 0) - (a.issuedAt?.seconds ?? 0));
  } catch (err) {
    console.error(err);
    if (err.code === 'failed-precondition') {
      $('#certErrorTitle').textContent = 'إعداد لمرة واحدة مطلوب';
      $('#certErrorText').textContent =
        'يجب إنشاء "فهرس مركّب" في Firestore: افتح Firebase Console → Firestore → Indexes → Create Index، الحقول: uid تصاعدي + status تصاعدي، النطاق: Collection، اسم المجموعة: certificates.';
    }
    $('#certsError').hidden = false;
    return;
  }

  if (!certs.length) { $('#certsEmpty').hidden = false; return; }

  /* 📧 الإيميل التلقائي: للشهادات التي لم تُرسل رسالتها بعد */
  const sentCount = await ensureCertificatesEmails({ user, profile, certs });
  if (sentCount > 0) {
    toast(`📩 أرسلنا تأكيد الإصدار إلى بريدك (${sentCount} رسالة)`, 'success', 5000);
  }

  certs.forEach((c) => $('#certsGrid').appendChild(renderCert(c)));
}

/* ---------- بطاقة شهادة ---------- */
function renderCert(cert) {
  const code = cert.id; /* معرف المستند = كود التحقق */
  const date = cert.issuedAt?.seconds
    ? new Date(cert.issuedAt.seconds * 1000).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  const verifyLink = `${VERIFY_URL}?code=${encodeURIComponent(code)}`;

  const el = document.createElement('article');
  el.className = 'cert-card card';

  el.innerHTML = `
    <div class="cert-top">
      <span class="cert-ribbon">
        <svg class="icon icon-lg" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-award"></use></svg>
      </span>
      <p class="cert-label">شهادة إتمام</p>
      <h2 class="cert-course">${escapeHtml(cert.courseTitle || 'كورس')}</h2>
      <p class="cert-owner">تُمنح إلى: ${escapeHtml(cert.studentName || '')}</p>
    </div>
    <div class="cert-body">
      <div class="cert-code-box">
        <span class="code" title="كود التحقق">${escapeHtml(code)}</span>
        <button type="button" class="copy-code" data-copy="${escapeHtml(code)}" aria-label="نسخ الكود">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-file"></use></svg>
        </button>
      </div>
      <p class="cert-date">
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-calendar"></use></svg>
        صدرت في ${escapeHtml(date)}
      </p>
      <div class="cert-actions">
        <a class="btn btn-primary btn-sm btn-pdf" href="${escapeHtml(cert.pdfURL || '#')}"
           target="_blank" rel="noopener noreferrer" ${cert.pdfURL ? '' : 'aria-disabled="true"'}>
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-download"></use></svg>
          عرض / تحميل PDF
        </a>
        <button type="button" class="btn btn-accent btn-sm" data-linkedin="${encodeURIComponent(verifyLink)}">
          <svg class="icon icon-fill" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-linkedin"></use></svg>
          مشاركة على LinkedIn
        </button>
        <button type="button" class="btn btn-outline btn-sm" data-verify="${encodeURIComponent(verifyLink)}">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-shield-check"></use></svg>
          رابط التحقق
        </button>
      </div>
    </div>`;

  /* نسخ الكود */
  el.querySelector('.copy-code').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(e.currentTarget.dataset.copy);
      toast('تم نسخ كود التحقق.', 'success');
    } catch { toast('تعذر النسخ.', 'warning'); }
  });

  /* مشاركة LinkedIn (أو Web Share على الجوال) */
  el.querySelector('[data-linkedin]').addEventListener('click', async (e) => {
    const url = decodeURIComponent(e.currentTarget.dataset.linkedin);
    const text = `حصلت على شهادة إتمام "${cert.courseTitle}" من أكاديمية عرب فريلانسر 🎓 — تحقق منها هنا:`;
    if (navigator.share) {
      try { await navigator.share({ title: 'شهادتي', text, url }); return; } catch { /* ألغى المستخدم */ }
    }
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  });

  /* رابط التحقق: نسخ */
  el.querySelector('[data-verify]').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(decodeURIComponent(e.currentTarget.dataset.verify));
      toast('تم نسخ رابط التحقق — شاركه مع أي جهة توظيف.', 'success');
    } catch { toast('تعذر النسخ.', 'warning'); }
  });

  return el;
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
