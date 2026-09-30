const supportedEvents = new Set([
  'view_item',
  'add_to_cart',
  'remove_from_cart',
  'view_cart',
  'begin_checkout',
  'purchase',
]);

export function track(eventName, payload = {}) {
  if (!supportedEvents.has(eventName)) return;
  const detail = { event: eventName, ...payload };
  window.dispatchEvent(new CustomEvent('lican:commerce', { detail }));

  if (typeof window.gtag === 'function') window.gtag('event', eventName, payload);
  if (typeof window.fbq === 'function') window.fbq('trackCustom', eventName, payload);
}
