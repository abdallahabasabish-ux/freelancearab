/* ============================================================
   notifications.js — الإشعارات الداخلية (تحديث حي onSnapshot)
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAuth, initHeaderAuth } from './auth.js';
import { safeLinkUrl } from './courses-data.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);

const ctx = await requireAuth();
if (ctx) main(ctx);

const TYPE_ICONS = {
  certificate: 'i-award',
  course:      'i-book-open',
  system:      'i-bell'
};

function main({ user, profile }) {
  initHeaderAuth({ user, profile });

  let latest = [];

  onSnapshot(
    query(collection(db, 'notifications'), where('uid', '==', user.uid)),
    (snap) => {
      latest = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

      render();
    },
    (err) => { console.error(err); toast('تعذر تحميل الإشعارات.', 'error'); }
  );

  function render() {
    const list = $('#notifList');
    const unread = latest.filter((n) => !n.readAt).length;

    $('#notifEmpty').hidden = latest.length > 0;
    $('#notifCount').textContent = latest.length
      ? (unread ? `لديك ${unread} إشعار غير مقروء` : 'كل الإشعارات مقروءة ✓')
      : '';
    $('#markAllBtn').hidden = unread === 0;

    list.innerHTML = latest.map((n) => {
      const icon = TYPE_ICONS[n.type] || 'i-bell';
      const time = n.createdAt?.seconds ? timeAgo(n.createdAt.seconds) : '';
      const link = safeLinkUrl(n.link || '', '');
      return `
      <div class="notif-item ${n.readAt ? '' : 'unread'}" data-id="${n.id}" data-link="${esc(link)}" role="button" tabindex="0">
        <span class="notif-ico ${esc(n.type || 'system')}">
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#${icon}"></use></svg>
        </span>
        <div class="notif-body">
          <p class="notif-title">${esc(n.title || 'إشعار')}</p>
          ${n.body ? `<p class="notif-text">${esc(n.body)}</p>` : ''}
          ${time ? `<p class="notif-time">${time}</p>` : ''}
        </div>
        <svg class="icon notif-arrow" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-arrow-left"></use></svg>
      </div>`;
    }).join('');
  }

  /* فتح إشعار: تعليم كمقروء + تنقل إن وُجد رابط */
  $('#notifList').addEventListener('click', async (e) => {
    const item = e.target.closest('.notif-item');
    if (!item) return;
    const { id, link } = item.dataset;
    try { await updateDoc(doc(db, 'notifications', id), { readAt: serverTimestamp() }); } catch { /* تجاهل */ }
    const safeUrl = safeLinkUrl(link || '', '');
    if (safeUrl) location.href = safeUrl;
  });

  /* تعليم الكل كمقروء (Batch ذرّي) */
  $('#markAllBtn').addEventListener('click', async () => {
    const unread = latest.filter((n) => !n.readAt);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { readAt: serverTimestamp() }));
      await batch.commit();
      toast('تم تعليم كل الإشعارات كمقروءة.', 'success');
    } catch { toast('تعذر تنفيذ العملية.', 'error'); }
  });
}

/* ---------- وقت نسبي بالعربية ---------- */
function timeAgo(ts) {
  const s = Date.now() / 1000 - ts;
  if (s < 60)   return 'الآن';
  if (s < 3600) return `منذ ${Math.floor(s / 60)} دقيقة`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} ساعة`;
  if (s < 2592000) return `منذ ${Math.floor(s / 86400)} يوم`;
  return new Date(ts * 1000).toLocaleDateString('ar-EG');
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
