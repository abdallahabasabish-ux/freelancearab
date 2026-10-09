/* ============================================================
   course.js — صفحة تفاصيل الكورس
   جلب الكورس → SEO ديناميكي (Meta + JSON-LD) → عرض كامل
   ============================================================ */

import {
  fetchCourseById, getThumb, escapeHtml, durationText,
  formatDuration, LEVELS
} from './courses-data.js';
import { lazyImg } from './lazy.js';
import { setPageSEO, setCourseJSONLD } from './seo.js';
import { waitForAuth, initHeaderAuth } from './auth.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);

initHeaderAuth();

const courseId = new URLSearchParams(location.search).get('id');
if (!courseId) {
  location.replace('/courses.html');
} else {
  main();
}

async function main() {
  let course = null;
  try {
    course = await fetchCourseById(courseId);
  } catch (err) {
    /* مسودة أو غير موجود → قواعد الأمان ترفض القراءة */
    console.warn(err.code);
  }

  if (!course || course.status !== 'published') {
    renderNotFound();
    return;
  }

  renderSEO(course);
  renderHero(course);
  renderAbout(course);
  renderSidebar(course);
  renderCurriculum(course);
  bindShare(course);
  await setupCTA(course);

  /* إظهار المحتوى وإخفاء الهيكل المؤقت */
  $('#skeletonView').hidden = true;
  $('#courseHero').hidden = false;
  $('#courseLayout').hidden = false;
}

/* ============ SEO الديناميكي ============ */
function renderSEO(course) {
  const thumb = getThumb(course) || undefined;
  const pageURL = `${location.origin}/course.html?id=${course.id}`;

  setPageSEO({
    title: course.title,
    description: course.shortDesc || (course.description || '').slice(0, 155),
    image: thumb,
    url: pageURL,
    type: 'website'
  });

  setCourseJSONLD(course, thumb);
}

/* ============ الترويسة ============ */
function renderHero(course) {
  $('#crumbTitle').textContent = course.title;
  $('#courseTitle').textContent = course.title;

  const items = [
    ['i-play-circle', `${course.lessonsCount || 0} درساً`],
    ['i-clock',       durationText(course)],
    ['i-target',      LEVELS[course.level]?.label || 'جميع المستويات'],
    ['i-book-open',   course.category || 'عام']
  ];
  if (course.instructor) items.push(['i-user', `المدرّب: ${course.instructor}`]);

  $('#heroMeta').innerHTML = items.map(([ic, txt]) => `
    <span>
      <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#${ic}"></use></svg>
      ${escapeHtml(txt)}
    </span>`).join('');
}

/* ============ الوصف ============ */
function renderAbout(course) {
  const text = String(course.description || course.shortDesc || '').trim();
  $('#courseAbout').innerHTML = text
    ? text.split(/\n+/).filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('')
    : '<p>لم يُضف وصف لهذا الكورس بعد.</p>';
}

/* ============ العمود الجانبي ============ */
function renderSidebar(course) {
  /* الصورة المصغرة (فوق الطية → eager) */
  const thumb = getThumb(course);
  const thumbWrap = $('#sidebarThumb');
  if (thumb) {
    const img = lazyImg(thumb, course.title, { eager: true });
    img.className = 'course-thumb';
    img.addEventListener('error', () => img.remove(), { once: true });
    thumbWrap.appendChild(img);
  }

  const rows = [
    ['i-play-circle', 'عدد الدروس',  course.lessonsCount || 0],
    ['i-clock',       'المدة',       durationText(course)],
    ['i-target',      'المستوى',     LEVELS[course.level]?.label || 'جميع المستويات'],
    ['i-book-open',   'التصنيف',     course.category || 'عام'],
    ['i-award',       'شهادة إتمام', 'نعم']
  ];
  $('#sidebarStats').innerHTML = rows.map(([ic, k, v]) => `
    <li>
      <span>
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#${ic}"></use></svg>
        ${k}
      </span>
      <b>${escapeHtml(String(v))}</b>
    </li>`).join('');
}

