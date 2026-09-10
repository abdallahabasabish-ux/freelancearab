"use client";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const config = {
  apiKey: "AIzaSyD8q05OB-2URf_5z59UD0NBKoA3NXaxncs",
  authDomain: "academy-os-314c0.firebaseapp.com",
  projectId: "academy-os-314c0",
  storageBucket: "academy-os-314c0.firebasestorage.app",
  messagingSenderId: "790267436938",
  appId: "1:790267436938:web:bcbace45e788569cc5b273",
};
const app = getApps().length ? getApp() : initializeApp(config);

// Offline cache — يقلل القراءات ويُحسّن التجربة
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
})();

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
