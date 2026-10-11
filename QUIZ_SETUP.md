# إعداد اختبارات الحلقات

- كل حلقة جديدة تبدأ بأربعة أسئلة: سؤالان اختيار من متعدد وسؤالان صح/خطأ.
- يلزم إكمال نص السؤال والخيارات وتحديد الإجابة الصحيحة قبل نشر اختبار الحلقة.
- النجاح عند 50% أو أكثر؛ يلزم إجابتان صحيحتان على الأقل من أربعة.
- لكل طالب محاولة واحدة لكل حلقة؛ النتيجة تحفظ في `users/{uid}/quizAttempts/{courseId}__{lessonId}`.
- الأسئلة والخيارات متاحة للطالب، أما الإجابات الصحيحة فمحفوظة في `answerKeys/current` ومقصورة على الإدارة.

## النشر

1. اتبع خطوات إعداد Cloudflare Worker وحساب الخدمة في [QUIZ_WORKER_SETUP.md](./QUIZ_WORKER_SETUP.md). هذا المسار لا يتطلب نشر Firebase Cloud Functions أو ترقية Firebase إلى Blaze.
2. شغّل اختبارات Worker قبل النشر:

   ```sh
   cd workers/quiz-submit
   npm ci
   npm test
   npx wrangler login
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
   npx wrangler deploy
   ```

3. انسخ عنوان `workers.dev` الناتج إلى `assets/js/quiz-api-config.js`:

   ```js
   export const quizSubmitEndpoint =
     'https://freelancearab-quiz-submit.<account-subdomain>.workers.dev/submitLessonQuiz';
   ```

4. ارفع تحديث الموقع. بعد نشر الواجهة، جرّب إرسال اختبار بحساب موثّق وتأكد من حفظ محاولة واحدة فقط في `users/{uid}/quizAttempts/{courseId}__{lessonId}`.

لا تظهر الاختبارات للطلاب قبل تفعيل Worker وضبط عنوانه في الواجهة. لا تنشئ مستندات المحاولات يدوياً؛ Worker يصحح الإجابات على الخادم وينشئ المحاولة ذرياً ويمنع إعادتها.
