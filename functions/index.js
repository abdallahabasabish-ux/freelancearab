const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

initializeApp();
const db = getFirestore();
const QUESTION_COUNT = 4;
const PASS_PERCENT = 50;

function validDocumentId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

exports.submitLessonQuiz = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'سجّل الدخول أولاً.');
  if (request.auth.token.email_verified !== true)
    throw new HttpsError('permission-denied', 'يجب تأكيد البريد الإلكتروني.');

  const { courseId, lessonId, answers } = request.data || {};
  if (!validDocumentId(courseId) || !validDocumentId(lessonId))
    throw new HttpsError('invalid-argument', 'معرّف الكورس أو الحلقة غير صالح.');
  if (!answers || typeof answers !== 'object' || Array.isArray(answers))
    throw new HttpsError('invalid-argument', 'الإجابات غير صالحة.');

  const lessonPath = `courses/${courseId}/lessons/${lessonId}`;
  const courseRef = db.doc(`courses/${courseId}`);
  const lessonRef = db.doc(lessonPath);
  const quizRef = db.doc(`${lessonPath}/quiz/current`);
  const keyRef = db.doc(`${lessonPath}/answerKeys/current`);
  const attemptRef = db.doc(`users/${uid}/quizAttempts/${courseId}__${lessonId}`);

  return db.runTransaction(async (transaction) => {
    const [attemptSnap, courseSnap, lessonSnap, quizSnap, keySnap] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(courseRef),
      transaction.get(lessonRef),
      transaction.get(quizRef),
      transaction.get(keyRef)
    ]);

    if (attemptSnap.exists)
      throw new HttpsError('already-exists', 'تم استخدام المحاولة الوحيدة لهذا الاختبار.');
    if (!courseSnap.exists || courseSnap.data().status !== 'published' ||
        !lessonSnap.exists || lessonSnap.data().isPublished !== true)
      throw new HttpsError('failed-precondition', 'الكورس أو الحلقة غير منشورة.');
    if (!quizSnap.exists || !keySnap.exists)
      throw new HttpsError('not-found', 'اختبار هذه الحلقة غير متاح.');

    const quiz = quizSnap.data();
    const key = keySnap.data();
    const questions = quiz.questions;
    const correctByQuestionId = key.correctByQuestionId;
    if (quiz.enabled !== true || !Array.isArray(questions) || questions.length !== QUESTION_COUNT ||
        quiz.version !== key.version || !correctByQuestionId || typeof correctByQuestionId !== 'object')
      throw new HttpsError('failed-precondition', 'إعداد الاختبار غير مكتمل.');

    if (Object.keys(answers).length !== QUESTION_COUNT)
      throw new HttpsError('invalid-argument', 'أجب عن الأسئلة الأربعة قبل التسليم.');

    let correct = 0;
    questions.forEach((question) => {
      const selected = answers[question.id];
      const allowedOptions = Array.isArray(question.options)
        ? question.options.map((option) => option.id)
        : [];
      if (!question.id || !allowedOptions.includes(selected) || !correctByQuestionId[question.id])
        throw new HttpsError('invalid-argument', 'تحتوي الإجابات على اختيار غير صالح.');
      if (selected === correctByQuestionId[question.id]) correct += 1;
    });

    const percentage = Math.round((correct / QUESTION_COUNT) * 100);
    const result = {
      courseId,
      lessonId,
      correct,
      total: QUESTION_COUNT,
      percentage,
      passPercent: PASS_PERCENT,
      passed: percentage >= PASS_PERCENT
    };

    transaction.create(attemptRef, {
      ...result,
      submittedAt: FieldValue.serverTimestamp()
    });
    return result;
  });
});
