/* ============================================================
   home.js — يعبّئ شبكة الكورسات في index.html
   يعرض أحدث 6 كورسات منشورة (استعلام واحد من Firestore)
   ============================================================ */

import { fetchPublishedCourses, renderCourseCard } from './courses-data.js';

const grid = document.getElementById('coursesGrid');

if (grid) {
  try {
    const courses = await fetchPublishedCourses();
    grid.innerHTML = '';

    if (!courses.length) {
      grid.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <svg class="icon icon-xl" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-graduation-cap"></use></svg>
          <h3>الكورسات قادمة قريباً!</h3>
          <p>فريقنا يحضّر لك محتوى مميزاً — سجّل الآن ليصلك كل جديد.</p>
          <a href="/register.html" class="btn btn-accent">أنشئ حسابك المجاني</a>
        </div>`;
    } else {
      courses.slice(0, 6).forEach((c) => grid.appendChild(renderCourseCard(c)));

      if (courses.length > 6) {
        const more = document.createElement('div');
        more.className = 'home-more';
        more.innerHTML = `
          <a href="/courses.html" class="btn btn-outline">
            استعرض جميع الكورسات
            <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-arrow-left"></use></svg>
          </a>`;
        grid.after(more);
      }
    }
  } catch (err) {
    console.error(err);
    grid.innerHTML = `
      <div class="error-state" style="padding: 2.5rem 1rem;">
        <svg class="icon icon-xl" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-wifi-off"></use></svg>
        <h3>تعذر تحميل الكورسات</h3>
        <a href="/courses.html" class="btn btn-primary">الانتقال لصفحة الكورسات</a>
      </div>`;
  }
}
