export const PAYMENT_MODE = 'mock';

export const PAYMENT_ENDPOINT = '/api/create-checkout';

export const STORE_CONFIG = Object.freeze({
  currency: 'EUR',
  locale: 'es-ES',
  shipping: {
    peninsula: null,
    balearic: null,
    canary: null,
    eu: null,
    international: null,
    eventPickup: null,
    freeShippingFromCents: null,
  },
  shippingMessage: 'Tarifas y condiciones de envío pendientes de confirmación.',
});

export const LEGAL_LINKS = Object.freeze({
  privacy: { label: 'Privacidad', href: '/privacidad' },
  terms: { label: 'Condiciones de compra', href: '#legal-pending' },
  returns: { label: 'Devoluciones', href: '#legal-pending' },
  shipping: { label: 'Envíos', href: '#legal-pending' },
});
