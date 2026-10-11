'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  aggregateSubscriberGeo,
  hasLegacyGeoData,
  resolveCountryCode
} = require('../geo-stats');

test('country aggregation counts only explicit country-level location records', () => {
  const users = [
    { email: 'private@example.com', location: { countryCode: 'eg', lat: 30.1, lng: 31.2 } },
    { location: { country: 'مصر' } },
    { location: { countryCode: 'US' } },
    { location: { city: 'مدينة بلا دولة' } },
    { email: 'private2@example.com' }
  ];
  const result = aggregateSubscriberGeo(users);

  assert.equal(result.totalSubscribers, 5);
  assert.equal(result.geoOptInSubscribers, 3);
  assert.deepEqual(result.countryCounts, [
    { code: 'EG', name: 'مصر', subscribers: 2 },
    { code: 'US', name: 'الولايات المتحدة', subscribers: 1 }
  ]);
  assert.equal(JSON.stringify(result).includes('@example.com'), false);
  assert.equal(JSON.stringify(result).includes('lat'), false);
});

test('country resolution ignores invalid and non-country values', () => {
  assert.equal(resolveCountryCode({ countryCode: 'ZZ', country: 'unknown' }), null);
  assert.equal(resolveCountryCode({ countryCode: 'EU', country: 'European Union' }), null);
  assert.equal(resolveCountryCode({ countryCode: 'not-a-code', country: '' }), null);
  assert.equal(resolveCountryCode({ countryCode: 'XK' }), 'XK');
  assert.equal(resolveCountryCode({ country: 'المملكة المتحدة' }), 'GB');
});

test('legacy precise and city-level locations are identified for migration', () => {
  assert.equal(hasLegacyGeoData({ countryCode: 'EG', country: 'مصر' }), false);
  assert.equal(hasLegacyGeoData({ countryCode: 'EG', lat: 30.1, lng: 31.2 }), true);
  assert.equal(hasLegacyGeoData({ country: 'مصر', city: 'القاهرة' }), true);
  assert.equal(hasLegacyGeoData(null), false);
});
