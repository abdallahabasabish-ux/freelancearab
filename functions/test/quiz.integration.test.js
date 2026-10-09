const { initializeApp: initializeAdminApp } = require('firebase-admin/app');
const { getAuth: getAdminAuth } = require('firebase-admin/auth');
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase/app');
const { connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { connectFunctionsEmulator, getFunctions, httpsCallable } = require('firebase/functions');
const test = require('node:test');

const projectId = 'demo-freelancearab';
const courseId = 'quiz-integration-course';
const lessonId = 'quiz-integration-lesson';
const lessonPath = `courses/${courseId}/lessons/${lessonId}`;

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
const adminApp = initializeAdminApp({ projectId }, 'quiz-integration-admin');
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);

const publicApp = initializeApp({
  apiKey: 'fake-api-key',
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  appId: '1:123456789:web:quiz-integration'
}, 'quiz-integration-client');
const clientAuth = getAdminLikeAuth();
const callableFunctions = getFunctions(publicApp, 'us-central1');
connectFunctionsEmulator(callableFunctions, '127.0.0.1', 5001);

function getAdminLikeAuth() {
  const auth = require('firebase/auth').getAuth(publicApp);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  return auth;
}

const answers = { q1: 'yes', q2: 'yes', q3: 'no', q4: 'no' };

test('quiz grading accepts 50 percent once and rejects a second submission', async () => {
  await adminDb.doc(`courses/${courseId}`).set({ status: 'published' });
  await adminDb.doc(lessonPath).set({ isPublished: true });
  await adminDb.doc(`${lessonPath}/quiz/current`).set({
    version: 'integration-v1',
    enabled: true,
    passPercent: 50,
    questions: ['q1', 'q2', 'q3', 'q4'].map((id) => ({
      id,
      prompt: `Question ${id}`,
      options: [{ id: 'yes', text: 'Yes' }, { id: 'no', text: 'No' }]
    }))
  });
  await adminDb.doc(`${lessonPath}/answerKeys/current`).set({
    version: 'integration-v1',
    correctByQuestionId: { q1: 'yes', q2: 'no', q3: 'yes', q4: 'no' }
  });

  const account = await createUserWithEmailAndPassword(clientAuth, `quiz-${Date.now()}@example.com`, 'TestPass_123!');
  await adminAuth.updateUser(account.user.uid, { emailVerified: true });
  await account.user.reload();
  await account.user.getIdToken(true);

  const submitLessonQuiz = httpsCallable(callableFunctions, 'submitLessonQuiz');
  const response = await submitLessonQuiz({ courseId, lessonId, answers });
  if (response.data.percentage !== 50 || response.data.passed !== true)
    throw new Error(`Expected a passing 50% score, received ${JSON.stringify(response.data)}`);

  await require('node:assert/strict').rejects(
    submitLessonQuiz({ courseId, lessonId, answers }),
    (error) => error.code === 'functions/already-exists'
  );
});
