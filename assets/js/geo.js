/* ============================================================
   geo.js — HTML5 Geolocation + ترميز جغرافي عكسي مجاني
   يُستخدم مرة واحدة عند تسجيل الملف لحفظ موقع الطالب.
   ============================================================ */

/**
 * يطلب موقع المستخدم ويعيد { lat, lng, accuracy, city, country }
 * أو يرفض بخطأ رسالته من GEO_MESSAGES
 */
export function requestLocation({ timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      return reject(Object.assign(new Error('UNSUPPORTED')));
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        let place = { country: null, city: null };
        try { place = await reverseGeocode(lat, lng); } catch { /* اختياري */ }
        resolve({
          lat: +lat.toFixed(6),
          lng: +lng.toFixed(6),
          accuracy: Math.round(accuracy),
          city: place.city,
          country: place.country,
          timestamp: Date.now()
        });
      },
      (err) => reject(Object.assign(new Error(err.code === 1 ? 'PERMISSION_DENIED' : err.code === 2 ? 'POSITION_UNAVAILABLE' : 'TIMEOUT'))),
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}

/* ترميز عكسي مجاني عبر OpenStreetMap Nominatim (بدون مفتاح) */
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=ar&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('GEOCODE_FAIL');
  const data = res.json ? await res.json() : {};
  const a = data.address || {};
  return { country: a.country || null, city: a.city || a.town || a.village || a.state || null };
}

export const GEO_MESSAGES = {
  UNSUPPORTED:         'متصفحك لا يدعم تحديد الموقع الجغرافي.',
  PERMISSION_DENIED:   'تم رفض إذن الموقع — يمكنك المتابعة بدونه أو تعديل الإذن من إعدادات المتصفح.',
  POSITION_UNAVAILABLE:'تعذر تحديد موقعك — تأكد من تشغيل خدمات الموقع في جهازك.',
  TIMEOUT:             'انتهت مهلة تحديد الموقع — حاول مرة أخرى.',
  UNKNOWN:             'حدث خطأ أثناء تحديد الموقع.'
};
