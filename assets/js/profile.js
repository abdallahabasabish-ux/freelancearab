/* ============================================================
   profile.js — ملف الطالب الإلزامي
   الصورة (ضغط Base64) + الاسم + الهاتف + السن + الموقع الجغرافي
   ============================================================ */

import { auth, db } from './firebase-config.js';
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAuth, initHeaderAuth } from './auth.js';
import { requestLocation, GEO_MESSAGES } from './geo.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);

/* ---------- حماية الصفحة (جلسة + تحقق + اسمح بالملف الناقص) ---------- */
const ctx = await requireAuth({ allowIncomplete: true });
if (ctx) main(ctx);

function main({ user, profile }) {

  /* رأس الصفحة: نمرر البيانات لتوفير قراءة Firestore */
  initHeaderAuth({ user, profile });

  const wasCompleted = !!profile?.profileCompleted;
  let photoBase64 = profile?.photoBase64 || null;   /* الصورة المرفوعة */
  let locData = profile?.location || null;
  const googlePhoto = profile?.photoURL || user.photoURL || null;

  /* ============ أكواد الدول ============ */
  const COUNTRIES = [
    ['+20','مصر'],['+966','السعودية'],['+971','الإمارات'],['+965','الكويت'],
    ['+973','البحرين'],['+974','قطر'],['+968','عُمان'],['+962','الأردن'],
    ['+970','فلسطين'],['+961','لبنان'],['+963','سوريا'],['+964','العراق'],
    ['+967','اليمن'],['+249','السودان'],['+218','ليبيا'],['+216','تونس'],
    ['+213','الجزائر'],['+212','المغرب'],['+222','موريتانيا'],['+252','الصومال'],
    ['+253','جيبوتي'],['+269','جزر القمر'],['+90','تركيا'],['+44','المملكة المتحدة'],
    ['+1','الولايات المتحدة'],['+49','ألمانيا'],['+33','فرنسا'],['+7','روسيا'],
    ['+86','الصين'],['+91','الهند'],['+92','باكستان'],['+60','ماليزيا'],
    ['+62','إندونيسيا'],['+234','نيجيريا'],['+27','جنوب أفريقيا'],['+61','أستراليا'],
    ['+81','اليابان'],['+82','كوريا الجنوبية'],['+55','البرازيل'],['+52','المكسيك']
  ];

  const ccSelect = $('#countryCode');
  ccSelect.innerHTML =
    '<option value="" disabled selected>كود الدولة</option>' +
    COUNTRIES.map(([c, n]) => `<option value="${c}">${n} (${c})</option>`).join('');

  /* ============ التعبئة المسبقة ============ */
  const nameInput = $('#fullName');
  nameInput.value = profile?.fullName || user.displayName || '';

  if (profile?.countryCode) {
    const opt = ccSelect.querySelector(`option[value="${profile.countryCode}"]`);
    if (opt) ccSelect.value = profile.countryCode;
  }
  if (profile?.phone) $('#phone').value = profile.phone;
  if (profile?.age) $('#age').value = profile.age;

  const preview = $('#avatarPreview');
  if (photoBase64) preview.src = photoBase64;
  else if (googlePhoto) preview.src = googlePhoto;

  if (profile?.location) {
    setLocState('ok', `محفوظ: ${[profile.location.city, profile.location.country].filter(Boolean).join('، ') || 'إحداثياتك السابقة'}`);
  }

  /* ============ الصورة: ضغط وتحجيم تلقائي ============ */
  $('#avatarBtn').addEventListener('click', () => $('#avatarInput').click());

  $('#avatarInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('اختر ملف صورة صالح.', 'warning');
    if (file.size > 5 * 1024 * 1024) return toast('حجم الصورة أكبر من 5MB.', 'warning');

    try {
      photoBase64 = await compressImage(file, 320, 0.78);
      preview.src = photoBase64;
      $('#avatarRemove').hidden = false;
      toast('تم تجهيز الصورة — لا تنسَ الحفظ.', 'success');
    } catch {
      toast('تعذر معالجة الصورة — جرّب صورة أخرى.', 'error');
    }
    e.target.value = '';
  });

  $('#avatarRemove').addEventListener('click', () => {
    photoBase64 = null;
    preview.src = googlePhoto || '/assets/icons/icon.svg';
    $('#avatarRemove').hidden = true;
  });
  if (photoBase64) $('#avatarRemove').hidden = false;

  function compressImage(file, max = 320, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
        const c = document.createElement('canvas');
        c.width = c.height = max;
        c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, max, max);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality)); /* ~30-60KB */
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('IMG_FAIL')); };
      img.src = url;
    });
  }

  /* ============ الموقع الجغرافي ============ */
  function setLocState(cls, msg) {
    const el = $('#locStatus');
    el.className = `loc-status ${cls}`;
    el.textContent = msg;
  }

  $('#locBtn').addEventListener('click', async () => {
    const btn = $('#locBtn');
    btn.classList.add('loading'); btn.disabled = true;
    setLocState('loading', 'جارٍ تحديد موقعك — وافق على إذن المتصفح...');
    try {
      locData = await requestLocation();
      const place = [locData.city, locData.country].filter(Boolean).join('، ');
      setLocState('ok', `✔ تم بنجاح: ${place || `إحداثيات ${locData.lat}, ${locData.lng}`} (دقة ±${locData.accuracy}م)`);
    } catch (err) {
      locData = null;
      setLocState('err', GEO_MESSAGES[err.message] || GEO_MESSAGES.UNKNOWN);
    } finally {
      btn.classList.remove('loading'); btn.disabled = false;
    }
  });

  /* ============ الحفظ ============ */
  function isValidFullName(v) {
    const words = v.trim().split(/\s+/);
    return words.length >= 3 && words.every((w) => w.length >= 2);
  }

  $('#profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#submitBtn');

    const fullName = nameInput.value.trim();
    const cc   = ccSelect.value;
    const phone = $('#phone').value.replace(/\D/g, '');
    const age  = parseInt($('#age').value, 10);

    /* تحقق شامل */
    if (!isValidFullName(fullName)) return toast('أدخل اسمك الثلاثي (٣ كلمات على الأقل).', 'warning');
    if (!cc)  return toast('اختر كود الدولة.', 'warning');
    if (!/^\d{7,15}$/.test(phone)) return toast('رقم الهاتف غير صحيح (7-15 رقم بدون كود الدولة).', 'warning');
    if (!(age >= 10 && age <= 90)) return toast('أدخل سناً صحيحاً بين 10 و 90.', 'warning');
    if (!photoBase64 && !googlePhoto && !profile?.photoBase64)
      return toast('الصورة الشخصية إلزامية — اختر صورة.', 'warning');

    setLoading(btn, true);
    try {
      const payload = {
        fullName,
        countryCode: cc,
        phone,
        fullPhone: `${cc}${phone}`,
        age,
        profileCompleted: true,
        emailVerified: true,
        updatedAt: serverTimestamp()
      };
      if (photoBase64) payload.photoBase64 = photoBase64;
      if (locData) payload.location = locData;

      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });

      toast(wasCompleted ? 'تم حفظ التعديلات بنجاح.' : 'اكتمل ملفك! جاهز للانطلاق 🎉', 'success');
      if (!wasCompleted) setTimeout(() => location.replace('/dashboard.html'), 1000);
    } catch (err) {
      console.error(err);
      toast('تعذر الحفظ — تحقق من اتصالك وحاول مجدداً.', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  function setLoading(btn, on) {
    btn.disabled = on;
    btn.classList.toggle('loading', on);
  }
}
