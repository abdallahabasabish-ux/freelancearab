/* ============================================================
   lazy.js — Lazy Loading
   - صور تُحمّل عند الاقتراب من منطقة العرض (IntersectionObserver)
   - ظهور تدريجي (fade-in) بعد التحميل
   - مراقب تمرير للقوائم الطويلة (Infinite Scroll)
   ============================================================ */

let imgObserver = null;

function getImageObserver() {
  if (!imgObserver) {
    imgObserver = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const img = entry.target;
        obs.unobserve(img);
        if (img.dataset.src) {
          img.src = img.dataset.src;
          delete img.dataset.src;
        }
      }
    }, { rootMargin: '300px 0px' }); /* ابدأ التحميل قبل الوصول بـ 300px */
  }
  return imgObserver;
}

/**
 * إنشاء صورة مؤجلة التحميل.
 * @param {string} src رابط الصورة
 * @param {string} alt نص بديل
 * @param {Object} opts { eager: boolean } — eager للصور فوق الطية (LCP)
 */
export function lazyImg(src, alt = '', { eager = false } = {}) {
  const img = document.createElement('img');
  img.alt = alt;
  img.decoding = 'async';
  if (eager) {
    img.loading = 'eager';
    img.src = src;
  } else {
    img.loading = 'lazy';
    img.dataset.src = src;
    getImageObserver().observe(img);
  }
  img.addEventListener('load',  () => img.classList.add('loaded'));
  img.addEventListener('error', () => img.classList.add('failed'));
  return img;
}

/** تفعيل صور data-src موجودة مسبقاً في HTML ثابت */
export function observeLazyImages(root = document) {
  root.querySelectorAll('img[data-src]').forEach((img) => getImageObserver().observe(img));
}

/**
 * مراقب تمرير: ينادي callback عند ظهور عنصر الحارس (sentinel).
 * يعيد كائناً بـ disconnect() لإلغاء المراقبة.
 */
export function onSentinelVisible(sentinel, callback, { margin = '400px 0px' } = {}) {
  if (!sentinel || !('IntersectionObserver' in window)) {
    return { disconnect() {} };
  }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) callback();
  }, { rootMargin: margin });
  io.observe(sentinel);
  return { disconnect: () => io.disconnect() };
}
