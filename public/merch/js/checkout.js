import { cartTotals, clearCart, readCart } from './cart.js';
import { PAYMENT_ENDPOINT, PAYMENT_MODE, STORE_CONFIG, STORE_CONFIG_ENDPOINT } from './config.js';
import { loadCatalog } from './data.js';
import { track } from './tracking.js';
import { initShell } from './ui.js';
import { createElement, formatMoney, qs, safeRedirectTarget } from './utils.js';

let catalog;
let shippingConfig = STORE_CONFIG.shipping;
let selectedShippingCents = null;
let submitting = false;

const shippingLabels = {
  peninsula: 'Península',
  balearic: 'Baleares',
  canary: 'Canarias',
  eu: 'Unión Europea',
  international: 'Internacional',
  eventPickup: 'Recogida en evento',
};

function isDevelopment() {
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function normalizeShippingConfig(value) {
  return Object.fromEntries(Object.keys(STORE_CONFIG.shipping).map((key) => {
    const cents = value?.[key];
    return [key, Number.isInteger(cents) && cents >= 0 ? cents : null];
  }));
}

async function loadRemoteStoreConfig() {
  if (PAYMENT_MODE !== 'sumup') return;
  try {
    const response = await fetch(STORE_CONFIG_ENDPOINT, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Store config HTTP ${response.status}`);
    const payload = await response.json();
    shippingConfig = normalizeShippingConfig(payload.shipping);
  } catch (error) {
    if (isDevelopment()) console.warn('No se pudo cargar la configuración pública del Worker.', error.message);
  }
}

function renderSummary() {
  const totals = cartTotals(readCart(), catalog, selectedShippingCents);
  const lines = qs('[data-checkout-lines]');
  lines.replaceChildren();
  totals.lines.forEach((line) => {
    const row = createElement('div', 'checkout-line');
    const copy = createElement('div');
    copy.append(createElement('strong', '', line.product.name), createElement('span', 'muted', `${line.variant?.name ? `${line.variant.name} · ` : ''}Cantidad ${line.quantity}`));
    row.append(copy, createElement('span', '', formatMoney(line.lineTotalCents)));
    lines.append(row);
  });
  if (!totals.lines.length) lines.append(createElement('p', 'notice notice--warning', 'Tu carrito está vacío.'));
  qs('[data-subtotal]').textContent = formatMoney(totals.subtotalCents);
  qs('[data-shipping]').textContent = Number.isInteger(totals.shippingCents) ? formatMoney(totals.shippingCents) : 'Pendiente';
  qs('[data-total]').textContent = formatMoney(totals.totalCents);
  const ready = totals.lines.length > 0 && totals.pricesComplete && Number.isInteger(totals.shippingCents);
  const button = qs('[data-pay]');
  button.disabled = !ready || submitting;
  button.textContent = submitting ? 'CONECTANDO CON SUMUP…' : ready ? 'PAGAR CON SUMUP' : 'CHECKOUT PENDIENTE DE ACTIVAR';
  qs('[data-checkout-blocker]').hidden = ready;
  return { totals, ready };
}

function cleanField(formData, name, maxLength = 160) {
  return String(formData.get(name) ?? '').trim().slice(0, maxLength);
}

function createOrder(formData, totals) {
  return {
    items: totals.lines.map((line) => ({
      id: line.productId,
      quantity: line.quantity,
      variant: line.variantId,
    })),
    customer: {
      name: cleanField(formData, 'firstName', 80),
      surname: cleanField(formData, 'lastName', 120),
      email: cleanField(formData, 'email', 160),
      phone: cleanField(formData, 'phone', 40),
    },
    shipping: {
      address: cleanField(formData, 'address', 180),
      postalCode: cleanField(formData, 'postalCode', 16),
      city: cleanField(formData, 'city', 100),
      province: cleanField(formData, 'region', 100),
      country: cleanField(formData, 'country', 2),
      method: cleanField(formData, 'shippingMethod', 40),
    },
  };
}

function isHostedCheckoutUrl(value) {
  if (!safeRedirectTarget(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'checkout.sumup.com' && url.pathname.startsWith('/pay/');
  } catch {
    return false;
  }
}

async function submitCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (submitting || !form.reportValidity()) return;
  const { totals, ready } = renderSummary();
  if (!ready) return;
  const order = createOrder(new FormData(form), totals);
  const errorNotice = qs('[data-checkout-error]');
  errorNotice.hidden = true;
  submitting = true;
  renderSummary();

  try {
    if (PAYMENT_MODE === 'mock') {
      const mockOrderId = `MOCK-${Date.now().toString(36).toUpperCase()}`;
      sessionStorage.setItem('lican-merch-mock-order', JSON.stringify({ id: mockOrderId, order, createdAt: new Date().toISOString() }));
      track('begin_checkout', { currency: STORE_CONFIG.currency, value: totals.totalCents / 100, items: order.items });
      clearCart();
      window.location.assign(`./success.html?mode=mock&order=${encodeURIComponent(mockOrderId)}`);
      return;
    }

    const response = await fetch(PAYMENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(order),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? 'CHECKOUT_CREATE_FAILED');
    if (!payload.checkout_id || !payload.checkout_reference || !isHostedCheckoutUrl(payload.hosted_checkout_url)) {
      throw new Error('INVALID_CHECKOUT_RESPONSE');
    }

    sessionStorage.setItem('lican_checkout_id', payload.checkout_id);
    sessionStorage.setItem('lican_checkout_reference', payload.checkout_reference);
    track('begin_checkout', { currency: STORE_CONFIG.currency, value: totals.totalCents / 100, items: order.items });
    window.location.href = payload.hosted_checkout_url;
  } catch (error) {
    submitting = false;
    renderSummary();
    errorNotice.hidden = false;
    sessionStorage.setItem('lican-merch-payment-error', 'No se ha podido iniciar el pago. Inténtalo de nuevo.');
    if (isDevelopment()) console.error('Error al iniciar el checkout de SumUp:', error.message);
  }
}

function renderShippingOptions() {
  const shipping = qs('[name="shippingMethod"]');
  const availableMethods = Object.entries(shippingConfig)
    .filter(([key, cents]) => key !== 'freeShippingFromCents' && Number.isInteger(cents));
  if (!availableMethods.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = STORE_CONFIG.shippingMessage;
    shipping.append(option);
    shipping.disabled = true;
    return;
  }

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecciona un método';
  shipping.append(placeholder);
  availableMethods.forEach(([key, cents]) => {
    const option = document.createElement('option');
    option.value = key;
    option.dataset.cents = String(cents);
    option.textContent = `${shippingLabels[key] ?? key} · ${formatMoney(cents)}`;
    shipping.append(option);
  });
  shipping.addEventListener('change', () => {
    selectedShippingCents = shipping.selectedOptions[0]?.dataset.cents
      ? Number.parseInt(shipping.selectedOptions[0].dataset.cents, 10)
      : null;
    renderSummary();
  });
}

async function initCheckout() {
  await initShell();
  [catalog] = await Promise.all([loadCatalog(), loadRemoteStoreConfig()]);
  renderShippingOptions();
  qs('[data-payment-mode]').textContent = PAYMENT_MODE === 'mock'
    ? 'MODO MOCK · NINGÚN COBRO REAL'
    : 'SUMUP · PAGO SEGURO REDIRIGIDO';
  renderSummary();
  qs('[data-checkout-form]').addEventListener('submit', submitCheckout);
}

initCheckout().catch((error) => {
  qs('[data-checkout-main]').replaceChildren(createElement('p', 'notice notice--error', 'No se ha podido cargar el checkout. Inténtalo de nuevo.'));
  if (isDevelopment()) console.error(error);
});
