/* ============================================================
   register.js — منطق صفحة إنشاء الحساب
   التسجيل → إرسال بريد التحقق → مراقبة التحقق تلقائياً → الملف
   ============================================================ */

import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  initAuthGate, authErrorAr, loginWithGoogle, logout
} from './auth.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);

/* ---------- بوابة الحماية: مستخدم مسجّل؟ ---------- */
const gate = await initAuthGate();
if (gate === 'verify') openVerifyPanel(auth.currentUser?.email || '');
if (gate === 'redirected') { /* سيتم التحويل تلقائياً */ }

/* ============ أدوات مساعدة ============ */
function setLoading(btn, on) {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

function openVerifyPanel(email) {
  $('#verifyEmail').textContent = email || '';
  $('#panelForm').hidden = true;
  $('#panelVerify').hidden = false;
  startPolling();
  startCooldown($('#resendBtn'), 60);
}

let pollTimer = null;
let verificationFinished = false;
function startPolling() {
  stopPolling();
  /* فحص تلقائي كل 6 ثوانٍ — رخيص (تحديث توكن فقط) */
  pollTimer = setInterval(async () => {
    const user = auth.currentUser;
    if (!user) return stopPolling();
    try {
      await user.reload();
    } catch {
      /* تجاهل */
    }
    if (user.emailVerified) {
      stopPolling();
      await finishVerification(user);
    }
  }, 6000);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

async function finishVerification(user) {
  if (verificationFinished) return;
  verificationFinished = true;
  try {
    await updateDoc(doc(db, 'users', user.uid), { emailVerified: true });
  } catch { /* تجاهل */ }
  toast('تم تأكيد بريدك بنجاح 🎉', 'success');
  setTimeout(() => location.replace('/profile.html'), 800);
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

/* ============ التحقق الحي من الحقول ============ */
const nameInput = $('#fullName');
const nameHint  = $('#nameHint');

function isValidFullName(v) {
  const words = v.trim().split(/\s+/);
  return words.length >= 3 && words.every((w) => w.length >= 2);
}

nameInput.addEventListener('input', () => {
  const ok = isValidFullName(nameInput.value);
  nameHint.textContent = ok
    ? '✔ الاسم صالح — سيظهر في شهادتك بهذه الصيغة.'
    : 'أدخل اسمك الثلاثي (٣ كلمات على الأقل) كما تريد ظهوره في شهادتك.';
  nameHint.style.color = ok ? 'var(--success)' : '';
});

/* إظهار/إخفاء كلمة المرور */
document.querySelectorAll('[data-pw-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.pwToggle);
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

/* مقياس قوة كلمة المرور */
const pwInput = $('#password');
pwInput.addEventListener('input', () => {
  const v = pwInput.value;
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
  if (/\d/.test(v) && /[^\w\s]/.test(v)) s++;
  const meter = $('#pwMeter'), label = $('#pwLabel');
  meter.dataset.score = v ? s : 0;
  label.textContent = !v ? '' : ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية ممتازة'][s];
  label.style.color = v ? ['var(--danger)', 'var(--danger)', 'var(--warning)', 'var(--success)', 'var(--success)'][s] : '';
});

/* ============ إرسال نموذج التسجيل ============ */
 $('#registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#submitBtn');

  const fullName = nameInput.value.trim();
  const email    = $('#email').value.trim();
  const pw       = pwInput.value;
  const confirm  = $('#confirmPassword').value;
  const blogFollow = $('#acceptBlogFollow');

  /* تحقق يدوي قبل الإرسال */
  if (!isValidFullName(fullName)) {
    toast('أدخل اسمك الثلاثي (٣ كلمات على الأقل).', 'warning');
    nameInput.focus();
    return;
  }
  if (pw !== confirm) {
    $('#confirmError').style.display = 'block';
    $('#confirmPassword').focus();
    return;
  }
  if (!blogFollow.checked) {
    toast('يجب متابعة مدونة عرب فريلانسر قبل إتمام التسجيل.', 'warning');
    blogFollow.focus();
    return;
  }
  $('#confirmError').style.display = 'none';

  setLoading(btn, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    const user = cred.user;

    await updateProfile(user, { displayName: fullName });

    /* مستند الطالب الأولي */
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email,
      fullName,
      role: 'student',
      provider: 'password',
      emailVerified: false,
      profileCompleted: false,
      points: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    try { await sendEmailVerification(user); } catch { /* زر الإعادة متاح */ }

    openVerifyPanel(email);
  } catch (err) {
    toast(authErrorAr(err.code), 'error');
  } finally {
    setLoading(btn, false);
  }
});

/* ============ لوحة التحقق: الأزرار ============ */
 $('#continueBtn').addEventListener('click', async () => {
  const btn = $('#continueBtn');
  const user = auth.currentUser;
  if (!user) return toast('انتهت الجلسة — سجل الدخول من جديد.', 'warning');
  setLoading(btn, true);
  try {
    await user.reload();
  } catch {
    /* تجاهل */
  }
  if (user.emailVerified) {
    await finishVerification(user);
  } else {
    setLoading(btn, false);
    toast('لم نتمكن من تأكيد التحقق بعد — تأكد من ضغط رابط التفعيل في بريدك.', 'warning');
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

/* ============ Google ============ */
 $('#googleBtn').addEventListener('click', async () => {
  const btn = $('#googleBtn');
  setLoading(btn, true);
  try {
    await loginWithGoogle();
    const { getProfile, routeAuthedUser } = await import('./auth.js');
    const profile = await getProfile(auth.currentUser.uid);
    location.replace(profile?.profileCompleted ? '/dashboard.html' : '/profile.html');
  } catch (err) {
    toast(authErrorAr(err.code), 'error');
    setLoading(btn, false);
  }
});
