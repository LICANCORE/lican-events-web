const SUMUP_API_BASE = 'https://api.sumup.com';
const WORKER_PUBLIC_URL = 'https://lican-merch-api.licancorp.workers.dev';
const STORE_PUBLIC_URL = 'https://www.licanevents.com';
const CURRENCY = 'EUR';
const MAX_REQUEST_BYTES = 16_384;
const MAX_LINE_QUANTITY = 99;
const MAX_CART_LINES = 20;
const MAX_ORDER_CENTS = 500_000;

const ALLOWED_ORIGINS = new Set([
  'https://licanevents.com',
  'https://www.licanevents.com',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

export const PRODUCTS = Object.freeze({
  'gorra-under-headbang-dealers': { priceCents: 2000, stock: null, purchasable: true, variants: null },
  'encendedor-de-plasma-recargable-tipo-c-headbang-dealers': { priceCents: 1000, stock: null, purchasable: true, variants: null },
  'llavero-nfc-3d-headbang-dealers': { priceCents: 300, stock: null, purchasable: true, variants: null },
  'camiseta-bass-traffickers-headbang-dealers': { priceCents: null, stock: 0, purchasable: false, variants: null },
  'llavero-nfc-3d-feral': { priceCents: 300, stock: null, purchasable: true, variants: null },
  'night-of-wolves-clipper-orange': { priceCents: 300, stock: null, purchasable: true, variants: null },
  'night-of-wolves-clipper-blue': { priceCents: 300, stock: null, purchasable: true, variants: null },
});

const PENINSULA_LOW_ORDER_LIMIT_CENTS = 2500;
const PENINSULA_FREE_SHIPPING_FROM_CENTS = 4000;
const PENINSULA_LOW_SHIPPING_CENTS = 499;
const PENINSULA_MID_SHIPPING_CENTS = 399;
const BALEARIC_FREE_SHIPPING_FROM_CENTS = 4000;
const BALEARIC_SHIPPING_CENTS = 499;
const EUROPE_SHIPPING_CENTS = 1299;

const EUROPEAN_COUNTRIES = Object.freeze({
  AT: 'Austria',
  BE: 'Bélgica',
  BG: 'Bulgaria',
  HR: 'Croacia',
  CY: 'Chipre',
  CZ: 'República Checa',
  DK: 'Dinamarca',
  EE: 'Estonia',
  FI: 'Finlandia',
  FR: 'Francia',
  DE: 'Alemania',
  GR: 'Grecia',
  HU: 'Hungría',
  IE: 'Irlanda',
  IT: 'Italia',
  LV: 'Letonia',
  LT: 'Lituania',
  LU: 'Luxemburgo',
  MT: 'Malta',
  NL: 'Países Bajos',
  PL: 'Polonia',
  PT: 'Portugal',
  RO: 'Rumanía',
  SK: 'Eslovaquia',
  SI: 'Eslovenia',
  SE: 'Suecia',
});

const merchantEnvironmentCache = new Map();

class ApiError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function spanishPostalZone(postalCode) {
  const prefix = postalCode.slice(0, 2);
  if (prefix === '07') return 'balearic';
  if (prefix === '35' || prefix === '38') return 'canary';
  if (prefix === '51') return 'ceuta';
  if (prefix === '52') return 'melilla';
  return 'peninsula';
}

export function getShippingConfig() {
  return {
    peninsula: {
      lowOrderLimitCents: PENINSULA_LOW_ORDER_LIMIT_CENTS,
      freeFromCents: PENINSULA_FREE_SHIPPING_FROM_CENTS,
      under25Cents: PENINSULA_LOW_SHIPPING_CENTS,
      from25To39Cents: PENINSULA_MID_SHIPPING_CENTS,
    },
    balearic: {
      freeFromCents: BALEARIC_FREE_SHIPPING_FROM_CENTS,
      under40Cents: BALEARIC_SHIPPING_CENTS,
    },
    europe: { flatRateCents: EUROPE_SHIPPING_CENTS },
  };
}

export function calculateShipping({ country, postalCode, province, subtotalCents }) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) throw new ApiError('INVALID_ORDER_TOTAL');
  const normalizedCountry = requiredString(country, 2, 'INVALID_SHIPPING').toUpperCase();
  const normalizedPostalCode = requiredString(postalCode, 16, 'INVALID_SHIPPING').replace(/\s+/g, '');
  requiredString(province, 100, 'INVALID_SHIPPING');

  if (normalizedCountry === 'ES') {
    if (!/^\d{5}$/.test(normalizedPostalCode)) throw new ApiError('INVALID_SHIPPING');
    const zone = spanishPostalZone(normalizedPostalCode);
    if (zone === 'canary') throw new ApiError('CANARY_NOT_AVAILABLE');
    if (zone === 'ceuta') throw new ApiError('CEUTA_NOT_AVAILABLE');
    if (zone === 'melilla') throw new ApiError('MELILLA_NOT_AVAILABLE');

    if (zone === 'balearic') {
      const shippingCents = subtotalCents < BALEARIC_FREE_SHIPPING_FROM_CENTS ? BALEARIC_SHIPPING_CENTS : 0;
      return { zone, shippingCents, freeShipping: shippingCents === 0 };
    }

    let shippingCents;
    if (subtotalCents < PENINSULA_LOW_ORDER_LIMIT_CENTS) shippingCents = PENINSULA_LOW_SHIPPING_CENTS;
    else if (subtotalCents < PENINSULA_FREE_SHIPPING_FROM_CENTS) shippingCents = PENINSULA_MID_SHIPPING_CENTS;
    else shippingCents = 0;
    return { zone: 'peninsula', shippingCents, freeShipping: shippingCents === 0 };
  }

  if (Object.hasOwn(EUROPEAN_COUNTRIES, normalizedCountry)) {
    return { zone: 'europe', shippingCents: EUROPE_SHIPPING_CENTS, freeShipping: false };
  }
  if (['GB', 'US'].includes(normalizedCountry)) throw new ApiError('INTERNATIONAL_NOT_AVAILABLE');
  throw new ApiError('UNSUPPORTED_COUNTRY');
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function jsonResponse(payload, status, origin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function emptyResponse(status, origin) {
  return new Response(null, { status, headers: corsHeaders(origin) });
}

async function readJson(request) {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) throw new ApiError('INVALID_CONTENT_TYPE', 415);
  const announcedLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(announcedLength) && announcedLength > MAX_REQUEST_BYTES) throw new ApiError('PAYLOAD_TOO_LARGE', 413);
  const source = await request.text();
  if (!source || source.length > MAX_REQUEST_BYTES) throw new ApiError(source ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON', source ? 413 : 400);
  try {
    return JSON.parse(source);
  } catch {
    throw new ApiError('INVALID_JSON');
  }
}

function requiredString(value, maxLength, errorCode) {
  if (typeof value !== 'string') throw new ApiError(errorCode);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new ApiError(errorCode);
  return normalized;
}

function normalizeVariant(value) {
  if (value === undefined || value === null || value === '') return null;
  return requiredString(value, 80, 'INVALID_VARIANT');
}

function validateCustomer(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('INVALID_CUSTOMER');
  const customer = {
    name: requiredString(value.name, 80, 'INVALID_CUSTOMER'),
    surname: requiredString(value.surname, 120, 'INVALID_CUSTOMER'),
    email: requiredString(value.email, 160, 'INVALID_CUSTOMER'),
    phone: requiredString(value.phone, 40, 'INVALID_CUSTOMER'),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new ApiError('INVALID_CUSTOMER');
  return customer;
}

function validateShipping(value, subtotalCents) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('INVALID_SHIPPING');
  const shipping = {
    address: requiredString(value.address, 180, 'INVALID_SHIPPING'),
    postalCode: requiredString(value.postalCode, 16, 'INVALID_SHIPPING'),
    city: requiredString(value.city, 100, 'INVALID_SHIPPING'),
    province: requiredString(value.province, 100, 'INVALID_SHIPPING'),
    country: requiredString(value.country, 2, 'INVALID_SHIPPING').toUpperCase(),
  };
  return { shipping, ...calculateShipping({ ...shipping, subtotalCents }) };
}

export function validateOrder(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ApiError('INVALID_REQUEST');
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > MAX_CART_LINES) throw new ApiError('INVALID_ITEMS');

  const lines = new Map();
  for (const item of payload.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ApiError('INVALID_ITEMS');
    const id = requiredString(item.id, 120, 'INVALID_PRODUCT');
    const product = PRODUCTS[id];
    if (!product) throw new ApiError('PRODUCT_NOT_FOUND');
    if (!product.purchasable || product.stock === 0 || !Number.isInteger(product.priceCents)) throw new ApiError('PRODUCT_UNAVAILABLE');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_LINE_QUANTITY) throw new ApiError('INVALID_QUANTITY');
    const variant = normalizeVariant(item.variant);
    let unitPriceCents = product.priceCents;
    let variantStock = null;
    if (product.variants) {
      const selected = product.variants[variant];
      if (!selected) throw new ApiError('INVALID_VARIANT');
      unitPriceCents = selected.priceCents;
      variantStock = selected.stock;
    } else if (variant !== null) {
      throw new ApiError('INVALID_VARIANT');
    }

    const key = `${id}:${variant ?? ''}`;
    const previous = lines.get(key);
    const quantity = (previous?.quantity ?? 0) + item.quantity;
    if (quantity > MAX_LINE_QUANTITY) throw new ApiError('INVALID_QUANTITY');
    const stock = Number.isInteger(variantStock) ? variantStock : product.stock;
    if (Number.isInteger(stock) && quantity > stock) throw new ApiError('INSUFFICIENT_STOCK');
    lines.set(key, { id, variant, quantity, unitPriceCents });
  }

  const normalizedLines = [...lines.values()];
  const subtotalCents = normalizedLines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const customer = validateCustomer(payload.customer);
  const shippingResult = validateShipping(payload.shipping, subtotalCents);
  const shippingCents = shippingResult.shippingCents;
  const totalCents = subtotalCents + shippingCents;
  if (!Number.isSafeInteger(totalCents) || totalCents < 1 || totalCents > MAX_ORDER_CENTS) throw new ApiError('INVALID_ORDER_TOTAL');

  return {
    items: normalizedLines,
    customer,
    shipping: shippingResult.shipping,
    shippingZone: shippingResult.zone,
    freeShipping: shippingResult.freeShipping,
    subtotalCents,
    shippingCents,
    totalCents,
  };
}

