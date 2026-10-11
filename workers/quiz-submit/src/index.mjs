const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const QUESTION_COUNT = 4;
const PASS_PERCENT = 50;
const MAX_REQUEST_BYTES = 16 * 1024;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function base64UrlEncode(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function decodeJsonSegment(segment) {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment)));
}

function encodePem(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  return base64UrlDecode(body.replace(/\+/g, '-').replace(/\//g, '_'));
}

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isSafeInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number' && Number.isFinite(value)) return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, firestoreValue(entry)])
    ) } };
  }
  throw new ApiError(400, 'invalid-argument', 'بيانات الاختبار غير صالحة.');
}

function fromFirestoreValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields || {});
  return undefined;
}

function fromFirestoreFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)])
  );
}

function documentUrl(projectId, path, suffix = '') {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    `/databases/(default)/documents/${encodedPath}${suffix}`;
}

function documentsOperationUrl(projectId, operation) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    `/databases/(default)/documents:${operation}`;
}

function tokenError() {
  return new ApiError(401, 'unauthenticated', 'سجّل الدخول مجدداً لإرسال الاختبار.');
}

function getBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match || match[1].length > 8192) throw tokenError();
  return match[1];
}

function parseErrorResponse(response, fallback) {
  return response.text().then((text) => {
    let detail = text.slice(0, 1000);
    try {
      const parsed = JSON.parse(text);
      detail = parsed.error?.message || parsed.message || detail;
    } catch {
      // Preserve a short server response for operational diagnostics.
    }
    const error = new Error(`${fallback}: ${detail}`);
    error.status = response.status;
    return error;
  });
}

