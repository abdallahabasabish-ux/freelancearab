# إعداد اختبارات الحلقات

- كل حلقة جديدة تبدأ بأربعة أسئلة: سؤالان اختيار من متعدد وسؤالان صح/خطأ.
- يلزم إكمال نص السؤال والخيارات وتحديد الإجابة الصحيحة قبل نشر اختبار الحلقة.
- النجاح عند 50% أو أكثر؛ يلزم إجابتان صحيحتان على الأقل من أربعة.
- لكل طالب محاولة واحدة لكل حلقة؛ النتيجة تحفظ في `users/{uid}/quizAttempts/{courseId}__{lessonId}`.
- الأسئلة والخيارات متاحة للطالب، أما الإجابات الصحيحة فمحفوظة في `answerKeys/current` ومقصورة على الإدارة.

## النشر

1. فعّل خطة Firebase Blaze لمشروع `freelance-arab`.
2. ثبّت Firebase CLI وسجّل الدخول:

   ```sh
   npm install -g firebase-tools
   firebase login
   ```

3. ثبّت اعتماديات الدالة وانشرها مع قواعد Firestore:

   ```sh
   npm --prefix functions install
   firebase deploy --only functions,firestore:rules --project freelance-arab
   ```

4. ينشر GitHub Pages واجهات الإدارة والطالب من الفرع `main` عند رفع التغييرات.

لا تظهر الاختبارات للطلاب قبل نشر الدالة والقواعد. لا تنشئ مستندات المحاولات يدوياً؛ دالة `submitLessonQuiz` تنشئها ذرياً وتمنع إعادة المحاولة.
