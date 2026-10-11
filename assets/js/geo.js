/* ============================================================
   geo.js — HTML5 Geolocation + ترميز جغرافي عكسي مجاني
   يُستخدم مرة واحدة عند تسجيل الملف لحفظ موقع الطالب.
   ============================================================ */

/**
 * يطلب موقع المستخدم بموافقته ويحفظ الدولة فقط لأغراض الإحصاء.
 * أو يرفض بخطأ رسالته من GEO_MESSAGES
 */
export function requestLocation({ timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      return reject(Object.assign(new Error('UNSUPPORTED')));
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let place = { country: null, countryCode: null };
        try { place = await reverseGeocode(lat, lng); } catch { /* اختياري */ }
        resolve({
          countryCode: place.countryCode,
          country: place.country
        });
      },
      (err) => reject(Object.assign(new Error(err.code === 1 ? 'PERMISSION_DENIED' : err.code === 2 ? 'POSITION_UNAVAILABLE' : 'TIMEOUT'))),
      { enableHighAccuracy: false, timeout, maximumAge: 0 }
    );
  });
}

/* ترميز عكسي مجاني عبر OpenStreetMap Nominatim (بدون مفتاح) */
async function reverseGeocode(lat, lng) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=ar&lat=${lat.toFixed(1)}&lon=${lng.toFixed(1)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error('GEOCODE_FAIL');
    const data = res.json ? await res.json() : {};
    const a = data.address || {};
    const countryCode = String(a.country_code || '').toUpperCase();
    return {
      country: a.country || null,
      countryCode: /^[A-Z]{2}$/.test(countryCode) ? countryCode : null
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const GEO_MESSAGES = {
  UNSUPPORTED:         'متصفحك لا يدعم تحديد الموقع الجغرافي.',
  PERMISSION_DENIED:   'تم رفض إذن الموقع — يمكنك المتابعة بدونه أو تعديل الإذن من إعدادات المتصفح.',
  POSITION_UNAVAILABLE:'تعذر تحديد موقعك — تأكد من تشغيل خدمات الموقع في جهازك.',
  TIMEOUT:             'انتهت مهلة تحديد الموقع — حاول مرة أخرى.',
  UNKNOWN:             'حدث خطأ أثناء تحديد الموقع.'
};
