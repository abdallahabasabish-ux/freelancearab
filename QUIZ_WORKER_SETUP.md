# إعداد خدمة تصحيح الاختبارات على الخطة المجانية

تعمل هذه الخدمة على Cloudflare Workers، وتستخدم Firebase Authentication للتحقق من المستخدم وFirestore لحفظ المحاولة. لا تستخدم Firebase Cloud Functions ولا تكشف مفتاح الإجابة للمتصفح. إعداد URL الخدمة موجود في `assets/js/quiz-api-config.js` ويبقى فارغاً حتى إتمام النشر.

## متطلبات الحسابات

- حساب Cloudflare يمكنه إنشاء Worker على الخطة المجانية.
- صلاحية إدارة حساب خدمة Google Cloud في مشروع `freelance-arab`.
- قاعدة Firestore الحالية مفعّلة في المشروع.

لا تضع ملف مفتاح حساب الخدمة أو رموز الدخول في المستودع، ولا ترسلها في المحادثات.

## تجهيز حساب الخدمة

أنشئ حساب خدمة مخصصاً للمصحح، مثلاً `quiz-submission-worker@freelance-arab.iam.gserviceaccount.com`، وامنحه دور `Cloud Datastore User` (`roles/datastore.user`) فقط. انتبه: هذا الدور يتيح لحامل بيانات الاعتماد قراءة وكتابة مستندات Firestore على مستوى المشروع، وقواعد Firestore لا تقيّد وصول IAM. الكود المنشور يقيّد المسارات التي يستخدمها هذا الـWorker، لكن تسريب مفتاحه قد يتيح وصولاً أوسع؛ لا تنشره إذا لم تكن مستعداً لحماية السر ومراقبته وتدويره عند الحاجة.

أنشئ مفتاح JSON لهذا الحساب واحفظه محلياً خارج المستودع. لا تستخدم مفتاح Firebase Admin لحساب شخصي أو لحساب يملك أدواراً أوسع.

## نشر Worker

من مجلد المشروع:

```sh
cd workers/quiz-submit
npx wrangler login
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
```

عند مطالبة السر، الصق محتوى ملف JSON لحساب الخدمة كاملاً. لا تضع محتواه في `wrangler.toml` أو أي ملف متعقّب.

ثم اختبر وانشر:

```sh
npm test
npx wrangler deploy
```

يظهر عنوان `workers.dev` بعد النشر. لا يمكن نشره نيابة عن مالك الحساب من هذه البيئة دون مصادقة Cloudflare.

## تفعيل الخدمة في الموقع

انسخ عنوان Worker، وأضف المسار `/submitLessonQuiz`، ثم ضعه في `assets/js/quiz-api-config.js`:

```js
export const quizSubmitEndpoint =
  'https://freelancearab-quiz-submit.<account-subdomain>.workers.dev/submitLessonQuiz';
```

استبدل `<account-subdomain>` بالنطاق الذي تعرضه نتيجة نشر Wrangler. ارفع تحديث الموقع بعد ضبط العنوان. لا تجعل الإعداد فارغاً في نسخة الإنتاج، وإلا ستعرض صفحة الدرس تنبيه أن الخدمة غير مهيأة.

## التحقق بعد النشر

يجب أن يرجع طلب `OPTIONS` من أصل `https://courses.freelancearab.com` الحالة `204` ورأس `Access-Control-Allow-Origin` المطابق. جرّب إرسال اختبار بحساب موثّق، ثم تأكد من ظهور محاولة واحدة في `users/{uid}/quizAttempts/{courseId}__{lessonId}`، وأن الإرسال الثاني يرجع `already-exists`.

لا تغيّر قواعد Firestore: القراءة والكتابة من Worker تتم بهوية حساب الخدمة عبر IAM، بينما تبقى المحاولات الشخصية غير قابلة للكتابة مباشرة من المتصفح وفق القواعد الحالية.

## التشغيل المحلي

```sh
cd workers/quiz-submit
npm test
npx wrangler dev
```

يتطلب التشغيل الوظيفي المحلي تعيين أسرار التطوير وبيانات Firestore صراحة. لا تستخدم بيانات مستخدمين إنتاجية للاختبار.
