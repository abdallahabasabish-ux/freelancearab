/* ============================================================
   auth.js — خدمة المصادقة المركزية
   - أدوات مشتركة: انتظار المصادقة، ترجمة الأخطاء، الجلسة الواحدة
   - حماية الصفحات: requireAuth
   - واجهة الهيدر: initHeaderAuth + تسجيل الخروج
   ============================================================ */

import { auth, db, googleProvider } from './assets/js/firebase-config.js';
import {
  onAuthStateChanged, signOut, signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- مفاتيح الجلسة ---------- */
const SESSION_KEY = 'afa-session';

export const getSessionId    = () => localStorage.getItem(SESSION_KEY);
export const endSessionLocal = () => localStorage.removeItem(SESSION_KEY);

/* ---------- انتظار جاهزية حالة المصادقة ---------- */
export function waitForAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user); });
  });
}

/* ---------- ترجمة أخطاء Firebase إلى العربية ---------- */
const AUTH_ERRORS = {
  'auth/email-already-in-use':     'هذا البريد الإلكتروني مسجل لدينا بالفعل.',
  'auth/invalid-email':            'صيغة البريد الإلكتروني غير صحيحة.',
  'auth/weak-password':            'كلمة المرور ضعيفة — استخدم 6 أحرف على الأقل.',
  'auth/missing-password':         'أدخل كلمة المرور.',
  'auth/invalid-credential':       'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth/user-not-found':           'لا يوجد حساب بهذا البريد الإلكتروني.',
  'auth/wrong-password':           'كلمة المرور غير صحيحة.',
  'auth/too-many-requests':        'محاولات كثيرة جداً — انتظر قليلاً ثم أعد المحاولة.',
  'auth/popup-closed-by-user':     'تم إغلاق نافذة Google قبل إكمال الدخول.',
  'auth/cancelled-popup-request':  'تم إلغاء طلب الدخول السابق.',
  'auth/popup-blocked':            'المتصفح منع النافذة المنبثقة — اسمح بها وأعد المحاولة.',
  'auth/network-request-failed':   'تعذر الاتصال بالخادم — تحقق من الإنترنت.',
  'auth/operation-not-allowed':    'طريقة الدخول غير مفعّلة في إعدادات Firebase.',
  'auth/unauthorized-domain':      'هذا النطاق غير مصرح به في إعدادات Firebase Authentication.'
};
export const authErrorAr = (code) => AUTH_ERRORS[code] || 'حدث خطأ غير متوقع — حاول مجدداً.';

/* ============================================================
   الجلسة الواحدة (منع مشاركة الحساب)
   عند كل دخول: يُولَّد Session ID جديد ويُحفظ محلياً وفي
   users/{uid}.activeSession — أي جهاز آخر يُطرد تلقائياً.
   ============================================================ */
export async function startSession(user) {
  const sessionId = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, sessionId);
  try {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      activeSession: sessionId,
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch { /* سيتم التصحيح عند أول مزامنة */ }
  return sessionId;
}

export async function getProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function validateSession(user) {
  const profile = await getProfile(user.uid);
  const stored  = profile?.activeSession;
  const local   = getSessionId();
  if (stored && stored !== local) return { ok: false, profile };
  return { ok: true, profile };
}

/* ---------- تسجيل الخروج ---------- */
export async function logout() {
  endSessionLocal();
  try { await signOut(auth); } catch { /* تجاهل */ }
  location.replace('/');
}

export function bindLogout() {
  document.querySelectorAll('[data-logout]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', logout);
  });
}

/* ============================================================
   حماية الصفحات
   التسلسل: مسجّل؟ → بريد مُتحقق؟ → جلسة صالحة؟ → ملف مكتمل؟
   ============================================================ */
export async function requireAuth({ allowIncomplete = false } = {}) {
  const user = await waitForAuth();
  if (!user) { location.replace('/login.html'); return null; }

  if (!user.emailVerified) { location.replace('/login.html?state=verify'); return null; }

  const { ok, profile } = await validateSession(user);
  if (!ok) { location.replace('/login.html?state=session'); return null; }

  if (!profile?.profileCompleted && !allowIncomplete) {
    location.replace('/profile.html');
    return null;
  }
  return { user, profile };
}

/* توجيه المستخدم المسجّل للوجهة الصحيحة (يُستخدم في login/register) */
export async function routeAuthedUser(user) {
  const profile = await getProfile(user.uid);
  location.replace(profile?.profileCompleted ? '/dashboard.html' : '/profile.html');
}

/* بوابة صفحات الدخول: 'guest' | 'verify' | 'redirected' */
export async function initAuthGate() {
  const user = await waitForAuth();
  if (!user) return 'guest';
  if (!user.emailVerified) return 'verify';
  await routeAuthedUser(user);
  return 'redirected';
}

/* ---------- الدخول بـ Google (ينشئ/يحدّث مستند المستخدم) ---------- */
export async function loginWithGoogle() {
  const { user } = await signInWithPopup(auth, googleProvider);
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    fullName: user.displayName || '',
    photoURL: user.photoURL || null,
    provider: 'google',
    emailVerified: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
  await startSession(user);
  return user;
}

/* ============================================================
   واجهة الهيدر: إظهار عناصر الزائر/المستخدم
   يمكن تمرير { user, profile } لتوفير قراءة Firestore
   ============================================================ */
export async function initHeaderAuth(pre = {}) {
  const user = pre.user || (await waitForAuth());
  const guestEls = document.querySelectorAll('[data-auth-guest]');
  const chip = document.querySelector('[data-auth-user]');

  if (user) {
    guestEls.forEach((el) => (el.hidden = true));
    if (chip) {
      chip.hidden = false;
      const profile = pre.profile || (await getProfile(user.uid).catch(() => null));
      const img  = chip.querySelector('[data-user-avatar]');
      const name = chip.querySelector('[data-user-name]');
      const src  = profile?.photoBase64 || profile?.photoURL || user.photoURL || '/assets/icons/icon.svg';
      if (img)  img.src = src;
      if (name) name.textContent = (profile?.fullName || user.displayName || 'حسابي').trim().split(/\s+/)[0];
    }
  } else {
    guestEls.forEach((el) => (el.hidden = false));
    if (chip) chip.hidden = true;
  }
  bindLogout();
  return user;
}
