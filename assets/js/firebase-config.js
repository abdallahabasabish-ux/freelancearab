/* ============================================================
   إعدادات Firebase — أكاديمية عرب فريلانسر
   ⚠️ ملاحظة أمنية: مفاتيح Firebase العامة ليست سرية بطبيعتها،
   الحماية الحقيقية تتم عبر قواعد firestore.rules
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* 🔴 الصق إعدادات مشروعك هنا من Firebase Console → Project Settings */
const firebaseConfig = {
  apiKey: "AIzaSyD8q05OB-2URf_5z59UD0NBKoA3NXaxncs",
  authDomain: "academy-os-314c0.firebaseapp.com",
  projectId: "academy-os-314c0",
  storageBucket: "academy-os-314c0.firebasestorage.app",
  messagingSenderId: "790267436938",
  appId: "1:790267436938:web:bdca5eaa023f7471c5b273",
};

/* المصادقة */
export const auth = getAuth(app);

/* مزود Google (لاسترداد الصورة والاسم) */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/* قاعدة البيانات */
export const db = getFirestore(app);

export default app;
