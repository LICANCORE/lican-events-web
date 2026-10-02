import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { calculateShipping, getShippingConfig, validateOrder } from '../../cloudflare-worker/worker.js';

const allowedOrigin = 'http://127.0.0.1:4173';
const baseEnv = {
  SUMUP_API_KEY: 'test-secret',
  SUMUP_MERCHANT_CODE: 'TEST-MERCHANT',
};

function validPayload(overrides = {}) {
  return {
    items: [{ id: 'gorra-under-headbang-dealers', quantity: 1, variant: null }],
    customer: { name: 'QA', surname: 'LICAN', email: 'qa@example.invalid', phone: '+34000000000' },
    shipping: {
      address: 'Dirección de prueba 1',
      postalCode: '43001',
      city: 'Tarragona',
      province: 'Tarragona',
      country: 'ES',
    },
    ...overrides,
  };
}

function jsonRequest(path, body, origin = allowedOrigin) {
  return new Request(`https://lican-merch-api.licancorp.workers.dev${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
}

test('publishes the definitive shipping policy without Cloudflare rate variables', () => {
  assert.deepEqual(getShippingConfig(), {
    peninsula: {
      lowOrderLimitCents: 2500,
      freeFromCents: 4000,
      under25Cents: 499,
      from25To39Cents: 399,
    },
    europe: { flatRateCents: 1299 },
  });
});

for (const [subtotalCents, expectedShippingCents] of [
  [1, 499],
  [2499, 499],
  [2500, 399],
  [3999, 399],
  [4000, 0],
  [10000, 0],
]) {
  test(`calculates peninsula shipping for ${subtotalCents} cents`, () => {
    assert.deepEqual(calculateShipping({
      country: 'ES', postalCode: '43001', province: 'Tarragona', subtotalCents,
    }), {
      zone: 'peninsula',
      shippingCents: expectedShippingCents,
      freeShipping: expectedShippingCents === 0,
    });
  });
}

for (const [country, subtotalCents] of [['FR', 1000], ['FR', 10000], ['DE', 3000]]) {
  test(`charges the fixed European rate for ${country} at ${subtotalCents} cents`, () => {
    assert.deepEqual(calculateShipping({
      country, postalCode: '75001', province: 'Europa', subtotalCents,
    }), { zone: 'europe', shippingCents: 1299, freeShipping: false });
  });
}

for (const [name, destination, error] of [
  ['Canary postal codes', { country: 'ES', postalCode: '35001', province: 'Las Palmas' }, 'CANARY_NOT_AVAILABLE'],
  ['Canary provinces', { country: 'ES', postalCode: '28001', province: 'Santa Cruz de Tenerife' }, 'CANARY_NOT_AVAILABLE'],
  ['Balearic postal codes', { country: 'ES', postalCode: '07001', province: 'Illes Balears' }, 'BALEARIC_NOT_AVAILABLE'],
  ['Ceuta', { country: 'ES', postalCode: '51001', province: 'Ceuta' }, 'CEUTA_MELILLA_NOT_AVAILABLE'],
  ['Melilla', { country: 'ES', postalCode: '52001', province: 'Melilla' }, 'CEUTA_MELILLA_NOT_AVAILABLE'],
  ['the United Kingdom', { country: 'GB', postalCode: 'SW1A1AA', province: 'London' }, 'INTERNATIONAL_NOT_AVAILABLE'],
  ['the United States', { country: 'US', postalCode: '10001', province: 'New York' }, 'INTERNATIONAL_NOT_AVAILABLE'],
]) {
  test(`blocks ${name}`, () => {
    assert.throws(() => calculateShipping({ ...destination, subtotalCents: 10000 }), { message: error });
  });
}

test('calculates product and shipping totals exclusively on the server', () => {
  const order = validateOrder(validPayload());
  assert.equal(order.subtotalCents, 2000);
  assert.equal(order.shippingCents, 499);
  assert.equal(order.totalCents, 2499);
  assert.equal(order.shippingZone, 'peninsula');
  assert.deepEqual(order.items, [{
    id: 'gorra-under-headbang-dealers',
    variant: null,
    quantity: 1,
    unitPriceCents: 2000,
  }]);
});

for (const [name, mutate, error] of [
  ['unknown products', (payload) => { payload.items[0].id = 'inventado'; }, 'PRODUCT_NOT_FOUND'],
  ['sold-out products', (payload) => { payload.items[0].id = 'camiseta-bass-traffickers-headbang-dealers'; }, 'PRODUCT_UNAVAILABLE'],
  ['zero quantities', (payload) => { payload.items[0].quantity = 0; }, 'INVALID_QUANTITY'],
  ['unexpected variants', (payload) => { payload.items[0].variant = 'xl'; }, 'INVALID_VARIANT'],
]) {
  test(`rejects ${name}`, () => {
    const payload = validPayload();
    mutate(payload);
    assert.throws(() => validateOrder(payload), { message: error });
  });
}

test('ignores shipping prices and methods supplied by the browser', () => {
  const payload = validPayload();
  payload.shipping.shippingCents = 1;
  payload.shipping.method = 'free';
  payload.shipping.zone = 'europe';
  payload.total_cents = 1;
  const order = validateOrder(payload);
  assert.equal(order.shippingCents, 499);
  assert.equal(order.totalCents, 2499);
  assert.equal(order.shippingZone, 'peninsula');
});

test('creates a hosted checkout with the server-calculated amount and strict CORS', async () => {
  let createBody;
  const env = {
    ...baseEnv,
    __TEST_FETCH__: async (url, init) => {
      if (url.endsWith('/v0.1/checkouts') && init.method === 'POST') {
        createBody = JSON.parse(init.body);
        return Response.json({
          id: '12345678-abcd',
          checkout_reference: createBody.checkout_reference,
          hosted_checkout_url: 'https://checkout.sumup.com/pay/qa-checkout',
          status: 'PENDING',
        });
      }
      if (url.includes('/v1/merchants/')) return Response.json({ sandbox: true });
      throw new Error(`Unexpected SumUp request: ${url}`);
    },
  };
  const response = await worker.fetch(jsonRequest('/create-checkout', {
    ...validPayload(),
    total: 0.01,
    shipping_cents: 1,
    items: [{ id: 'gorra-under-headbang-dealers', quantity: 1, variant: null, price: 0.01 }],
  }), env, { waitUntil() {} });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
  assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(createBody.amount, 24.99);
  assert.equal(createBody.currency, 'EUR');
  assert.equal(createBody.merchant_code, 'TEST-MERCHANT');
  assert.deepEqual(createBody.hosted_checkout, { enabled: true });
  assert.equal(createBody.redirect_url, 'https://www.licanevents.com/merch/success.html');
  assert.equal(createBody.return_url, 'https://lican-merch-api.licancorp.workers.dev/sumup-webhook');
  assert.equal(payload.ok, true);
  assert.equal(payload.checkout_id, '12345678-abcd');
  assert.equal(payload.sandbox, true);
  assert.equal(payload.subtotal_cents, 2000);
  assert.equal(payload.shipping_cents, 499);
  assert.equal(payload.total_cents, 2499);
  assert.equal(payload.shipping_zone, 'peninsula');
});

test('returns the structured public shipping policy', async () => {
  const request = new Request('https://lican-merch-api.licancorp.workers.dev/store-config', {
    headers: { Origin: allowedOrigin },
  });
  const response = await worker.fetch(request, baseEnv, { waitUntil() {} });
  const payload = await response.json();
  assert.equal(payload.shipping.peninsula.under25Cents, 499);
  assert.equal(payload.shipping.peninsula.from25To39Cents, 399);
  assert.equal(payload.shipping.peninsula.freeFromCents, 4000);
  assert.equal(payload.shipping.europe.flatRateCents, 1299);
  assert.equal(payload.countries.some(({ code }) => code === 'FR'), true);
  assert.equal(payload.countries.some(({ code }) => code === 'GB'), false);
});

test('returns authoritative PAID status from SumUp', async () => {
  const env = {
    ...baseEnv,
    SUMUP_MERCHANT_CODE: 'STATUS-MERCHANT',
    __TEST_FETCH__: async (url) => {
      if (url.includes('/v0.1/checkouts/')) return Response.json({
        id: '12345678-status',
        checkout_reference: 'LICAN-QA-STATUS',
        status: 'PAID',
        amount: 24.99,
        currency: 'EUR',
      });
      if (url.includes('/v1/merchants/')) return Response.json({ sandbox: true });
      throw new Error(`Unexpected SumUp request: ${url}`);
    },
  };
  const request = new Request('https://lican-merch-api.licancorp.workers.dev/checkout-status?id=12345678-status', {
    headers: { Origin: allowedOrigin },
  });
  const response = await worker.fetch(request, env, { waitUntil() {} });
  assert.deepEqual(await response.json(), {
    ok: true,
    checkout_id: '12345678-status',
    checkout_reference: 'LICAN-QA-STATUS',
    status: 'PAID',
    amount: 24.99,
    currency: 'EUR',
    sandbox: true,
  });
});

test('blocks origins outside the exact allowlist', async () => {
  const request = new Request('https://lican-merch-api.licancorp.workers.dev/store-config', {
    headers: { Origin: 'https://attacker.invalid' },
  });
  const response = await worker.fetch(request, baseEnv, { waitUntil() {} });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('acknowledges webhook immediately and verifies it against SumUp in waitUntil', async () => {
  let verified = false;
  let backgroundTask;
  let releaseVerification;
  const verificationGate = new Promise((resolve) => { releaseVerification = resolve; });
  const env = {
    ...baseEnv,
    __TEST_FETCH__: async (url) => {
      assert.match(url, /\/v0\.1\/checkouts\/12345678-hook$/);
      await verificationGate;
      verified = true;
      return Response.json({ checkout_reference: 'LICAN-QA-HOOK', status: 'PAID' });
    },
  };
  const response = await worker.fetch(jsonRequest('/sumup-webhook', {
    event_type: 'CHECKOUT_STATUS_CHANGED',
    id: '12345678-hook',
  }), env, { waitUntil(promise) { backgroundTask = promise; } });
  assert.equal(response.status, 204);
  assert.equal(verified, false);
  releaseVerification();
  await backgroundTask;
  assert.equal(verified, true);
});
