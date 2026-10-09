/* ============================================================
   progress.js — تتبع التقدم ونظام النقاط
   - مستند واحد لكل (طالب + كورس): progress/{uid}__{courseId}
   - الكتابة عبر Batch ذرّي: تحديث التقدم + النقاط معاً
   ============================================================ */

import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, writeBatch, serverTimestamp,
  increment, deleteField, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const POINTS_PER_LESSON = 10;

export const progressDocRef = (uid, courseId) =>
  doc(db, 'progress', `${uid}__${courseId}`);

/** جلب تقدم الطالب في كورس محدد (قراءة واحدة) */
export async function fetchProgress(uid, courseId) {
  const snap = await getDoc(progressDocRef(uid, courseId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** حفظ آخر درس فُتح (للمتابعة لاحقاً) — يُستدعى فقط عند التغيير */
export async function saveLastLesson(uid, courseId, lessonId) {
  await setDoc(progressDocRef(uid, courseId), {
    uid, courseId, lastLessonId: lessonId, updatedAt: serverTimestamp()
  }, { merge: true });
}

/** كل تقدم الطالب (للوحة الطالب) — مرتب بالأحدث نشاطاً */
export async function fetchAllProgress(uid) {
  /* where بلا orderBy → لا يحتاج Composite Index */
  const q = query(collection(db, 'progress'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
}

/**
 * إتمام/إلغاء إتمام درس — ذرّياً:
 * 1) تحديث مصفوفة الدروس المكتملة + النسبة + completedAt
 * 2) إضافة/خصم النقاط من users/{uid}
 * @returns { completedLessons, percent, wasDone }
 */
export async function toggleLessonComplete({ uid, courseId, lessonId, completedLessons, totalLessons }) {
  const wasDone = completedLessons.includes(lessonId);
  const next = wasDone
    ? completedLessons.filter((id) => id !== lessonId)
    : [...completedLessons, lessonId];
  const percent = totalLessons > 0 ? Math.round((next.length / totalLessons) * 100) : 0;

  const data = {
    uid, courseId,
    completedLessons: next,
    progressPercent: percent,
    lastLessonId: lessonId,
    updatedAt: serverTimestamp()
  };
  /* علامة إكمال الكورس (تُستخدم في المرحلة 5 لإصدار الشهادات) */
  data.completedAt = percent === 100 ? serverTimestamp() : deleteField();

  const batch = writeBatch(db);
  batch.set(progressDocRef(uid, courseId), data, { merge: true });
  batch.update(doc(db, 'users', uid), {
    points: increment(wasDone ? -POINTS_PER_LESSON : POINTS_PER_LESSON)
  });
  await batch.commit();

  return { completedLessons: next, percent, wasDone };
}
