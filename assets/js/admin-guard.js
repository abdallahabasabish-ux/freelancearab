/* ============================================================
   admin-guard.js — حماية صفحات الإدارة
   requireAuth → التحقق من admins/{uid} → رفض أنيق إن لم يكن مديراً
   ============================================================ */

import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAuth, initHeaderAuth } from './auth.js';

export async function requireAdmin() {
  const ctx = await requireAuth({ allowIncomplete: true }); /* المصادقة والبريد مطلوبان، لا يلزم ملف طالب للمدير */
  if (!ctx) return null;

  let isAdmin = false;
  try {
    isAdmin = (await getDoc(doc(db, 'admins', ctx.user.uid))).exists();
  } catch (err) {
    console.error('تعذر التحقق من صلاحية المدير:', err);
  }

  if (!isAdmin) {
    const sk = document.getElementById('adminSkeleton');
    const denied = document.getElementById('deniedState');
    if (sk) sk.hidden = true;
    if (denied) denied.hidden = false;
    return null;
  }

  initHeaderAuth(ctx); /* يربط زر تسجيل الخروج */
  return ctx;
}
