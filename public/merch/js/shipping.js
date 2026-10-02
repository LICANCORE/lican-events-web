import { STORE_CONFIG, STORE_CONFIG_ENDPOINT } from './config.js';

const DESTINATION_STORAGE_KEY = 'lican-merch-shipping-destination';
let policyPromise;

function validCents(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function spanishPostalZone(postalCode) {
  const prefix = postalCode.slice(0, 2);
  if (prefix === '07') return 'balearic';
  if (prefix === '35' || prefix === '38') return 'canary';
  if (prefix === '51') return 'ceuta';
  if (prefix === '52') return 'melilla';
  return 'peninsula';
}

export function normalizeShippingPolicy(payload) {
  const peninsula = payload?.shipping?.peninsula;
  const balearic = payload?.shipping?.balearic;
  const europe = payload?.shipping?.europe;
  const countries = Array.isArray(payload?.countries)
    ? payload.countries.filter((country) => /^[A-Z]{2}$/.test(country?.code) && typeof country?.name === 'string')
    : [];
  if (
    !validCents(peninsula?.lowOrderLimitCents)
    || !validCents(peninsula?.freeFromCents)
    || !validCents(peninsula?.under25Cents)
    || !validCents(peninsula?.from25To39Cents)
    || !validCents(balearic?.freeFromCents)
    || !validCents(balearic?.under40Cents)
    || !validCents(europe?.flatRateCents)
    || !countries.some((country) => country.code === 'ES')
  ) return null;
  return {
    currency: payload.currency ?? STORE_CONFIG.currency,
    shipping: {
      peninsula: { ...peninsula },
      balearic: { ...balearic },
      europe: { ...europe },
    },
    availableZones: Array.isArray(payload.availableZones) ? [...payload.availableZones] : [],
    countries,
  };
}

export function loadShippingPolicy() {
  if (!policyPromise) {
    policyPromise = fetch(STORE_CONFIG_ENDPOINT, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Store config HTTP ${response.status}`);
        const policy = normalizeShippingPolicy(await response.json());
        if (!policy) throw new Error('INVALID_STORE_CONFIG');
        return policy;
      });
  }
  return policyPromise;
}

export function calculateEstimatedShipping(policy, destination, subtotalCents) {
  if (!policy || !Number.isSafeInteger(subtotalCents) || subtotalCents < 0) return { shippingCents: null, zone: null, error: null };
  const country = String(destination?.country ?? '').toUpperCase();
  const postalCode = String(destination?.postalCode ?? '').replace(/\s+/g, '');
  const province = String(destination?.province ?? '').trim();
  if (!country) return { shippingCents: null, zone: null, error: null };

  if (country === 'ES') {
    if (!/^\d{5}$/.test(postalCode) || !province) return { shippingCents: null, zone: null, error: null };
    const zone = spanishPostalZone(postalCode);
    if (zone === 'canary') return { shippingCents: null, zone: null, error: 'CANARY_NOT_AVAILABLE' };
    if (zone === 'ceuta') return { shippingCents: null, zone: null, error: 'CEUTA_NOT_AVAILABLE' };
    if (zone === 'melilla') return { shippingCents: null, zone: null, error: 'MELILLA_NOT_AVAILABLE' };
    if (zone === 'balearic') {
      const rates = policy.shipping.balearic;
      const shippingCents = subtotalCents < rates.freeFromCents ? rates.under40Cents : 0;
      return { shippingCents, zone, error: null };
    }
    const rates = policy.shipping.peninsula;
    let shippingCents;
    if (subtotalCents < rates.lowOrderLimitCents) shippingCents = rates.under25Cents;
    else if (subtotalCents < rates.freeFromCents) shippingCents = rates.from25To39Cents;
    else shippingCents = 0;
    return { shippingCents, zone: 'peninsula', error: null };
  }

  if (policy.countries.some((entry) => entry.code === country)) {
    return { shippingCents: policy.shipping.europe.flatRateCents, zone: 'europe', error: null };
  }
  return { shippingCents: null, zone: null, error: country === 'GB' || country === 'US' ? 'INTERNATIONAL_NOT_AVAILABLE' : 'UNSUPPORTED_COUNTRY' };
}

export function shippingErrorMessage(code) {
  const messages = {
    CANARY_NOT_AVAILABLE: 'Actualmente no realizamos envíos a Islas Canarias.',
    CEUTA_NOT_AVAILABLE: 'Actualmente no realizamos envíos a Ceuta.',
    MELILLA_NOT_AVAILABLE: 'Actualmente no realizamos envíos a Melilla.',
    INTERNATIONAL_NOT_AVAILABLE: 'Actualmente no realizamos envíos a este destino.',
    UNSUPPORTED_COUNTRY: 'Actualmente no realizamos envíos a este destino.',
    INVALID_SHIPPING: 'Revisa el país, la provincia y el código postal.',
  };
  return messages[code] ?? 'No se ha podido iniciar el pago. Inténtalo de nuevo.';
}

export function saveShippingDestination(destination) {
  sessionStorage.setItem(DESTINATION_STORAGE_KEY, JSON.stringify(destination));
}

export function readShippingDestination() {
  try {
    return JSON.parse(sessionStorage.getItem(DESTINATION_STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
}
