"use client";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./client";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/utils/constants";

/* ─────────────── مزامنة الجلسة مع السيرفر (Cookie HttpOnly) ─────────────── */
async function syncSession(user: User | null) {
  const token = user ? await user.getIdToken(/* forceRefresh */ true) : "";
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

/* ─────────────── إنشاء مستند المستخدم إن لم يكن موجودًا ─────────────── */
async function ensureUserDoc(user: User) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    uid: user.uid,
    name: user.displayName ?? user.email?.split("@")[0] ?? "مستخدم",
    email: user.email ?? "",
    photoURL: user.photoURL ?? null,
    role: "student",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/* ─────────────── العمليات العامة ─────────────── */
export async function registerWithEmail(name: string, email: string, password: string) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name });
  await ensureUserDoc(user);
  await syncSession(user);
  return user;
}

export async function loginWithEmail(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(user);
  await syncSession(user);
  return user;
}

export async function loginWithGoogle() {
  const { user } = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(user);
  await syncSession(user);
  return user;
}

export async function logout() {
  await signOut(auth);
  await syncSession(null);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email, {
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
  });
}

/* ─────────────── مُراقب الحالة — يُحدّث الجلسة تلقائيًا ─────────────── */
export function subscribeAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    cb(user);
    // تحديث الجلسة عند تغيّر الحالة (بعد login/logout/refresh)
    try { await syncSession(user); } catch { /* ignore */ }
  });
}

/* ─────────────── قراءة بيانات المستخدم من Firestore ─────────────── */
export async function fetchUserProfile(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as import("@/types").AppUser) : null;
}
