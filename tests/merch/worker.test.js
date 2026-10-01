import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { getShippingConfig, validateOrder } from '../../cloudflare-worker/worker.js';

const allowedOrigin = 'http://127.0.0.1:4173';
const baseEnv = {
  SUMUP_API_KEY: 'test-secret',
  SUMUP_MERCHANT_CODE: 'TEST-MERCHANT',
  SHIPPING_PENINSULA_CENTS: '495',
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
      method: 'peninsula',
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

test('normalizes shipping variables without inventing missing rates', () => {
  assert.deepEqual(getShippingConfig({ SHIPPING_PENINSULA_CENTS: '495' }), {
    peninsula: 495,
    balearic: null,
    canary: null,
    eu: null,
    international: null,
    eventPickup: null,
    freeShippingFromCents: null,
  });
});

test('calculates product and shipping totals exclusively on the server', () => {
  const order = validateOrder(validPayload(), baseEnv);
  assert.equal(order.subtotalCents, 2000);
  assert.equal(order.shippingCents, 495);
  assert.equal(order.totalCents, 2495);
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
    assert.throws(() => validateOrder(payload, baseEnv), { message: error });
  });
}

test('rejects an unconfigured shipping method', () => {
  assert.throws(() => validateOrder(validPayload(), {
    SUMUP_API_KEY: 'test-secret',
    SUMUP_MERCHANT_CODE: 'TEST-MERCHANT',
  }), { message: 'SHIPPING_NOT_CONFIGURED' });
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
    items: [{ id: 'gorra-under-headbang-dealers', quantity: 1, variant: null, price: 0.01 }],
  }), env, { waitUntil() {} });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
  assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(createBody.amount, 24.95);
  assert.equal(createBody.currency, 'EUR');
  assert.equal(createBody.merchant_code, 'TEST-MERCHANT');
  assert.deepEqual(createBody.hosted_checkout, { enabled: true });
  assert.equal(createBody.redirect_url, 'https://www.licanevents.com/merch/success.html');
  assert.equal(createBody.return_url, 'https://lican-merch-api.licancorp.workers.dev/sumup-webhook');
  assert.equal(payload.ok, true);
  assert.equal(payload.checkout_id, '12345678-abcd');
  assert.equal(payload.sandbox, true);
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
        amount: 24.95,
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
    amount: 24.95,
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
