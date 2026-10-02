import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateEstimatedShipping, normalizeShippingPolicy, shippingErrorMessage } from '../../public/merch/js/shipping.js';

const policy = normalizeShippingPolicy({
  currency: 'EUR',
  shipping: {
    peninsula: {
      lowOrderLimitCents: 2500,
      freeFromCents: 4000,
      under25Cents: 499,
      from25To39Cents: 399,
    },
    balearic: {
      freeFromCents: 4000,
      under40Cents: 499,
    },
    europe: { flatRateCents: 1299 },
  },
  availableZones: ['peninsula', 'balearic', 'europe'],
  countries: [
    { code: 'ES', name: 'España' },
    { code: 'FR', name: 'Francia' },
  ],
});

test('frontend consumes structured policy for live peninsula estimates', () => {
  const destination = { country: 'ES', postalCode: '43001', province: 'Tarragona' };
  assert.equal(calculateEstimatedShipping(policy, destination, 2499).shippingCents, 499);
  assert.equal(calculateEstimatedShipping(policy, destination, 2500).shippingCents, 399);
  assert.equal(calculateEstimatedShipping(policy, destination, 4000).shippingCents, 0);
});

test('frontend does not promise free shipping for Europe', () => {
  const estimate = calculateEstimatedShipping(policy, { country: 'FR', postalCode: '75001', province: 'Paris' }, 10000);
  assert.deepEqual(estimate, { shippingCents: 1299, zone: 'europe', error: null });
});

test('frontend applies the dedicated Balearic rule', () => {
  const estimate = calculateEstimatedShipping(policy, { country: 'ES', postalCode: '07001', province: 'Illes Balears' }, 3000);
  assert.deepEqual(estimate, { shippingCents: 499, zone: 'balearic', error: null });
  assert.equal(calculateEstimatedShipping(policy, { country: 'ES', postalCode: '07800', province: 'Illes Balears' }, 4000).shippingCents, 0);
});

for (const [postalCode, province, message] of [
  ['35001', 'Las Palmas', /Islas Canarias/],
  ['51001', 'Ceuta', /Ceuta/],
  ['52001', 'Melilla', /Melilla/],
]) {
  test(`frontend blocks ${postalCode} with customer-facing copy`, () => {
    const estimate = calculateEstimatedShipping(policy, { country: 'ES', postalCode, province }, 3000);
    assert.match(shippingErrorMessage(estimate.error), message);
  });
}
