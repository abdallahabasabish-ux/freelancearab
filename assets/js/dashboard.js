/* ============================================================
   dashboard.js — لوحة الطالب
   إحصائيات + متابعة + كورساتي بأشرطة التقدم
   ============================================================ */

import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireAuth, initHeaderAuth } from './auth.js';
import { fetchAllProgress } from './progress.js';
import { fetchCourseById, getThumb, escapeHtml, durationText } from './courses-data.js';
import { lazyImg } from './lazy.js';

const $ = (s) => document.querySelector(s);
const toast = (m, t) => window.AFA?.toast(m, t);

const ctx = await requireAuth();
if (ctx) main(ctx);

async function main({ user, profile }) {
  initHeaderAuth({ user, profile });
  $('#firstName').textContent = (profile?.fullName || 'صديقنا').trim().split(/\s+/)[0];

  $('#statPoints').textContent = Number(profile?.points || 0);

  /* التقدم + الشهادات (استعلام الشهادات جاهز للمرحلة 5) */
  const [progressList, certsSnap] = await Promise.all([
    fetchAllProgress(user.uid).catch(() => []),
    getDocs(query(collection(db, 'certificates'), where('uid', '==', user.uid)))
      .catch(() => ({ docs: [] }))
  ]);

  $('#statCourses').textContent = progressList.length;
  $('#statLessons').textContent =
    progressList.reduce((n, p) => n + (p.completedLessons?.length || 0), 0);
  $('#statCerts').textContent = certsSnap.docs.length;

  if (!progressList.length) { $('#dashEmpty').hidden = false; return; }

  /* ربط كل تقدم ببيانات كورسه (قراءة/كورس) */
  const items = (await Promise.all(progressList.map(async (p) => {
    try {
      const c = await fetchCourseById(p.courseId);
      return (c && c.status === 'published') ? { p, c } : null;
    } catch { return null; }
  }))).filter(Boolean);

  if (!items.length) { $('#dashEmpty').hidden = false; return; }

  /* بطاقة المتابعة: أول كورس غير مكتمل (الأحدث نشاطاً) */
  const next = items.find(({ p }) => (p.progressPercent || 0) < 100) || items[0];
  renderContinue(next);

  /* شبكة كورساتي */
  const grid = $('#myCourses');
  items.forEach(({ p, c }) => grid.appendChild(renderMyCourse(p, c)));
}

/* ---------- بطاقة المتابعة ---------- */
function renderContinue({ p, c }) {
  const total = c.lessonsCount || 0;
  const done = p.completedLessons?.length || 0;
  const pct = p.progressPercent || 0;
  const thumb = getThumb(c);

  const card = $('#continueCard');
  card.innerHTML = `
    <div class="c-thumb" id="continueThumb">
      <svg class="icon icon-xl" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-graduation-cap"></use></svg>
    </div>
    <div class="c-body">
      <h3>${escapeHtml(c.title)}</h3>
      <div>
        <div class="progress-label"><span>تقدمك في الكورس</span><span>${pct}%</span></div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>
      <p class="c-sub">${done} من ${total} دروس • ${durationText(c)}</p>
      <a class="btn btn-accent" href="/lesson.html?course=${c.id}${p.lastLessonId ? `&lesson=${p.lastLessonId}` : ''}">
        متابعة التعلم
        <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-play"></use></svg>
      </a>
    </div>`;

  /* الصورة فوق الطية → eager */
  if (thumb) {
    const img = lazyImg(thumb, c.title, { eager: true });
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
    img.addEventListener('error', () => img.remove(), { once: true });
    $('#continueThumb').appendChild(img);
  }
  $('#continueSection').hidden = false;
}

/* ---------- بطاقة كورس في "كورساتي" ---------- */
function renderMyCourse(p, c) {
  const total = c.lessonsCount || 0;
  const done = p.completedLessons?.length || 0;
  const pct = p.progressPercent || 0;
  const isDone = pct >= 100;
  const thumb = getThumb(c);

  const el = document.createElement('article');
  el.className = 'my-course-card card';
  el.innerHTML = `
    <div class="mc-thumb">
      <span class="mc-percent">${pct}%</span>
      ${isDone ? '<span class="course-badge badge" style="background:var(--success);z-index:1;">مكتمل ✓</span>' : ''}
    </div>
    <div class="mc-body">
      <h3>${escapeHtml(c.title)}</h3>
      <div>
        <div class="progress-label"><span>${done} من ${total} دروس</span><span>${pct}%</span></div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>
      <div class="mc-actions">
        <a class="btn ${isDone ? 'btn-outline' : 'btn-primary'} btn-sm" href="/lesson.html?course=${c.id}${p.lastLessonId ? `&lesson=${p.lastLessonId}` : ''}">
          ${isDone ? 'مراجعة الدروس' : 'متابعة'}
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-play"></use></svg>
        </a>
        <a class="btn btn-ghost btn-sm" href="/course.html?id=${c.id}">تفاصيل</a>
      </div>
    </div>`;

  if (thumb) {
    const img = lazyImg(thumb, c.title);
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
    img.addEventListener('error', () => img.remove(), { once: true });
    el.querySelector('.mc-thumb').appendChild(img);
  }
  return el;
}
