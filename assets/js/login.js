/* ============================================================
   login.js — منطق صفحة تسجيل الدخول
   الدخول → فحص التحقق البريدي → جلسة جديدة (تطرد الأجهزة الأخرى)
   ============================================================ */

import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword, sendPasswordResetEmail, reload
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  initAuthGate, authErrorAr, startSession, routeAuthedUser,
  loginWithGoogle, logout
} from './auth.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);

function setLoading(btn, on) {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

function showPanel(id) {
  document.querySelectorAll('.auth-panel').forEach((p) => (p.hidden = p.id !== id));
  window.scrollTo({ top: 0 });
}

function startCooldown(btn, secs) {
  let left = secs;
  const orig = btn.textContent;
  btn.disabled = true;
  const t = setInterval(() => {
    btn.textContent = `يمكنك الإعادة بعد (${left--}) ثانية`;
    if (left < 0) { clearInterval(t); btn.disabled = false; btn.textContent = orig; }
  }, 1000);
}

/* ---------- رسائل حالة الرابط (?state=...) ---------- */
const state = new URLSearchParams(location.search).get('state');
if (state === 'session') toast('انتهت جلستك — تم تسجيل الدخول بهذا الحساب من جهاز آخر.', 'warning');
if (state === 'verify')  toast('يجب تأكيد بريدك الإلكتروني أولاً.', 'warning');

/* ---------- بوابة: مستخدم مسجّل مسبقاً؟ ---------- */
const gate = await initAuthGate();
if (gate === 'verify') openVerifyPanel(auth.currentUser?.email || '');

/* ---------- إظهار/إخفاء كلمة المرور ---------- */
document.querySelectorAll('[data-pw-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.pwToggle);
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

/* ---------- التبديل بين اللوحات ---------- */
 $('#forgotLink').addEventListener('click', () => showPanel('panelReset'));
 $('#backToLogin').addEventListener('click', () => showPanel('panelLogin'));

/* ---------- لوحة التحقق ---------- */
let pollTimer = null;
function openVerifyPanel(email) {
  $('#verifyEmail').textContent = email || '';
  showPanel('panelVerify');
  startCooldown($('#resendBtn'), 30);
  stopPolling();
  pollTimer = setInterval(async () => {
    const user = auth.currentUser;
    if (!user) return stopPolling();
    await reload(user).catch(() => {});
    if (user.emailVerified) { stopPolling(); await finishVerification(user); }
  }, 6000);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

async function finishVerification(user) {
  try {
    await updateDoc(doc(db, 'users', user.uid), { emailVerified: true, updatedAt: serverTimestamp() });
  } catch { /* تجاهل */ }
  await startSession(user);
  toast('تم تأكيد بريدك بنجاح 🎉', 'success');
  setTimeout(() => routeAuthedUser(user), 800);
}

 $('#continueBtn').addEventListener('click', async () => {
  const btn = $('#continueBtn');
  const user = auth.currentUser;
  if (!user) return toast('انتهت الجلسة — سجل الدخول من جديد.', 'warning');
  setLoading(btn, true);
  await reload(user).catch(() => {});
  if (user.emailVerified) {
    await finishVerification(user);
  } else {
    setLoading(btn, false);
    toast('لم يتم التحقق بعد — اضغط رابط التفعيل في بريدك أولاً.', 'warning');
  }
});

 $('#resendBtn').addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await sendEmailVerification(user);
    toast('تم إرسال رابط جديد إلى بريدك.', 'success');
    startCooldown($('#resendBtn'), 60);
  } catch (err) {
    toast(authErrorAr(err.code), 'error');
  }
});

 $('#switchAccountBtn').addEventListener('click', logout);

/* ---------- تسجيل الدخول ---------- */
 $('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#submitBtn');
  const email = $('#email').value.trim();
  const pw = $('#password').value;

  setLoading(btn, true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pw);

    /* ردع الحسابات الوهمية: منع الدخول قبل تأكيد البريد */
    if (!cred.user.emailVerified) {
      openVerifyPanel(email);
      setLoading(btn, false);
      return;
    }

    await startSession(cred.user);
    await routeAuthedUser(cred.user);
  } catch (err) {
    toast(authErrorAr(err.code), 'error');
    setLoading(btn, false);
  }
});

/* ---------- استعادة كلمة المرور ---------- */
 $('#resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#resetBtn');
  const email = $('#resetEmail').value.trim();
  setLoading(btn, true);
  try {
    await sendPasswordResetEmail(auth, email);
    $('#resetSuccess').hidden = false;
  } catch (err) {
    toast(authErrorAr(err.code), 'error');
  } finally {
    setLoading(btn, false);
  }
});

/* ---------- Google ---------- */
 $('#googleBtn').addEventListener('click', async () => {
  const btn = $('#googleBtn');
  setLoading(btn, true);
  try {
    const user = await loginWithGoogle();
    await routeAuthedUser(user);
  } catch (err) {
    toast(authErrorAr(err.code), 'error');
    setLoading(btn, false);
  }
});
