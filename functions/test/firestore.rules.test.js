const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');

let env;
const courseId = 'course-1';
const lessonId = 'lesson-1';
const lessonPath = `courses/${courseId}/lessons/${lessonId}`;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-freelancearab',
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8')
    }
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `admins/admin-user`), { role: 'admin' });
    await setDoc(doc(db, `courses/${courseId}`), { status: 'published' });
    await setDoc(doc(db, lessonPath), { isPublished: true });
    await setDoc(doc(db, `${lessonPath}/quiz/current`), {
      version: 'quiz-v1',
      enabled: true,
      questions: [{ id: 'q1', prompt: 'سؤال', options: [{ id: 'a', text: 'اختيار' }] }]
    });
    await setDoc(doc(db, `${lessonPath}/answerKeys/current`), {
      version: 'quiz-v1',
      correctByQuestionId: { q1: 'a' }
    });
    await setDoc(doc(db, 'users/student-user/quizAttempts/course-1__lesson-1'), {
      correct: 1,
      total: 4,
      percentage: 25,
      passed: false
    });
  });
});

test.after(async () => {
  await env?.cleanup();
});

test('verified students can read published quizzes and their own attempt only', async () => {
  const db = env.authenticatedContext('student-user', { email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(db, `${lessonPath}/quiz/current`)));
  await assertSucceeds(getDoc(doc(db, 'users/student-user/quizAttempts/course-1__lesson-1')));
  await assertFails(getDoc(doc(db, `${lessonPath}/answerKeys/current`)));
  await assertFails(setDoc(doc(db, 'users/student-user/quizAttempts/new-attempt'), { passed: true }));
});

test('unverified and signed-out users cannot read quiz questions', async () => {
  const unverifiedDb = env.authenticatedContext('unverified-user', { email_verified: false }).firestore();
  const publicDb = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unverifiedDb, `${lessonPath}/quiz/current`)));
  await assertFails(getDoc(doc(publicDb, `${lessonPath}/quiz/current`)));
});

test('administrators can read answer keys', async () => {
  const adminDb = env.authenticatedContext('admin-user', { email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(adminDb, `${lessonPath}/answerKeys/current`)));
});

test('students can read and save their own course progress', async () => {
  const db = env.authenticatedContext('student-user').firestore();
  const progressRef = doc(db, 'progress/student-user__course-1');

  await assertSucceeds(getDoc(progressRef));
  await assertSucceeds(setDoc(progressRef, {
    uid: 'student-user',
    courseId,
    lastLessonId: lessonId,
    completedLessons: []
  }));
  await assertSucceeds(getDoc(progressRef));
  await assertSucceeds(setDoc(progressRef, {
    uid: 'student-user',
    courseId,
    lastLessonId: lessonId,
    completedLessons: [lessonId]
  }));
  await assertFails(setDoc(doc(db, 'progress/other-user__course-1'), {
    uid: 'other-user',
    courseId,
    completedLessons: []
  }));
});
