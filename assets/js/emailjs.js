/* ============================================================
   emailjs.js — إرسال إيميل شهادة الطالب عبر EmailJS REST API
   (بدون SDK — نداء fetch مباشر، متوافق مع Vanilla JS)
   ⚠️ الإعداد مطلوب مرة واحدة — انظر التعليمات أسفل الملف
   ============================================================ */

import { db } from './firebase-config.js';
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* 🔴 الصق مفاتيحك من لوحة EmailJS (Account → API Keys) */
const EMAILJS = {
  SERVICE_ID:  'service_7wih75p',     // Email Services → خدمتك
  TEMPLATE_ID: 'template_mws2dqi',    // Email Templates → قالب الشهادة
  PUBLIC_KEY:  'xCsxAymFsWTjIdVUB'      // Account → API Keys → Public Key
};

const VERIFY_URL = 'https://courses.freelancearab.com/verify.html';

/** إرسال رسالة واحدة (REST v1.0 — يعمل من المتصفح مباشرة) */
export async function sendCertEmail({ email, name, courseTitle, code, issuedAt }) {
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS.SERVICE_ID,
      template_id: EMAILJS.TEMPLATE_ID,
      user_id: EMAILJS.PUBLIC_KEY,
      template_params: {
        to_email: email,
        to_name: name,
        course_title: courseTitle,
        cert_code: code,
        verify_url: `${VERIFY_URL}?code=${encodeURIComponent(code)}`,
        issued_date: issuedAt || new Date().toLocaleDateString('ar-EG'),
        academy_name: 'أكاديمية عرب فريلانسر'
      }
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`EMAILJS_FAIL ${res.status} ${t}`);
  }
}

/**
 * ضمان إرسال إيميل لكل شهادة مرة واحدة فقط:
 * يفحص emailSentCerts في مستند الطالب، يرسل للناقص،
 * ويوسم المُرسل (arrayUnion) بعد نجاح كل رسالة.
 * يُستدعى تلقائياً من صفحة الشهادات عند زيارتها.
 * @returns عدد الرسائل المُرسلة فعلياً
 */
export async function ensureCertificatesEmails({ user, profile, certs }) {
  const sent = profile?.emailSentCerts || [];
  let count = 0;

  for (const cert of certs) {
    if (sent.includes(cert.id)) continue;
    if (!user.email) break;
    try {
      await sendCertEmail({
        email: user.email,
        name: cert.studentName || profile?.fullName || '',
        courseTitle: cert.courseTitle || '',
        code: cert.id,
        issuedAt: cert.issuedAt?.seconds
          ? new Date(cert.issuedAt.seconds * 1000).toLocaleDateString('ar-EG')
          : ''
      });
      await updateDoc(doc(db, 'users', user.uid), {
        emailSentCerts: arrayUnion(cert.id)
      });
      count++;
    } catch (err) {
      /* خطأ الإعدادات أو استنفاد الحصة → لا نحاول للبقية هذه الزيارة */
      console.warn('EmailJS:', err.message);
      break;
    }
  }
  return count;
}

/* ============================================================
   📧 إعداد EmailJS (مرة واحدة — مجاني 200 رسالة/شهر):
   1) سجّل في emailjs.com → Email Services → Add Service → Gmail
      (يوصلها بحساب support@freelancearab.com أو Gmail عادي) → انسخ SERVICE_ID
   2) Email Templates → Create → الصق القالب التالي → انسخ TEMPLATE_ID
   3) Account → API Keys → انسخ Public Key
   4) حدّث الثوابت أعلاه

   ——— قالب الرسالة (Template) ———
   Subject:  🎓 شهادتك من {{academy_name}} جاهزة!
   Content:
   <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#101828">
     <h2 style="color:#1e3a8a">مبروك {{to_name}} 🎉</h2>
     <p>تم إصدار شهادتك بإتمامك كورس <b style="color:#fe8a02">{{course_title}}</b> بنجاح.</p>
     <p><b>كود التحقق:</b> <span style="font-family:monospace;font-size:1.1em;color:#1e3a8a">{{cert_code}}</span></p>
     <p><b>تاريخ الإصدار:</b> {{issued_date}}</p>
     <p>يمكنك تحميل شهادتك من لوحة الطالب، وللشركات:
        <a href="{{verify_url}}">التحقق من الشهادة هنا</a></p>
     <p style="color:#667085;font-size:.85em">أكاديمية عرب فريلانسر — نطلق مواهب العمل الحر</p>
   </div>
   ============================================================ */