function assertSecrets(env) {
  if (!env.SUMUP_API_KEY || !env.SUMUP_MERCHANT_CODE) throw new ApiError('SERVICE_NOT_CONFIGURED', 503);
}

function sumupHeaders(env) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${env.SUMUP_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function fetchSumUp(url, init, env) {
  const fetchImplementation = env.__TEST_FETCH__ ?? fetch;
  return fetchImplementation(url, init);
}

async function parseSumUpResponse(response, errorCode) {
  if (!response.ok) {
    console.error(`${errorCode}: SumUp HTTP ${response.status}`);
    throw new ApiError(errorCode, 502);
  }
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') throw new ApiError(errorCode, 502);
  return payload;
}

function createReference() {
  return `LICAN-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function isHostedCheckoutUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'checkout.sumup.com' && url.pathname.startsWith('/pay/');
  } catch {
    return false;
  }
}

async function detectSandbox(env) {
  const cached = merchantEnvironmentCache.get(env.SUMUP_MERCHANT_CODE);
  if (cached && cached.expiresAt > Date.now()) return cached.sandbox;
  try {
    const response = await fetchSumUp(`${SUMUP_API_BASE}/v1/merchants/${encodeURIComponent(env.SUMUP_MERCHANT_CODE)}`, {
      method: 'GET',
      headers: sumupHeaders(env),
    }, env);
    if (!response.ok) return true;
    const merchant = await response.json();
    const sandbox = merchant?.sandbox !== false;
    merchantEnvironmentCache.set(env.SUMUP_MERCHANT_CODE, { sandbox, expiresAt: Date.now() + 300_000 });
    return sandbox;
  } catch {
    return true;
  }
}

async function retrieveCheckout(checkoutId, env) {
  const response = await fetchSumUp(`${SUMUP_API_BASE}/v0.1/checkouts/${encodeURIComponent(checkoutId)}`, {
    method: 'GET',
    headers: sumupHeaders(env),
  }, env);
  return parseSumUpResponse(response, 'SUMUP_STATUS_FAILED');
}

async function createCheckout(request, env, origin) {
  assertSecrets(env);
  const order = validateOrder(await readJson(request));
  const checkoutReference = createReference();
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const sumupRequest = {
    checkout_reference: checkoutReference,
    amount: order.totalCents / 100,
    currency: CURRENCY,
    merchant_code: env.SUMUP_MERCHANT_CODE,
    description: `LICAN MERCH · ${itemCount} artículo${itemCount === 1 ? '' : 's'}`,
    hosted_checkout: { enabled: true },
    redirect_url: `${STORE_PUBLIC_URL}/merch/success.html`,
    return_url: `${WORKER_PUBLIC_URL}/sumup-webhook`,
  };
  const response = await fetchSumUp(`${SUMUP_API_BASE}/v0.1/checkouts`, {
    method: 'POST',
    headers: sumupHeaders(env),
    body: JSON.stringify(sumupRequest),
  }, env);
  const checkout = await parseSumUpResponse(response, 'SUMUP_CREATE_FAILED');
  if (typeof checkout.id !== 'string' || !isHostedCheckoutUrl(checkout.hosted_checkout_url)) throw new ApiError('INVALID_SUMUP_RESPONSE', 502);
  const sandbox = await detectSandbox(env);
  return jsonResponse({
    ok: true,
    checkout_id: checkout.id,
    checkout_reference: checkout.checkout_reference ?? checkoutReference,
    hosted_checkout_url: checkout.hosted_checkout_url,
    status: checkout.status ?? 'PENDING',
    sandbox,
    subtotal_cents: order.subtotalCents,
    shipping_cents: order.shippingCents,
    total_cents: order.totalCents,
    shipping_zone: order.shippingZone,
  }, 200, origin);
}

function validCheckoutId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9-]{8,128}$/.test(value);
}

async function checkoutStatus(url, env, origin) {
  assertSecrets(env);
  const checkoutId = url.searchParams.get('id');
  if (!validCheckoutId(checkoutId)) throw new ApiError('INVALID_CHECKOUT_ID');
  const [checkout, sandbox] = await Promise.all([retrieveCheckout(checkoutId, env), detectSandbox(env)]);
  if (typeof checkout.checkout_reference !== 'string' || !Number.isFinite(checkout.amount)) throw new ApiError('INVALID_SUMUP_RESPONSE', 502);
  return jsonResponse({
    ok: true,
    checkout_id: checkout.id ?? checkoutId,
    checkout_reference: checkout.checkout_reference,
    status: checkout.status,
    amount: checkout.amount,
    currency: checkout.currency ?? CURRENCY,
    sandbox,
  }, 200, origin);
}

async function sumupWebhook(request, env, context, origin) {
  assertSecrets(env);
  const event = await readJson(request);
  if (event?.event_type !== 'CHECKOUT_STATUS_CHANGED' || !validCheckoutId(event.id)) return emptyResponse(204, origin);
  context.waitUntil((async () => {
    try {
      const checkout = await retrieveCheckout(event.id, env);
      console.log(JSON.stringify({ event: 'SUMUP_CHECKOUT_VERIFIED', checkout_id: event.id, checkout_reference: checkout.checkout_reference, status: checkout.status }));
      // Punto de extensión: persistir aquí el pedido verificado en D1/KV antes de fulfillment.
    } catch (error) {
      console.error(`SUMUP_WEBHOOK_VERIFY_FAILED: ${error.code ?? 'UNKNOWN_ERROR'}`);
    }
  })());
  return emptyResponse(204, origin);
}

function storeConfig(origin) {
  return jsonResponse({
    ok: true,
    currency: CURRENCY,
    shipping: getShippingConfig(),
    availableZones: ['peninsula', 'balearic', 'europe'],
    countries: [
      { code: 'ES', name: 'España' },
      ...Object.entries(EUROPEAN_COUNTRIES).map(([code, name]) => ({ code, name })),
    ],
  }, 200, origin);
}

async function handleRequest(request, env, context) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return jsonResponse({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403, null);
  if (request.method === 'OPTIONS') return emptyResponse(204, origin);

  if (url.pathname === '/' && request.method === 'GET') {
    return jsonResponse({ ok: true, service: 'LICAN MERCH API', mode: 'sumup-hosted-checkout' }, 200, origin);
  }
  if (url.pathname === '/store-config' && request.method === 'GET') return storeConfig(origin);
  if (url.pathname === '/create-checkout' && request.method === 'POST') return createCheckout(request, env, origin);
  if (url.pathname === '/checkout-status' && request.method === 'GET') return checkoutStatus(url, env, origin);
  if (url.pathname === '/sumup-webhook' && request.method === 'POST') return sumupWebhook(request, env, context, origin);

  const knownPath = ['/', '/store-config', '/create-checkout', '/checkout-status', '/sumup-webhook'].includes(url.pathname);
  return jsonResponse({ ok: false, error: knownPath ? 'METHOD_NOT_ALLOWED' : 'NOT_FOUND' }, knownPath ? 405 : 404, origin);
}

export default {
  async fetch(request, env, context) {
    try {
      return await handleRequest(request, env, context);
    } catch (error) {
      if (error instanceof ApiError) return jsonResponse({ ok: false, error: error.code }, error.status, request.headers.get('Origin'));
      console.error('UNHANDLED_WORKER_ERROR');
      return jsonResponse({ ok: false, error: 'INTERNAL_ERROR' }, 500, request.headers.get('Origin'));
    }
  },
};
