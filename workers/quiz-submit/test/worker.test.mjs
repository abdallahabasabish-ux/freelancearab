import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import { createQuizWorker } from '../src/index.mjs';

const projectId = 'freelance-arab';
const origin = 'https://courses.freelancearab.com';
const now = Date.parse('2026-10-11T04:00:00.000Z');
const env = {
  FIREBASE_PROJECT_ID: projectId,
  ALLOWED_ORIGINS: origin,
  FIREBASE_SERVICE_ACCOUNT: ''
};
let privateKey;
let publicJwk;

test.before(async () => {
  const pair = await webcrypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  }, true, ['sign', 'verify']);
  privateKey = pair.privateKey;
  publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  publicJwk.kid = 'test-firebase-kid';
  publicJwk.alg = 'RS256';

  const servicePair = await webcrypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  }, true, ['sign', 'verify']);
  const pkcs8 = await webcrypto.subtle.exportKey('pkcs8', servicePair.privateKey);
  const pem = Buffer.from(pkcs8).toString('base64').match(/.{1,64}/g).join('\n');
  env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    client_email: 'quiz-worker-test@freelance-arab.iam.gserviceaccount.com',
    private_key: `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----\n`
  });
});

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function firebaseToken({ email_verified = true, aud = projectId } = {}) {
  const header = encodeSegment({ alg: 'RS256', typ: 'JWT', kid: publicJwk.kid });
  const claims = encodeSegment({
    aud,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: 'student-1',
    email_verified,
    iat: Math.floor(now / 1000) - 30,
    auth_time: Math.floor(now / 1000) - 30,
    exp: Math.floor(now / 1000) + 3600
  });
  const signingInput = `${header}.${claims}`;
  const signature = await webcrypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${Buffer.from(signature).toString('base64url')}`;
}

function firestoreValue(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (value && typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, firestoreValue(item)])
    ) } };
  }
  return { nullValue: null };
}

function documentResponse(data) {
  return Response.json({
    name: 'test/document',
    fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)]))
  });
}

function createBackend({ existingAttempt = false, commitConflict = false } = {}) {
  const requests = [];
  let attemptExists = existingAttempt;
  const accessToken = 'test-google-access-token';

  const fetcher = async (input, init = {}) => {
    const url = new URL(input);
    requests.push({ url: url.toString(), init });
    if (url.toString().startsWith('https://www.googleapis.com/service_accounts/v1/jwk/')) {
      return Response.json({ keys: [publicJwk] }, { headers: { 'cache-control': 'max-age=300' } });
    }
    if (url.toString() === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: accessToken, expires_in: 3600 });
    }
    if (url.pathname.endsWith('/documents:beginTransaction')) {
      return Response.json({ transaction: 'dGVzdC10cmFuc2FjdGlvbg==' });
    }
    if (url.pathname.endsWith('/documents:commit')) {
      const body = JSON.parse(init.body);
      assert.equal(body.writes.length, 1);
      assert.equal(body.writes[0].currentDocument.exists, false);
      if (commitConflict) {
        attemptExists = true;
        return Response.json({ error: { message: 'Transaction conflict' } }, { status: 409 });
      }
      attemptExists = true;
      return Response.json({});
    }
    if (url.pathname.includes('/documents/')) {
      const path = url.pathname.split('/documents/')[1].split('/').map(decodeURIComponent).join('/');
      if (path === 'users/student-1/quizAttempts/course-1__lesson-1') {
        return attemptExists
          ? documentResponse({ percentage: 50 })
          : new Response('{}', { status: 404 });
      }
      if (path === 'courses/course-1') return documentResponse({ status: 'published' });
      if (path === 'courses/course-1/lessons/lesson-1') return documentResponse({ isPublished: true });
      if (path === 'courses/course-1/lessons/lesson-1/quiz/current') {
        return documentResponse({
          version: 'quiz-v1',
          enabled: true,
          questions: [
            { id: 'q1', options: [{ id: 'yes' }, { id: 'no' }] },
            { id: 'q2', options: [{ id: 'yes' }, { id: 'no' }] },
            { id: 'q3', options: [{ id: 'yes' }, { id: 'no' }] },
            { id: 'q4', options: [{ id: 'yes' }, { id: 'no' }] }
          ]
        });
      }
      if (path === 'courses/course-1/lessons/lesson-1/answerKeys/current') {
        return documentResponse({
          version: 'quiz-v1',
          correctByQuestionId: { q1: 'yes', q2: 'no', q3: 'yes', q4: 'no' }
        });
      }
      throw new Error(`Unexpected Firestore document read: ${path}`);
    }
    throw new Error(`Unexpected backend request: ${url}`);
  };

  return { fetcher, requests, isAttemptSaved: () => attemptExists };
}

function createRequest({ method = 'POST', body, token, requestOrigin = origin } = {}) {
  const headers = {};
  if (requestOrigin) headers.origin = requestOrigin;
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request('https://quiz-worker.test/submitLessonQuiz', {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

test('preflight permits the site origin without accessing secrets or Firestore', async () => {
  const backend = createBackend();
  const worker = createQuizWorker({ fetcher: backend.fetcher, cryptoProvider: webcrypto, now: () => now });
  const response = await worker(createRequest({ method: 'OPTIONS' }), env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.match(response.headers.get('access-control-allow-headers'), /authorization/i);
  assert.equal(backend.requests.length, 0);
});

test('rejects unapproved browser origins', async () => {
  const backend = createBackend();
  const worker = createQuizWorker({ fetcher: backend.fetcher, cryptoProvider: webcrypto, now: () => now });
  const response = await worker(createRequest({ requestOrigin: 'https://attacker.example' }), env);

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(backend.requests.length, 0);
});

test('requires a valid Firebase ID token', async () => {
  const backend = createBackend();
  const worker = createQuizWorker({ fetcher: backend.fetcher, cryptoProvider: webcrypto, now: () => now });
  const response = await worker(createRequest({ body: {} }), env);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'unauthenticated');
  assert.equal(backend.requests.length, 0);
});

test('requires verified email claims from the Firebase-signed token', async () => {
  const backend = createBackend();
  const worker = createQuizWorker({ fetcher: backend.fetcher, cryptoProvider: webcrypto, now: () => now });
  const token = await firebaseToken({ email_verified: false });
  const response = await worker(createRequest({ body: {}, token }), env);

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'permission-denied');
  assert.equal(backend.requests.some(({ url }) => url.startsWith('https://firestore.googleapis.com/')), false);
});

test('rejects a correctly signed token issued for a different Firebase project', async () => {
  const backend = createBackend();
  const worker = createQuizWorker({ fetcher: backend.fetcher, cryptoProvider: webcrypto, now: () => now });
  const token = await firebaseToken({ aud: 'other-project' });
  const response = await worker(createRequest({ body: {}, token }), env);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'unauthenticated');
  assert.equal(backend.requests.some(({ url }) => url.startsWith('https://firestore.googleapis.com/')), false);
});

test('grades on the server and creates exactly one attempt transactionally', async () => {
  const backend = createBackend();
  const worker = createQuizWorker({ fetcher: backend.fetcher, cryptoProvider: webcrypto, now: () => now });
  const token = await firebaseToken();
  const response = await worker(createRequest({
    token,
    body: {
      courseId: 'course-1',
      lessonId: 'lesson-1',
      answers: { q1: 'yes', q2: 'yes', q3: 'no', q4: 'no' }
    }
  }), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    courseId: 'course-1',
    lessonId: 'lesson-1',
    correct: 2,
    total: 4,
    percentage: 50,
    passPercent: 50,
    passed: true
  });
  assert.equal(backend.isAttemptSaved(), true);
});

test('does not allow a second attempt', async () => {
  const backend = createBackend({ existingAttempt: true });
  const worker = createQuizWorker({ fetcher: backend.fetcher, cryptoProvider: webcrypto, now: () => now });
  const token = await firebaseToken();
  const response = await worker(createRequest({
    token,
    body: {
      courseId: 'course-1',
      lessonId: 'lesson-1',
      answers: { q1: 'yes', q2: 'yes', q3: 'no', q4: 'no' }
    }
  }), env);

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'already-exists');
  assert.equal(backend.requests.some(({ url }) => url.endsWith('/documents:commit')), false);
});

test('reports a concurrent submission as already used when the transaction loses its race', async () => {
  const backend = createBackend({ commitConflict: true });
  const worker = createQuizWorker({ fetcher: backend.fetcher, cryptoProvider: webcrypto, now: () => now });
  const token = await firebaseToken();
  const response = await worker(createRequest({
    token,
    body: {
      courseId: 'course-1',
      lessonId: 'lesson-1',
      answers: { q1: 'yes', q2: 'yes', q3: 'no', q4: 'no' }
    }
  }), env);

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'already-exists');
});

test('validates answer choices without committing an attempt', async () => {
  const backend = createBackend();
  const worker = createQuizWorker({ fetcher: backend.fetcher, cryptoProvider: webcrypto, now: () => now });
  const token = await firebaseToken();
  const response = await worker(createRequest({
    token,
    body: {
      courseId: 'course-1',
      lessonId: 'lesson-1',
      answers: { q1: 'yes', q2: 'yes', q3: 'invalid', q4: 'no' }
    }
  }), env);

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid-argument');
  assert.equal(backend.requests.some(({ url }) => url.endsWith('/documents:commit')), false);
});