export function createQuizWorker({
  fetcher = fetch,
  cryptoProvider = crypto,
  now = () => Date.now()
} = {}) {
  let jwksCache;
  let serviceTokenCache;

  async function getJwks() {
    if (jwksCache && jwksCache.expiresAt > now()) return jwksCache.keys;
    const response = await fetcher(FIREBASE_JWKS_URL);
    if (!response.ok) throw new Error(`Firebase signing keys unavailable (${response.status}).`);
    const body = await response.json();
    const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300);
    jwksCache = { keys: body.keys || [], expiresAt: now() + maxAge * 1000 };
    return jwksCache.keys;
  }

  async function verifyFirebaseToken(token, projectId) {
    const parts = token.split('.');
    if (parts.length !== 3) throw tokenError();

    let header;
    let claims;
    try {
      header = decodeJsonSegment(parts[0]);
      claims = decodeJsonSegment(parts[1]);
    } catch {
      throw tokenError();
    }

    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw tokenError();
    let keys = await getJwks();
    let key = keys.find((candidate) => candidate.kid === header.kid && candidate.alg === 'RS256');
    if (!key) {
      jwksCache = null;
      keys = await getJwks();
      key = keys.find((candidate) => candidate.kid === header.kid && candidate.alg === 'RS256');
    }
    if (!key) throw tokenError();

    let validSignature = false;
    try {
      const publicKey = await cryptoProvider.subtle.importKey(
        'jwk',
        key,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      validSignature = await cryptoProvider.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        base64UrlDecode(parts[2]),
        new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
      );
    } catch {
      throw tokenError();
    }

    const currentTime = Math.floor(now() / 1000);
    if (!validSignature ||
        claims.aud !== projectId ||
        claims.iss !== `https://securetoken.google.com/${projectId}` ||
        typeof claims.sub !== 'string' ||
        claims.sub.length < 1 ||
        claims.sub.length > 128 ||
        !Number.isInteger(claims.exp) ||
        claims.exp <= currentTime ||
        !Number.isInteger(claims.iat) ||
        claims.iat > currentTime + 300 ||
        !Number.isInteger(claims.auth_time) ||
        claims.auth_time > currentTime + 300 ||
        claims.email_verified !== true) {
      if (claims.email_verified !== true && validSignature) {
        throw new ApiError(403, 'permission-denied', 'يجب تأكيد البريد الإلكتروني.');
      }
      throw tokenError();
    }
    return claims.sub;
  }

  async function getGoogleAccessToken(env) {
    if (serviceTokenCache && serviceTokenCache.expiresAt > now() + 60_000) {
      return serviceTokenCache.token;
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '');
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT secret is not valid JSON.');
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT must include client_email and private_key.');
    }

    const issuedAt = Math.floor(now() / 1000);
    const assertionHeader = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const assertionClaims = base64UrlEncode(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: FIRESTORE_SCOPE,
      aud: OAUTH_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600
    }));
    const unsignedAssertion = `${assertionHeader}.${assertionClaims}`;
    const privateKey = await cryptoProvider.subtle.importKey(
      'pkcs8',
      encodePem(serviceAccount.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await cryptoProvider.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(unsignedAssertion)
    );
    const assertion = `${unsignedAssertion}.${base64UrlEncode(new Uint8Array(signature))}`;
    const response = await fetcher(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      })
    });
    if (!response.ok) throw await parseErrorResponse(response, 'Google OAuth token request failed');
    const tokenData = await response.json();
    if (typeof tokenData.access_token !== 'string' || !Number.isFinite(tokenData.expires_in)) {
      throw new Error('Google OAuth returned an invalid access token.');
    }
    serviceTokenCache = {
      token: tokenData.access_token,
      expiresAt: now() + tokenData.expires_in * 1000
    };
    return tokenData.access_token;
  }

  async function firestoreRequest(url, accessToken, init = {}) {
    const response = await fetcher(url, {
      ...init,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers
      }
    });
    if (!response.ok) throw await parseErrorResponse(response, 'Firestore request failed');
    if (response.status === 204) return null;
    return response.json();
  }

  async function getDocument(projectId, path, transaction, accessToken) {
    const suffix = transaction ? `?transaction=${encodeURIComponent(transaction)}` : '';
    const response = await fetcher(documentUrl(projectId, path, suffix), {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (response.status === 404) return null;
    if (!response.ok) throw await parseErrorResponse(response, `Firestore read failed for ${path}`);
    const document = await response.json();
    return { name: document.name, data: fromFirestoreFields(document.fields) };
  }

  async function submitQuiz(request, env) {
    const projectId = env.FIREBASE_PROJECT_ID;
    if (!projectId || !env.FIREBASE_SERVICE_ACCOUNT) {
      throw new ApiError(503, 'unavailable', 'خدمة تصحيح الاختبارات غير مهيأة بعد.');
    }

    const requestBody = await request.arrayBuffer();
    if (requestBody.byteLength > MAX_REQUEST_BYTES) {
      throw new ApiError(413, 'invalid-argument', 'حجم طلب الاختبار أكبر من المسموح.');
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      throw new ApiError(415, 'invalid-argument', 'يجب إرسال الإجابات بصيغة JSON.');
    }
    const uid = await verifyFirebaseToken(getBearerToken(request), projectId);

    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(requestBody));
    } catch {
      throw new ApiError(400, 'invalid-argument', 'صيغة طلب الاختبار غير صالحة.');
    }
    const { courseId, lessonId, answers } = payload || {};
    const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
    if (!validId(courseId) || !validId(lessonId)) {
      throw new ApiError(400, 'invalid-argument', 'معرّف الكورس أو الدرس غير صالح.');
    }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new ApiError(400, 'invalid-argument', 'الإجابات غير صالحة.');
    }

    const basePath = `courses/${courseId}/lessons/${lessonId}`;
    const attemptId = `${courseId}__${lessonId}`;
    const token = await getGoogleAccessToken(env);
    const transactionResult = await firestoreRequest(
      documentsOperationUrl(projectId, 'beginTransaction'),
      token,
      { method: 'POST', body: JSON.stringify({ options: { readWrite: {} } }) }
    );
    const transaction = transactionResult.transaction;
    if (typeof transaction !== 'string') throw new Error('Firestore did not return a transaction ID.');

    const [attempt, course, lesson, quiz, key] = await Promise.all([
      getDocument(projectId, `users/${uid}/quizAttempts/${attemptId}`, transaction, token),
      getDocument(projectId, `courses/${courseId}`, transaction, token),
      getDocument(projectId, `${basePath}`, transaction, token),
      getDocument(projectId, `${basePath}/quiz/current`, transaction, token),
      getDocument(projectId, `${basePath}/answerKeys/current`, transaction, token)
    ]);

    if (attempt) throw new ApiError(409, 'already-exists', 'تم استخدام المحاولة الوحيدة لهذا الاختبار.');
    if (!course || course.data.status !== 'published' || !lesson || lesson.data.isPublished !== true) {
      throw new ApiError(412, 'failed-precondition', 'الكورس أو الدرس غير منشور.');
    }
    if (!quiz || !key) throw new ApiError(404, 'not-found', 'اختبار هذا الدرس غير متاح.');

    const questions = quiz.data.questions;
    const correctAnswers = key.data.correctByQuestionId;
    if (quiz.data.enabled !== true ||
        !Array.isArray(questions) ||
        questions.length !== QUESTION_COUNT ||
        quiz.data.version !== key.data.version ||
        !correctAnswers ||
        typeof correctAnswers !== 'object' ||
        Array.isArray(correctAnswers)) {
      throw new ApiError(412, 'failed-precondition', 'إعداد الاختبار غير مكتمل.');
    }
    if (Object.keys(answers).length !== QUESTION_COUNT) {
      throw new ApiError(400, 'invalid-argument', 'أجب عن الأسئلة الأربعة قبل التسليم.');
    }

    let correct = 0;
    for (const question of questions) {
      const selected = answers[question.id];
      const allowedOptions = Array.isArray(question.options)
        ? question.options.map((option) => option.id)
        : [];
      if (!question.id ||
          typeof selected !== 'string' ||
          !allowedOptions.includes(selected) ||
          typeof correctAnswers[question.id] !== 'string') {
        throw new ApiError(400, 'invalid-argument', 'تحتوي الإجابات على اختيار غير صالح.');
      }
      if (selected === correctAnswers[question.id]) correct += 1;
    }

    const result = {
      courseId,
      lessonId,
      correct,
      total: QUESTION_COUNT,
      percentage: Math.round((correct / QUESTION_COUNT) * 100),
      passPercent: PASS_PERCENT,
      passed: Math.round((correct / QUESTION_COUNT) * 100) >= PASS_PERCENT
    };
    const attemptPath = `users/${uid}/quizAttempts/${attemptId}`;
    const attemptName = documentUrl(projectId, attemptPath);
    const fields = Object.fromEntries(
      Object.entries(result).map(([field, value]) => [field, firestoreValue(value)])
    );

    try {
      await firestoreRequest(documentsOperationUrl(projectId, 'commit'), token, {
        method: 'POST',
        body: JSON.stringify({
          transaction,
          writes: [{
            update: { name: attemptName, fields },
            currentDocument: { exists: false },
            updateTransforms: [{ fieldPath: 'submittedAt', setToServerValue: 'REQUEST_TIME' }]
          }]
        })
      });
    } catch (error) {
      const savedAttempt = await getDocument(projectId, attemptPath, null, token);
      if (savedAttempt) {
        throw new ApiError(409, 'already-exists', 'تم استخدام المحاولة الوحيدة لهذا الاختبار.');
      }
      throw error;
    }

    return result;
  }

  return async function handleRequest(request, env) {
    const allowedOrigins = new Set((env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));
    const origin = request.headers.get('origin');
    const allowedOrigin = origin && allowedOrigins.has(origin);
    const corsHeaders = allowedOrigin
      ? {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-max-age': '86400',
          vary: 'Origin'
        }
      : { vary: 'Origin' };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: allowedOrigin ? 204 : 403,
        headers: corsHeaders
      });
    }
    if (new URL(request.url).pathname !== '/submitLessonQuiz') {
      return jsonResponse(404, { code: 'not-found', message: 'المسار غير متاح.' }, corsHeaders);
    }
    if (request.method !== 'POST') {
      return jsonResponse(405, { code: 'method-not-allowed', message: 'طريقة الطلب غير مدعومة.' }, {
        ...corsHeaders,
        allow: 'POST, OPTIONS'
      });
    }
    if (!allowedOrigin) {
      return jsonResponse(403, { code: 'permission-denied', message: 'مصدر الطلب غير مسموح.' }, corsHeaders);
    }

    try {
      const result = await submitQuiz(request, env);
      return jsonResponse(200, result, corsHeaders);
    } catch (error) {
      if (error instanceof ApiError) {
        return jsonResponse(error.status, { code: error.code, message: error.message }, corsHeaders);
      }
      console.error('Quiz submission failed', {
        status: error?.status || null,
        type: error?.name || 'Error'
      });
      return jsonResponse(500, {
        code: 'internal',
        message: 'تعذر تصحيح الاختبار بسبب خطأ داخلي.'
      }, corsHeaders);
    }
  };
}

function jsonResponse(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

export default createQuizWorker();
