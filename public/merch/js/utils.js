export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

export function formatMoney(cents, currency = 'EUR') {
  if (!Number.isInteger(cents)) return 'Precio pendiente';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(cents / 100);
}

export function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function setText(selector, value) {
  const target = qs(selector);
  if (target) target.textContent = value;
}

export function productUrl(product) {
  return `./product.html?product=${encodeURIComponent(product.slug)}`;
}

export function safeRedirectTarget(value) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}