/* ============ زر البدء حسب حالة المستخدم ============ */
async function setupCTA(course) {
  const btn = $('#ctaBtn');
  const user = await waitForAuth().catch(() => null);

  if (user) {
    const firstLesson = course.outline?.[0]?.lessons?.[0]?.id;
    btn.href = firstLesson
      ? `/lesson.html?course=${course.id}&lesson=${firstLesson}`
      : `/lesson.html?course=${course.id}`;
    btn.innerHTML = `
      ابدأ الكورس الآن
      <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-play"></use></svg>`;
  } else {
    btn.href = '/register.html';
    btn.innerHTML = `
      أنشئ حساباً مجانياً وابدأ
      <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-zap"></use></svg>`;
  }
}

/* ============ المنهج ============ */
function renderCurriculum(course) {
  const wrap = $('#curriculum');
  const note = $('#curriculumNote');
  const outline = Array.isArray(course.outline) ? course.outline : [];

  /* لا توجد مخطط جاهز — اعرض الفصول فقط أو رسالة */
  if (!outline.length) {
    const modules = Array.isArray(course.modules) ? course.modules : [];
    if (modules.length) {
      note.textContent = 'فصول الكورس — تفاصيل الدروس تظهر داخل صفحة كل درس.';
      wrap.innerHTML = modules.map((m, i) => `
        <details class="module" ${i === 0 ? 'open' : ''}>
          <summary>
            <span class="module-info">
              <span class="module-num">${i + 1}</span>
              <span class="module-title">${escapeHtml(m.title || `الفصل ${i + 1}`)}</span>
            </span>
            <span class="module-count">فصل</span>
          </summary>
        </details>`).join('');
    } else {
      note.textContent = '';
      wrap.innerHTML = '<p class="curriculum-note">سيتم نشر المنهج التفصيلي قريباً.</p>';
    }
    return;
  }

  const totalLessons = course.lessonsCount ||
    outline.reduce((n, m) => n + (m.lessons?.length || 0), 0);
  note.textContent = `${outline.length} فصول • ${totalLessons} درساً • متاح فور التسجيل`;

  wrap.innerHTML = outline.map((mod, i) => `
    <details class="module" ${i === 0 ? 'open' : ''}>
      <summary>
        <span class="module-info">
          <span class="module-num">${i + 1}</span>
          <span class="module-title">${escapeHtml(mod.title || `الفصل ${i + 1}`)}</span>
        </span>
        <span class="module-info">
          <span class="module-count">${mod.lessons?.length || 0} دروس</span>
          <svg class="icon chev" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-chevron-down"></use></svg>
        </span>
      </summary>
      <ul class="lesson-list">
        ${(mod.lessons || []).map((l) => `
          <li class="lesson-row">
            <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-play-circle"></use></svg>
            <span class="lesson-title">${escapeHtml(l.title || 'درس')}</span>
            ${l.durationSec ? `<span class="lesson-duration">${formatDuration(l.durationSec)}</span>` : ''}
          </li>`).join('') || '<li class="lesson-row"><span class="lesson-title">دروس هذا الفصل قيد الإضافة</span></li>'}
      </ul>
    </details>`).join('');
}

/* ============ المشاركة ============ */
function bindShare(course) {
  const url  = `${location.origin}/course.html?id=${course.id}`;
  const text = `${course.title} — كورس مجاني في أكاديمية عرب فريلانسر`;

  $('#shareWa').href = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  $('#shareX').href  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  $('#shareCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('تم نسخ رابط الكورس.', 'success');
    } catch {
      toast('تعذر النسخ — انسخ الرابط من شريط العنوان.', 'warning');
    }
  });
}

/* ============ حالة عدم التوفر ============ */
function renderNotFound() {
  $('#skeletonView').hidden = true;
  $('#notFound').hidden = false;
  setPageSEO({
    title: 'الكورس غير متوفر',
    description: 'الكورس المطلوب غير متاح حالياً — تصفح كورساتنا المتاحة مجاناً.'
  });
}
