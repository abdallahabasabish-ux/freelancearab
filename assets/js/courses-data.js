/* ============================================================
   courses-data.js — طبقة الوصول لبيانات الكورسات
   تُستخدم في: index.html (home.js) + courses.html + course.html
   ============================================================ */

import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where, limit, getDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { lazyImg } from './lazy.js';

/* أقصى عدد كورسات يُجلب في الطلب الواحد (يكفي لأي أكاديمية ناشئة) */
const MAX_COURSES = 100;

export const LEVELS = {
  beginner:     { label: 'مبتدئ' },
  intermediate: { label: 'متوسط' },
  advanced:     { label: 'متقدم' }
};

/* ============ أدوات مساعدة عامة ============ */

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* تطبيع النص العربي للبحث (همزات + تشكيل + تاء مربوطة) */
export function normalizeAr(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, '') /* حذف التشكيل */
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getYoutubeId(url = '') {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/* صورة مصغرة: مخصصة أو مشتقة من فيديو الإعلان أو بلا (تدرج لوني) */
export function getThumb(course) {
  if (course.thumbnailURL) return course.thumbnailURL;
  const vid = getYoutubeId(course.promoVideoURL || '');
  if (vid) return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
  return null;
}

export function durationText(course) {
  const h = Number(course.durationHours || 0);
  if (h > 0) {
    if (h === 1) return 'ساعة واحدة';
    if (h === 2) return 'ساعتان';
    return `${h} ساعات`;
  }
  return 'مدة مرنة';
}

export function formatDuration(sec = 0) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ============ استعلامات Firestore ============ */

/**
 * جلب كل الكورسات المنشورة.
 * where(status) فقط بدون orderBy → لا يحتاج أي Composite Index.
 * الترتيب يتم محلياً — تكلفة: قراءة واحدة لكل كورس لكل زيارة.
 */
export async function fetchPublishedCourses() {
  const q = query(
    collection(db, 'courses'),
    where('status', '==', 'published'),
    limit(MAX_COURSES)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

/** جلب كورس واحد بالمعرف (المسودات يرفضها الأمان → null) */
export async function fetchCourseById(id) {
  const snap = await getDoc(doc(db, 'courses', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* ============ عرض: بطاقة كورس ============ */

export function renderCourseCard(course) {
  const el = document.createElement('a');
  el.className = 'course-card card';
  el.href = `/course.html?id=${course.id}`;
  el.setAttribute('aria-label', course.title);

  const level = LEVELS[course.level];
  const thumb = getThumb(course);

  el.innerHTML = `
    <div class="course-media">
      <span class="course-badge">${level ? level.label : 'مفتوح للجميع'}</span>
    </div>
    <div class="course-body">
      <h3>${escapeHtml(course.title)}</h3>
      ${course.shortDesc ? `<p class="course-desc">${escapeHtml(course.shortDesc)}</p>` : ''}
      <div class="course-meta">
        <span>
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-play-circle"></use></svg>
          ${course.lessonsCount || 0} درساً
        </span>
        <span>
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-clock"></use></svg>
          ${durationText(course)}
        </span>
        <span>
          <svg class="icon" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-book-open"></use></svg>
          ${escapeHtml(course.category || 'عام')}
        </span>
      </div>
      <div class="course-footer">
        <span class="price-tag">مجاني</span>
        <span class="btn btn-outline btn-sm">تفاصيل الكورس</span>
      </div>
    </div>`;

  if (thumb) {
    const img = lazyImg(thumb, course.title);
    img.className = 'course-thumb';
    img.addEventListener('error', () => img.remove(), { once: true });
    el.querySelector('.course-media').appendChild(img);
  }
  return el;
}
