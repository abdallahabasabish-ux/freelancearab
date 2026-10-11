import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCwf3A43r0K_fiYH0tVlent_DgV9zMo54",
  authDomain: "freelance-arab.firebaseapp.com",
  projectId: "freelance-arab",
  storageBucket: "freelance-arab.firebasestorage.app",
  messagingSenderId: "268442782459",
  appId: "1:268442782459:web:b6b330f97460cdf30b7e5e",
};

const app = initializeApp(firebaseConfig);

/* المصادقة */
export const auth = getAuth(app);

/* مزود Google */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/* قاعدة البيانات */
export const db = getFirestore(app);

export default app;
