/* ============================================================
   notify-bell.js — جرس إشعارات يُحقن في أي صفحة تحتوي .header-actions
   يُحمَّل تلقائياً عبر main.js (import ديناميكي) — بدون تعديل HTML
   ============================================================ */

import { db } from './firebase-config.js';
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { waitForAuth } from './auth.js';

if (!window.__afaBell) {
  window.__afaBell = true;

  const user = await waitForAuth();
  if (user) {
    const actions = document.querySelector('.header-actions');
    if (actions) {
      /* بناء الزر */
      const bell = document.createElement('a');
      bell.className = 'notif-bell';
      bell.href = '/notifications.html';
      bell.setAttribute('aria-label', 'الإشعارات');
      bell.title = 'الإشعارات';
      bell.innerHTML =
        `<svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-bell"></use></svg>` +
        `<span class="notif-badge" hidden></span>`;

      /* الموضع: قبل زر القائمة الجوالة إن وُجد، وإلا في النهاية */
      const anchor = actions.querySelector('#menuToggle');
      actions.insertBefore(bell, anchor || null);

      const badge = bell.querySelector('.notif-badge');

      /* عدّاد حي — استعلام بحقل واحد فقط (بلا Composite Index) */
      onSnapshot(
        query(collection(db, 'notifications'), where('uid', '==', user.uid)),
        (snap) => {
          const unread = snap.docs.filter((d) => !d.data().readAt).length;
          badge.hidden = unread === 0;
          badge.textContent = unread > 9 ? '+9' : unread;
          bell.setAttribute('aria-label', unread ? `${unread} إشعار غير مقروء` : 'الإشعارات');
        },
        (err) => console.warn('bell:', err.code)
      );
    }
  }
}
