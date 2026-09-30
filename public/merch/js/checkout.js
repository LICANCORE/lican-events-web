import { cartTotals, clearCart, readCart } from './cart.js';
import { PAYMENT_ENDPOINT, PAYMENT_MODE, STORE_CONFIG } from './config.js';
import { loadCatalog } from './data.js';
import { track } from './tracking.js';
import { initShell } from './ui.js';
import { createElement, formatMoney, qs, safeRedirectTarget } from './utils.js';

let catalog;
let selectedShippingCents = null;

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
  button.disabled = !ready;
  button.textContent = ready ? 'PAGAR CON SUMUP' : 'CHECKOUT PENDIENTE DE ACTIVAR';
  qs('[data-checkout-blocker]').hidden = ready;
  return { totals, ready };
}

function cleanField(formData, name, maxLength = 160) {
  return String(formData.get(name) ?? '').trim().slice(0, maxLength);
}

async function submitCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const { totals, ready } = renderSummary();
  if (!ready) return;
  const formData = new FormData(form);
  const order = {
    customer: {
      firstName: cleanField(formData, 'firstName', 80),
      lastName: cleanField(formData, 'lastName', 120),
      email: cleanField(formData, 'email', 160),
      phone: cleanField(formData, 'phone', 40),
    },
    shipping: {
      address: cleanField(formData, 'address', 180),
      postalCode: cleanField(formData, 'postalCode', 16),
      city: cleanField(formData, 'city', 100),
      region: cleanField(formData, 'region', 100),
      country: cleanField(formData, 'country', 2),
      method: cleanField(formData, 'shippingMethod', 40),
    },
    items: totals.lines.map((line) => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity })),
  };

  const button = qs('[data-pay]');
  button.disabled = true;
  button.textContent = 'PREPARANDO PAGO…';
  track('begin_checkout', { currency: STORE_CONFIG.currency, value: totals.totalCents / 100, items: order.items });

  try {
    if (PAYMENT_MODE === 'mock') {
      const mockOrderId = `MOCK-${Date.now().toString(36).toUpperCase()}`;
      sessionStorage.setItem('lican-merch-mock-order', JSON.stringify({ id: mockOrderId, order, createdAt: new Date().toISOString() }));
      clearCart();
      window.location.assign(`./success.html?mode=mock&order=${encodeURIComponent(mockOrderId)}`);
      return;
    }

    const response = await fetch(PAYMENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(order),
    });
    if (!response.ok) throw new Error('No se pudo crear el checkout.');
    const payload = await response.json();
    if (!safeRedirectTarget(payload.hosted_checkout_url)) throw new Error('La URL de pago recibida no es válida.');
    window.location.assign(payload.hosted_checkout_url);
  } catch (error) {
    sessionStorage.setItem('lican-merch-payment-error', error.message);
    window.location.assign('./error.html');
  }
}

async function initCheckout() {
  await initShell();
  catalog = await loadCatalog();
  const shipping = qs('[name="shippingMethod"]');
  const shippingLabels = {
    peninsula: 'Península',
    balearic: 'Baleares',
    canary: 'Canarias',
    eu: 'Unión Europea',
    international: 'Internacional',
    eventPickup: 'Recogida en evento',
  };
  const availableMethods = Object.entries(STORE_CONFIG.shipping)
    .filter(([key, cents]) => key !== 'freeShippingFromCents' && Number.isInteger(cents));
  if (!availableMethods.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = STORE_CONFIG.shippingMessage;
    shipping.append(option);
    shipping.disabled = true;
  } else {
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
  renderSummary();
  qs('[data-checkout-form]').addEventListener('submit', submitCheckout);
}

initCheckout().catch((error) => {
  qs('[data-checkout-main]').replaceChildren(createElement('p', 'notice notice--error', error.message));
});
