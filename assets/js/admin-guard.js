/* ============================================================
   admin-guard.js — حماية صفحات الإدارة
   requireAuth → التحقق من admins/{uid} → رفض أنيق إن لم يكن مديراً
   ============================================================ */

import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAuth, initHeaderAuth } from './auth.js';

const ADMIN_UID = 'NOZnMklGITWjF3ei05nxIcCyQs43';

export async function requireAdmin() {
  const ctx = await requireAuth({ allowIncomplete: true }); /* المصادقة والبريد مطلوبان، لا يلزم ملف طالب للمدير */
  if (!ctx) return null;

  let isAdmin = ctx.user.uid === ADMIN_UID;
  let adminCheckError = null;
  if (!isAdmin) {
    try {
      isAdmin = (await getDoc(doc(db, 'admins', ctx.user.uid))).exists();
    } catch (err) {
      adminCheckError = err;
      console.error('تعذر التحقق من صلاحية المدير:', err);
    }
  }

  if (!isAdmin) {
    const sk = document.getElementById('adminSkeleton');
    const denied = document.getElementById('deniedState');
    const diagnostic = document.getElementById('adminDeniedDetails');
    if (sk) sk.hidden = true;
    if (denied) denied.hidden = false;
    if (diagnostic) {
      diagnostic.textContent = adminCheckError
        ? `تعذر قراءة مستند الإدارة (${adminCheckError.code || 'خطأ اتصال'}). UID الحالي: ${ctx.user.uid}`
        : `لم يُعثر على مستند admins/${ctx.user.uid} في مشروع freelance-arab.`;
    }
    return null;
  }

  initHeaderAuth(ctx); /* يربط زر تسجيل الخروج */
  return ctx;
}
