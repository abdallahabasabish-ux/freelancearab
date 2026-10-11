const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require('@firebase/rules-unit-testing');
const {
  collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch
} = require('firebase/firestore');

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

test('verified students can read published quizzes, answer keys, and their own attempt', async () => {
  const db = env.authenticatedContext('student-user', { email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(db, `${lessonPath}/quiz/current`)));
  await assertSucceeds(getDoc(doc(db, `${lessonPath}/answerKeys/current`)));
  await assertSucceeds(getDoc(doc(db, 'users/student-user/quizAttempts/course-1__lesson-1')));
  await assertSucceeds(setDoc(doc(db, 'users/student-user/quizAttempts/course-2__lesson-2'), {
    courseId: 'course-2',
    lessonId: 'lesson-2',
    correct: 2,
    total: 4,
    percentage: 50,
    passPercent: 50,
    passed: true,
    submittedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(db, 'users/student-user/quizAttempts/course-3__lesson-3'), {
    courseId: 'course-3',
    lessonId: 'lesson-3',
    correct: 4,
    total: 4,
    percentage: 100,
    passPercent: 50,
    passed: true,
    submittedAt: new Date()
  }));
  await assertFails(setDoc(doc(db, 'users/another-user/quizAttempts/course-1__lesson-1'), {
    courseId: 'course-1',
    lessonId: 'lesson-1',
    correct: 2,
    total: 4,
    percentage: 50,
    passPercent: 50,
    passed: true,
    submittedAt: new Date()
  }));
});

test('unverified and signed-out users cannot read quiz questions', async () => {
  const unverifiedDb = env.authenticatedContext('unverified-user', { email_verified: false }).firestore();
  const publicDb = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unverifiedDb, `${lessonPath}/quiz/current`)));
  await assertFails(getDoc(doc(unverifiedDb, `${lessonPath}/answerKeys/current`)));
  await assertFails(getDoc(doc(publicDb, `${lessonPath}/quiz/current`)));
  await assertFails(getDoc(doc(publicDb, `${lessonPath}/answerKeys/current`)));
});

test('administrators can read answer keys', async () => {
  const adminDb = env.authenticatedContext('admin-user', { email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(adminDb, `${lessonPath}/answerKeys/current`)));
});

test('administrators can save and delete courses, lessons, and quizzes', async () => {
  const db = env.authenticatedContext('admin-user', { email_verified: true }).firestore();
  const courseRef = doc(db, 'courses/new-course');
  const lessonRef = doc(db, 'courses/new-course/lessons/new-lesson');
  const quizRef = doc(db, 'courses/new-course/lessons/new-lesson/quiz/current');
  const keysRef = doc(db, 'courses/new-course/lessons/new-lesson/answerKeys/current');
  const saveBatch = writeBatch(db);
  saveBatch.set(courseRef, { title: 'كورس اختبار', status: 'draft' });
  saveBatch.set(lessonRef, { title: 'درس اختبار', isPublished: false });
  saveBatch.set(quizRef, { enabled: false });
  saveBatch.set(keysRef, { correctByQuestionId: {} });
  await assertSucceeds(saveBatch.commit());
  await assertSucceeds(getDocs(collection(db, 'courses/new-course/lessons')));

  const deleteBatch = writeBatch(db);
  deleteBatch.delete(quizRef);
  deleteBatch.delete(keysRef);
  deleteBatch.delete(lessonRef);
  deleteBatch.delete(courseRef);
  await assertSucceeds(deleteBatch.commit());
});

test('the configured admin UID can manage courses without an admins document', async () => {
  const adminDb = env.authenticatedContext('NOZnMklGITWjF3ei05nxIcCyQs43').firestore();
  const courseRef = doc(adminDb, 'courses/configured-admin-course');
  await assertSucceeds(setDoc(courseRef, { title: 'كورس المدير', status: 'draft' }));

  const publicDb = env.authenticatedContext('regular-user').firestore();
  await assertFails(setDoc(doc(publicDb, 'courses/unauthorized-course'), {
    title: 'كورس غير مصرح',
    status: 'draft'
  }));
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

test('public access is limited to the aggregated geographic statistics document', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'publicStats/geoSubscribers'), {
      totalSubscribers: 2,
      geoOptInSubscribers: 1,
      countryCounts: [{ code: 'EG', name: 'مصر', subscribers: 1 }]
    });
    await setDoc(doc(db, 'users/private-user'), {
      email: 'private@example.com',
      location: { country: 'مصر', lat: 30, lng: 31 }
    });
  });

  const publicDb = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDb, 'publicStats/geoSubscribers')));
  await assertFails(getDocs(collection(publicDb, 'publicStats')));
  await assertFails(getDoc(doc(publicDb, 'publicStats/other')));
  await assertFails(getDoc(doc(publicDb, 'users/private-user')));
  await assertFails(setDoc(doc(publicDb, 'publicStats/geoSubscribers'), {
    totalSubscribers: 999
  }));
});
