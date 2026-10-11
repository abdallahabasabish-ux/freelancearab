import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const section = document.getElementById('subscriberGeo');
if (section) {
  const mapElement = document.getElementById('subscriberWorldMap');
  const mapStatus = document.getElementById('geoMapStatus');
  const list = document.getElementById('geoCountryList');
  const retryButton = document.getElementById('geoRetry');
  let loading = false;
  let leafletMap = null;
  let markers = new Map();
  let loadedCounts = [];

  const countryCenters = {
    AE: [24.45, 54.37], AU: [-25.0, 133.0], BH: [26.07, 50.55], BR: [-10.0, -55.0],
    CA: [56.0, -106.0], CH: [46.8, 8.2], CN: [35.0, 103.0], DE: [51.0, 10.0],
    DJ: [11.8, 42.6], DZ: [28.0, 2.6], EG: [26.8, 30.8], ES: [40.0, -4.0],
    FR: [46.0, 2.0], GB: [54.0, -2.0], ID: [-2.0, 118.0], IN: [22.0, 79.0],
    IQ: [33.0, 44.0], IR: [32.0, 53.0], IT: [42.8, 12.8], JO: [31.2, 36.0],
    JP: [36.0, 138.0], KE: [0.5, 37.5], KM: [-11.7, 43.3], KR: [36.0, 128.0],
    KW: [29.4, 47.7], LB: [33.9, 35.9], LY: [26.0, 17.0], MA: [32.0, -6.0],
    MX: [23.0, -102.0], MY: [4.0, 102.0], NG: [10.0, 8.0], NL: [52.0, 5.0],
    NO: [62.0, 10.0], NZ: [-41.0, 174.0], OM: [21.0, 57.0], PH: [13.0, 122.0],
    PK: [30.0, 70.0], PS: [31.9, 35.2], QA: [25.3, 51.2], RU: [61.0, 100.0],
    SA: [24.0, 45.0], SD: [15.0, 30.0], SE: [62.0, 15.0], SG: [1.3, 103.8],
    SO: [5.0, 46.0], SY: [35.0, 38.5], TH: [15.0, 101.0], TN: [34.0, 9.0],
    TR: [39.0, 35.0], TW: [23.7, 121.0], UA: [49.0, 32.0], US: [39.8, -98.6],
    YE: [15.5, 47.5], ZA: [-29.0, 24.0]
  };

  function showMapMessage(message, { error = false, retry = false } = {}) {
    mapStatus.textContent = message;
    mapStatus.hidden = false;
    mapStatus.classList.toggle('is-error', error);
    retryButton.hidden = !retry;
  }

  function appendEmptyMessage(message) {
    const item = document.createElement('li');
    item.className = 'geo-country-empty';
    item.textContent = message;
    list.replaceChildren(item);
  }

  function updateSummary(stats) {
    document.getElementById('geoTotalSubscribers').textContent =
      Number(stats.totalSubscribers || 0).toLocaleString('ar-EG');
    document.getElementById('geoOptInSubscribers').textContent =
      Number(stats.geoOptInSubscribers || 0).toLocaleString('ar-EG');
    document.getElementById('geoCountryTotal').textContent =
      stats.countryCounts.length.toLocaleString('ar-EG');

    const updatedAt = stats.updatedAt?.toDate?.();
    document.getElementById('geoUpdated').textContent = updatedAt
      ? `آخر تحديث: ${new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(updatedAt)}`
      : 'وقت التحديث غير متاح';
  }

  function renderCountryList(counts) {
    list.replaceChildren();
    if (!counts.length) {
      appendEmptyMessage('لا توجد مواقع دول اختيارية ضمن الإحصاءات الحالية.');
      return;
    }

    counts.forEach((country) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const name = document.createElement('span');
      const count = document.createElement('span');

      button.type = 'button';
      button.className = 'geo-country-item';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${country.name}: ${country.subscribers}`);
      button.dataset.countryCode = country.code;
      name.className = 'geo-country-name';
      name.textContent = country.name;
      count.className = 'geo-country-count';
      count.textContent = Number(country.subscribers).toLocaleString('ar-EG');
      button.append(name, count);

      button.addEventListener('click', () => selectCountry(country.code));

      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function selectCountry(code) {
    const country = loadedCounts.find((entry) => entry.code === code);
    if (!country) return;

    list.querySelectorAll('.geo-country-item').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.querySelector('.geo-country-name')?.textContent ===
        country.name));
    });
    const marker = markers.get(code);
    if (marker && leafletMap) {
      leafletMap.flyTo(countryCenters[code], Math.max(leafletMap.getZoom(), 4), { duration: .35 });
      marker.openPopup();
    } else {
      showMapMessage(`${country.name}: ${Number(country.subscribers).toLocaleString('ar-EG')} مشترك. لا يتوفر موضع تقريبي لهذه الدولة على الخريطة.`);
    }
  }

  function loadStylesheet() {
    if (document.querySelector('link[data-leaflet-style]')) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.leafletStyle = 'true';
      link.onload = resolve;
      link.onerror = () => {
        link.remove();
        reject(new Error('تعذر تحميل تنسيق الخريطة.'));
      };
      document.head.appendChild(link);
    });
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-leaflet-script]');
      if (existing) {
        if (existing.dataset.loadFailed === 'true') existing.remove();
        else {
          existing.addEventListener('load', () => resolve(window.L), { once: true });
          existing.addEventListener('error', () => reject(new Error('تعذر تحميل مكتبة الخريطة.')), { once: true });
          return;
        }
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.dataset.leafletScript = 'true';
      script.onload = () => window.L ? resolve(window.L) : reject(new Error('لم تبدأ مكتبة الخريطة بشكل صحيح.'));
      script.onerror = () => {
        script.dataset.loadFailed = 'true';
        reject(new Error('تعذر تحميل مكتبة الخريطة.'));
      };
      document.head.appendChild(script);
    });
  }

  async function renderMap(counts) {
    await Promise.all([loadStylesheet(), loadLeaflet()]);
    if (!window.L) throw new Error('مكتبة الخريطة غير متاحة.');

    if (leafletMap) leafletMap.remove();
    markers = new Map();
    leafletMap = window.L.map(mapElement, {
      center: [22, 15],
      zoom: 2,
      minZoom: 2,
      maxZoom: 7,
      scrollWheelZoom: false,
      preferCanvas: true
    });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 7,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    }).addTo(leafletMap);

    counts.forEach((country) => {
      const center = countryCenters[country.code];
      if (!center) return;
      const radius = Math.min(18, 7 + Math.log2(country.subscribers));
      const marker = window.L.circleMarker(center, {
        radius,
        color: '#16296b',
        weight: 2,
        fillColor: '#f59e0b',
        fillOpacity: .82
      }).addTo(leafletMap);
      const popup = document.createElement('span');
      popup.textContent = `${country.name}: ${Number(country.subscribers).toLocaleString('ar-EG')}`;
      marker.bindPopup(popup);
      markers.set(country.code, marker);
    });

    window.requestAnimationFrame(() => leafletMap.invalidateSize());
    mapStatus.hidden = true;
  }

  async function loadStats() {
    if (loading) return;
    loading = true;
    section.setAttribute('aria-busy', 'true');
    retryButton.hidden = true;
    showMapMessage('جارٍ تحميل الإحصاءات…');

    try {
      const snapshot = await getDoc(doc(db, 'publicStats', 'geoSubscribers'));
      if (!snapshot.exists()) {
        document.getElementById('geoTotalSubscribers').textContent = '—';
        document.getElementById('geoOptInSubscribers').textContent = '—';
        document.getElementById('geoCountryTotal').textContent = '—';
        document.getElementById('geoUpdated').textContent = '—';
        appendEmptyMessage('لم تُنشر إحصاءات بعد. ستظهر بعد تشغيل التحديث الدوري.');
        showMapMessage('الإحصاءات الجغرافية غير متاحة بعد.');
        return;
      }

      const stats = snapshot.data();
      const counts = Array.isArray(stats.countryCounts)
        ? stats.countryCounts.filter((country) =>
          /^[A-Z]{2}$/.test(country?.code) &&
          typeof country.name === 'string' &&
          Number.isSafeInteger(country.subscribers) &&
          country.subscribers > 0)
        : [];
      loadedCounts = counts;
      updateSummary({ ...stats, countryCounts: counts });
      renderCountryList(counts);

      if (!Number(stats.totalSubscribers) && !counts.length) {
        showMapMessage('لا توجد اشتراكات مسجلة حتى الآن.');
        return;
      }
      if (!counts.length) {
        showMapMessage('لا توجد بيانات دولة اختيارية لعرضها على الخريطة.');
        return;
      }

      try {
        await renderMap(counts);
      } catch (error) {
        console.error('تعذر عرض خريطة المشتركين:', error);
        showMapMessage('تعذر تحميل الخريطة. ما زالت أعداد الدول متاحة في القائمة.', { error: true });
      }
    } catch (error) {
      console.error('تعذر تحميل إحصاءات المشتركين:', error);
      appendEmptyMessage('تعذر الاتصال بالخادم لتحميل الإحصاءات.');
      showMapMessage('تعذر تحميل الإحصاءات. تحقق من الاتصال ثم أعد المحاولة.', { error: true, retry: true });
    } finally {
      loading = false;
      section.setAttribute('aria-busy', 'false');
    }
  }

  retryButton.addEventListener('click', loadStats);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadStats();
    }, { rootMargin: '200px' });
    observer.observe(section);
  } else {
    loadStats();
  }
}
