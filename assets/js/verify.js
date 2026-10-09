/* ============================================================
   verify.js — صفحة التحقق العامة (بدون مصادقة)
   معرّف مستند الشهادة = الكود نفسه → قراءة واحدة مباشرة
   ============================================================ */

import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const result = $('#verifyResult');
const input  = $('#codeInput');
const btn    = $('#verifyBtn');

/* دعم الرابط المباشر: verify.html?code=XXX (للـ QR ومشاركة LinkedIn) */
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) {
  input.value = urlCode;
  doVerify(urlCode);
}

 $('#verifyForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = input.value.trim().toUpperCase();
  if (!code) return;
  doVerify(code);
});

async function doVerify(code) {
  setLoading(true);
  result.innerHTML = '';

  let cert = null;
  try {
    /* قراءة واحدة مباشرة — القواعد تسمح فقط للشهادات النشطة */
    const snap = await getDoc(doc(db, 'certificates', code));
    if (snap.exists()) cert = snap.data();
  } catch (err) {
    /* permission-denied = الشهادة موجودة لكنها ملغاة/غير نشطة */
    if (err.code === 'permission-denied') cert = { revoked: true };
  }

  setLoading(false);

  if (!cert) return renderInvalid('not-found');
  if (cert.revoked) return renderInvalid('revoked');
  renderValid(code, cert);
}

/* ---------- النتيجة: صالحة ---------- */
function renderValid(code, cert) {
  const date = cert.issuedAt?.seconds
    ? new Date(cert.issuedAt.seconds * 1000).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  result.innerHTML = `
    <div class="vr-card vr-valid">
      <div class="vr-icon">
        <svg class="icon icon-lg" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-check"></use></svg>
      </div>
      <h2 class="vr-title">شهادة صالحة وموثقة ✓</h2>
      <p class="vr-sub">هذه البيانات مسجلة رسمياً في أكاديمية عرب فريلانسر.</p>
      <ul class="vr-details">
        <li><span class="k">الحاصل على الشهادة</span><span class="v">${esc(cert.studentName || '—')}</span></li>
        <li><span class="k">الكورس</span><span class="v">${esc(cert.courseTitle || '—')}</span></li>
        <li><span class="k">تاريخ الإصدار</span><span class="v">${esc(date)}</span></li>
        <li><span class="k">كود التحقق</span><span class="v mono">${esc(code)}</span></li>
      </ul>
      <div class="vr-actions">
        ${cert.pdfURL ? `<a class="btn btn-outline btn-sm" href="${esc(cert.pdfURL)}" target="_blank" rel="noopener noreferrer">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-eye"></use></svg>
          استعراض الشهادة PDF
        </a>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" id="copySummary">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-file"></use></svg>
          نسخ ملخص التحقق
        </button>
      </div>
    </div>`;

  $('#copySummary').addEventListener('click', async () => {
    const txt = `نتيجة التحقق من أكاديمية عرب فريلانسر — الاسم: ${cert.studentName} | الكورس: ${cert.courseTitle} | الكود: ${code} | الحالة: صالحة`;
    try { await navigator.clipboard.writeText(txt); toastMsg('تم نسخ ملخص التحقق.', 'success'); }
    catch { toastMsg('تعذر النسخ.', 'warning'); }
  });
}

/* ---------- النتيجة: غير صالحة ---------- */
function renderInvalid(kind) {
  const cfg = kind === 'revoked'
    ? { title: 'الشهادة ملغاة', sub: 'هذا الكود مسجل لدينا لكن الشهادة أُلغيت من الإدارة — لا تعتبر صالحة.' }
    : { title: 'الشهادة غير موجودة', sub: 'تأكد من كتابة الكود كما هو تماماً (أحرف كبيرة وشرطات). إذا استمرت المشكلة فالشهادة غير صادرة من أكاديميتنا.' };

  result.innerHTML = `
    <div class="vr-card vr-invalid">
      <div class="vr-icon">
        <svg class="icon icon-lg" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-x"></use></svg>
      </div>
      <h2 class="vr-title">${cfg.title}</h2>
      <p class="vr-sub">${cfg.sub}</p>
    </div>`;
}

/* ---------- أدوات ---------- */
function setLoading(on) {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}
function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toastMsg(m, t) { window.AFA?.toast(m, t); }
