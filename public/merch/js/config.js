export const PAYMENT_MODE = 'sumup';

export const SUMUP_API_URL = 'https://lican-merch-api.licancorp.workers.dev';
export const PAYMENT_ENDPOINT = `${SUMUP_API_URL}/create-checkout`;
export const CHECKOUT_STATUS_ENDPOINT = `${SUMUP_API_URL}/checkout-status`;
export const STORE_CONFIG_ENDPOINT = `${SUMUP_API_URL}/store-config`;

export const STORE_CONFIG = Object.freeze({
  currency: 'EUR',
  locale: 'es-ES',
  shipping: null,
  availableZones: [],
  countries: [],
  shippingMessage: 'No se ha podido cargar la política de envíos.',
});

export const LEGAL_LINKS = Object.freeze({
  privacy: { label: 'Privacidad', href: '/privacidad' },
  terms: { label: 'Condiciones de compra', href: '#legal-pending' },
  returns: { label: 'Devoluciones', href: '#legal-pending' },
  shipping: { label: 'Envíos', href: '#legal-pending' },
});
