/* ============================================================
   أكاديمية عرب فريلانسر — Service Worker
   sw.js | الإصدار 1.0.0
   الاستراتيجية:
   - صفحات التنقل: Network First → Cache → offline.html
   - CSS/JS والخطوط: Stale-While-Revalidate
   - الصور: Cache First
   - طلبات Firebase/Auth: تمرير مباشر دون تخزين أبداً
   ============================================================ */

const VERSION = 'v1.0.5';
const STATIC_CACHE  = `afa-static-${VERSION}`;
const PAGES_CACHE   = `afa-pages-${VERSION}`;
const IMAGES_CACHE  = `afa-images-${VERSION}`;
const FONTS_CACHE   = `afa-fonts-${VERSION}`;
const ALL_CACHES    = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE, FONTS_CACHE];

/* الملفات الأساسية التي تُخزن مسبقاً عند التثبيت */
const PRECACHE_URLS = [
  '/', '/index.html', '/offline.html', '/404.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/firebase-config.js',
  '/assets/js/theme.js',
  '/assets/js/main.js',
  '/assets/icons/sprite.svg',
  '/assets/icons/icon.svg',
  '/assets/icons/maskable-icon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/maskable-512.png'
];

/* ---------- التثبيت: تخزين الملفات الأساسية ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) =>
        // allSettled: لا يفشل التثبيت إذا لم يوجد ملف (مثل PNGs قبل توليدها)
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

/* ---------- التفعيل: تنظيف الكاشات القديمة ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !ALL_CACHES.includes(key))
              .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- استقبال أمر تحديث فوري ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------- اعتراض الطلبات ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* 1) طلبات Firebase وGoogle: تمرير مباشر (بيانات حية + أمان) */
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('apis.google.com') ||
    url.hostname.includes('accounts.google.com')
  ) return;

  /* 2) التنقل بين الصفحات: الشبكة أولاً */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  /* 3) خطوط Google: كاش أولاً */
  if (url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONTS_CACHE));
    return;
  }
  if (url.origin === 'https://fonts.googleapis.com') {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  /* أي مصدر خارجي آخر: بدون تدخل */
  if (url.origin !== location.origin) return;

  /* 4) الصور: كاش أولاً */
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, IMAGES_CACHE));
    return;
  }

  /* 5) CSS و JS: كاش مع تحديث بالخلفية */
  if (request.destination === 'style' || request.destination === 'script') {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  /* 6) الباقي (sprite / manifest / json...) */
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

/* ---------- دوال مساعدة ---------- */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(cacheName)
          .then((cache) => cache.put(request, copy))
          .catch(() => {});
      }
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}
