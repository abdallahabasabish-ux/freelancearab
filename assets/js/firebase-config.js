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
  apiKey:            "PASTE_YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

/* المصادقة */
export const auth = getAuth(app);

/* مزود Google (لاسترداد الصورة والاسم) */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/* قاعدة البيانات */
export const db = getFirestore(app);

export default app;
