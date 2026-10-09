/* ============================================================
   seo.js — تحديث Meta Tags ديناميكياً لكل كورس
   Title + Description + Open Graph + Twitter Card + Canonical
   + بيانات منظمة JSON-LD (Schema.org Course)
   ============================================================ */

const SITE_NAME     = 'أكاديمية عرب فريلانسر';
const SITE_URL      = 'https://courses.freelancearab.com';
const DEFAULT_IMAGE = `${SITE_URL}/assets/icons/icon-512.png`;

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * يحدّث وسوم الصفحة ديناميكياً.
 * @param {Object} o { title, description, image, url, type }
 */
export function setPageSEO({ title, description, image, url, type = 'website' }) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const desc      = (description || '').trim().slice(0, 160);
  const img       = image || DEFAULT_IMAGE;
  const link      = url || location.href;

  document.title = fullTitle;

  upsertMeta('name', 'description', desc);

  upsertMeta('property', 'og:title',       fullTitle);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:image',       img);
  upsertMeta('property', 'og:url',         link);
  upsertMeta('property', 'og:type',        type);
  upsertMeta('property', 'og:site_name',   SITE_NAME);
  upsertMeta('property', 'og:locale',      'ar_AR');

  upsertMeta('name', 'twitter:card',        'summary_large_image');
  upsertMeta('name', 'twitter:title',       fullTitle);
  upsertMeta('name', 'twitter:description', desc);
  upsertMeta('name', 'twitter:image',       img);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = link;
}

/** بيانات منظمة تظهر كنتيجة غنية في Google (Rich Result) */
export function setCourseJSONLD(course, image) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.shortDesc || course.description || '',
    inLanguage: 'ar',
    url: `${SITE_URL}/course.html?id=${course.id}`,
    ...(image ? { image } : {}),
    provider: { '@type': 'Organization', name: SITE_NAME, sameAs: `${SITE_URL}/` },
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', category: 'Free' }
  };
  let el = document.getElementById('jsonld-course');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'jsonld-course';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}
