'use strict';

const arabicRegionNames = new Intl.DisplayNames(['ar'], { type: 'region' });
const englishRegionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function normalizeCountryName(value) {
  return String(value)
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const validCountryCodes = new Set();
const countryCodesByName = new Map();
const unknownRegionNames = new Set(['Unknown Region', 'منطقة غير معروفة']);

for (let first = 65; first <= 90; first += 1) {
  for (let second = 65; second <= 90; second += 1) {
    const code = String.fromCharCode(first, second);
    const arabicName = arabicRegionNames.of(code);
    const englishName = englishRegionNames.of(code);
    if (arabicName && !unknownRegionNames.has(arabicName)) {
      validCountryCodes.add(code);
      countryCodesByName.set(normalizeCountryName(arabicName), code);
    }
    if (englishName && !unknownRegionNames.has(englishName)) {
      validCountryCodes.add(code);
      countryCodesByName.set(normalizeCountryName(englishName), code);
    }
  }
}

for (const [name, code] of Object.entries({
  'الولايات المتحدة الأمريكية': 'US',
  'الولايات المتحدة': 'US',
  'المملكة المتحدة': 'GB',
  'روسيا': 'RU',
  'سوريا': 'SY',
  'فلسطين': 'PS',
  'تركيا': 'TR',
  'كوريا الجنوبية': 'KR',
  'كوريا الشمالية': 'KP',
  'جمهورية مصر العربية': 'EG'
})) {
  countryCodesByName.set(normalizeCountryName(name), code);
}

function isKnownCountryCode(code) {
  return typeof code === 'string' && /^[A-Z]{2}$/.test(code) && validCountryCodes.has(code);
}

function resolveCountryCode(location) {
  const code = typeof location?.countryCode === 'string'
    ? location.countryCode.trim().toUpperCase()
    : '';
  if (isKnownCountryCode(code)) return code;

  const country = normalizeCountryName(location?.country);
  return countryCodesByName.get(country) || null;
}

function createSubscriberGeoAggregator() {
  const countryCounts = new Map();
  let totalSubscribers = 0;
  let geoOptInSubscribers = 0;

  return {
    add(user) {
      totalSubscribers += 1;
      const code = resolveCountryCode(user?.location);
      if (!code) return;
      geoOptInSubscribers += 1;
      countryCounts.set(code, (countryCounts.get(code) || 0) + 1);
    },
    summary() {
      return {
        totalSubscribers,
        geoOptInSubscribers,
        countryCounts: [...countryCounts.entries()]
          .map(([code, subscribers]) => ({
            code,
            name: arabicRegionNames.of(code),
            subscribers
          }))
          .sort((a, b) => b.subscribers - a.subscribers || a.name.localeCompare(b.name, 'ar'))
      };
    }
  };
}

function aggregateSubscriberGeo(users) {
  const aggregator = createSubscriberGeoAggregator();
  users.forEach((user) => aggregator.add(user));
  return aggregator.summary();
}

module.exports = { aggregateSubscriberGeo, createSubscriberGeoAggregator, resolveCountryCode };
