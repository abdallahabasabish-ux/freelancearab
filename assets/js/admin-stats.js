/* ============================================================
   admin-stats.js — إحصائيات نظرة عامة
   4 قراءات مجموعات واحدة (زيارات الإدارة نادرة — ضمن الحصة)
   ============================================================ */

import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAdmin } from './admin-guard.js';

const ctx = await requireAdmin();
if (ctx) main();

async function main() {
  const [usersSnap, coursesSnap, certsSnap, progressSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'courses')),
    getDocs(query(collection(db, 'certificates'), where('status', '==', 'active'))),
    getDocs(collection(db, 'progress')).catch(() => ({ docs: [] }))
  ]);

  document.getElementById('stStudents').textContent = usersSnap.docs.length;
  document.getElementById('stCourses').textContent  = coursesSnap.docs.length;
  document.getElementById('stCerts').textContent    = certsSnap.docs.length;

  /* الطلاب النشطون: مستخدمون لهم نشاط تقدم خلال 30 يوماً */
  const cutoff = Date.now() / 1000 - 30 * 86400;
  const activeUids = new Set(
    progressSnap.docs
      .filter((d) => (d.data().updatedAt?.seconds ?? 0) >= cutoff)
      .map((d) => d.data().uid)
  );
  document.getElementById('stActive').textContent = activeUids.size;

  /* أحدث 5 شهادات */
  const recent = certsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.issuedAt?.seconds ?? 0) - (a.issuedAt?.seconds ?? 0))
    .slice(0, 5);

  const wrap = document.getElementById('recentCerts');
  document.getElementById('noCerts').hidden = recent.length > 0;

  wrap.innerHTML = recent.map((c) => {
    const date = c.issuedAt?.seconds
      ? new Date(c.issuedAt.seconds * 1000).toLocaleDateString('ar-EG')
      : '—';
    return `
    <div class="row-card card">
      <div class="row-main">
        <span class="row-title">${esc(c.studentName || '—')}</span>
        <span class="badge badge-success">${esc(c.courseTitle || '—')}</span>
      </div>
      <div class="row-meta">
        <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-file"></use></svg>${esc(c.id)}</span>
        <span><svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-calendar"></use></svg>${esc(date)}</span>
      </div>
      <div class="row-actions">
        <a class="btn btn-outline btn-sm" href="/verify.html?code=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-eye"></use></svg>
          صفحة التحقق
        </a>
      </div>
    </div>`;
  }).join('');

  document.getElementById('adminSkeleton').hidden = true;
  document.getElementById('adminContent').hidden = false;
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
