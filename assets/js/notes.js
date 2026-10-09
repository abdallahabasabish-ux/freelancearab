/* ============================================================
   notes.js — الملاحظات المرتبطة بثواني الفيديو
   - تحديث حي (onSnapshot): تظهر الإضافات فوراً
   - فرز محلي بالوقت بدل orderBy → صفر Composite Indexes
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** استماع حي لملاحظات (طالب + كورس + درس) محددة */
export function listenLessonNotes({ uid, courseId, lessonId }, onData, onError) {
  const q = query(
    collection(db, 'notes'),
    where('uid', '==', uid),
    where('courseId', '==', courseId),
    where('lessonId', '==', lessonId)
  );
  return onSnapshot(q, (snap) => {
    const notes = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) =>
        ((a.videoTime ?? 0) - (b.videoTime ?? 0)) ||
        ((a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)));
    onData(notes);
  }, onError);
}

export const addNote = ({ uid, courseId, lessonId, videoTime, text }) =>
  addDoc(collection(db, 'notes'), {
    uid, courseId, lessonId,
    videoTime: Math.max(0, Math.floor(videoTime || 0)),
    text: text.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

export const updateNoteText = (noteId, text) =>
  updateDoc(doc(db, 'notes', noteId), { text: text.trim(), updatedAt: serverTimestamp() });

export const deleteNote = (noteId) =>
  deleteDoc(doc(db, 'notes', noteId));
