import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const section = document.getElementById('subscriberGeo');
if (section) {
  const mapElement = document.getElementById('subscriberWorldMap');
  const mapStatus = document.getElementById('geoMapStatus');
  const mapTooltip = document.getElementById('geoMapTooltip');
  const retryButton = document.getElementById('geoRetry');
  const legend = document.getElementById('geoMapLegend');
  const updatedLabel = document.getElementById('geoUpdated');
  const palette = ['#fff1bf', '#ffe08a', '#f6c453', '#e99a32', '#c46b1d'];
  let loading = false;
  let mapResources;

  function showMapMessage(message, { error = false, retry = false } = {}) {
    mapStatus.textContent = message;
    mapStatus.hidden = false;
    mapStatus.classList.toggle('is-error', error);
    retryButton.hidden = !retry;
  }

  function getCountryCode(properties) {
    const code = properties.ISO_A2_EH || properties.ISO_A2;
    if (typeof code === 'string' && /^[A-Z]{2}$/.test(code) && code !== '-99') return code;
    if (properties.ADM0_A3 === 'KOS') return 'XK';
    return null;
  }

  async function loadMapResources() {
    if (!mapResources) {
      mapResources = Promise.all([
        import('https://cdn.jsdelivr.net/npm/d3-geo@3/+esm'),
        fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
          .then((response) => {
            if (!response.ok) throw new Error(`تعذر تحميل بيانات حدود الدول (${response.status}).`);
            return response.json();
          })
      ]).then(([geo, countries]) => ({ geo, countries }));
      mapResources.catch(() => { mapResources = null; });
    }
    return mapResources;
  }

  function countColor(count, maximum) {
    const index = Math.min(palette.length - 1, Math.ceil((count / maximum) * palette.length) - 1);
    return palette[Math.max(0, index)];
  }

  function renderLegend(maximum) {
    legend.replaceChildren();
    if (!maximum) return;

    const entries = [
      { label: 'أقل', color: palette[0] },
      { label: '', color: palette[1] },
      { label: '', color: palette[2] },
      { label: '', color: palette[3] },
      { label: 'أكثر', color: palette[4] }
    ];
    entries.forEach((entry) => {
      const item = document.createElement('span');
      const swatch = document.createElement('span');
      item.className = 'geo-legend-item';
      swatch.className = 'geo-legend-swatch';
      swatch.style.backgroundColor = entry.color;
      swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch);
      if (entry.label) item.append(document.createTextNode(entry.label));
      legend.append(item);
    });
    legend.setAttribute('aria-label', `تدرج أعداد المشتركين من الأقل إلى الأكثر، بحد أقصى ${maximum.toLocaleString('ar-EG')}`);
  }

  function placeTooltip(event, containerRect) {
    mapTooltip.style.left = `${event.clientX - containerRect.left}px`;
    mapTooltip.style.top = `${event.clientY - containerRect.top}px`;
  }

  async function renderMap(counts) {
    const { geo, countries } = await loadMapResources();
    const width = 1200;
    const height = 620;
    const countByCode = new Map(counts.map((country) => [country.code, country]));
    const maximum = Math.max(0, ...counts.map((country) => country.subscribers));
    const projection = geo.geoNaturalEarth1().fitExtent(
      [[18, 18], [width - 18, height - 18]],
      countries
    );
    const path = geo.geoPath(projection);
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNamespace, 'svg');

    svg.classList.add('geo-world-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'خريطة العالم الملونة حسب أعداد المشتركين في كل دولة');

    countries.features.forEach((feature) => {
      const countryPath = document.createElementNS(svgNamespace, 'path');
      const code = getCountryCode(feature.properties);
      const country = code ? countByCode.get(code) : null;
      const subscribers = country?.subscribers || 0;
      const countryName = feature.properties.NAME_AR || country?.name || feature.properties.ADMIN;
      const shape = path(feature);
      if (!shape) return;

      countryPath.classList.add('geo-country');
      countryPath.setAttribute('d', shape);
      countryPath.setAttribute('fill', subscribers && maximum ? countColor(subscribers, maximum) : 'var(--surface-2)');
      countryPath.dataset.subscribers = String(subscribers);
      countryPath.setAttribute('aria-label', subscribers
        ? `${countryName}: ${subscribers.toLocaleString('ar-EG')} مشترك`
        : `${countryName}: لا توجد بيانات مشترِكين`);
      if (subscribers) countryPath.setAttribute('tabindex', '0');

      const showTooltip = (event) => {
        const countDescription = subscribers
          ? `${subscribers.toLocaleString('ar-EG')} مشترك`
          : 'لا توجد بيانات مشترِكين';
        mapTooltip.textContent = `${countryName}: ${countDescription}`;
        mapTooltip.hidden = false;
        if (event.clientX !== undefined) placeTooltip(event, mapElement.getBoundingClientRect());
      };
      const hideTooltip = () => { mapTooltip.hidden = true; };
      countryPath.addEventListener('pointerenter', showTooltip);
      countryPath.addEventListener('pointermove', (event) => {
        if (!mapTooltip.hidden) placeTooltip(event, mapElement.getBoundingClientRect());
      });
      countryPath.addEventListener('pointerleave', hideTooltip);
      countryPath.addEventListener('focus', (event) => {
        showTooltip(event);
        const bounds = countryPath.getBoundingClientRect();
        const container = mapElement.getBoundingClientRect();
        mapTooltip.style.left = `${bounds.left + bounds.width / 2 - container.left}px`;
        mapTooltip.style.top = `${bounds.top - container.top}px`;
      });
      countryPath.addEventListener('blur', hideTooltip);
      countryPath.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideTooltip();
      });
      svg.append(countryPath);
    });

    mapElement.querySelector('.geo-world-svg')?.remove();
    mapElement.prepend(svg);
    renderLegend(maximum);
  }

  function showPermissionMessage() {
    showMapMessage(
      'رفض Firestore قراءة الإحصاءات العامة. انشر قواعد Firestore الحالية لمشروع freelance-arab ثم أعد المحاولة.',
      { error: true, retry: true }
    );
  }

  async function loadStats() {
    if (loading) return;
    loading = true;
    section.setAttribute('aria-busy', 'true');
    retryButton.hidden = true;
    updatedLabel.textContent = '';
    showMapMessage('جارٍ تحميل خريطة العالم والإحصاءات…');

    try {
      const snapshot = await getDoc(doc(db, 'publicStats', 'geoSubscribers'));
      if (!snapshot.exists()) {
        await renderMap([]);
        showMapMessage('لا توجد إحصاءات منشورة بعد. ستظهر الخريطة الملونة بعد أول تحديث للبيانات.');
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

      await renderMap(counts);
      const updatedAt = stats.updatedAt?.toDate?.();
      updatedLabel.textContent = updatedAt
        ? `آخر تحديث: ${new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(updatedAt)}`
        : '';

      if (!counts.length) showMapMessage('لا توجد بيانات دولة اختيارية ضمن الإحصاءات الحالية.');
      else mapStatus.hidden = true;
    } catch (error) {
      console.error('تعذر تحميل خريطة المشتركين وإحصاءاتها:', error);
      try {
        await renderMap([]);
      } catch (mapError) {
        console.error('تعذر تحميل حدود خريطة العالم:', mapError);
      }

      if (error?.code === 'permission-denied') showPermissionMessage();
      else showMapMessage('تعذر تحميل الخريطة أو الإحصاءات. تحقق من الاتصال ثم أعد المحاولة.', { error: true, retry: true });
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
