import { cartTotals, clearCart, readCart } from './cart.js';
import { PAYMENT_ENDPOINT, PAYMENT_MODE, STORE_CONFIG } from './config.js';
import { loadCatalog } from './data.js';
import {
  calculateEstimatedShipping,
  loadShippingPolicy,
  saveShippingDestination,
  shippingErrorMessage,
} from './shipping.js';
import { track } from './tracking.js';
import { initShell } from './ui.js';
import { createElement, formatMoney, qs, safeRedirectTarget } from './utils.js';

let catalog;
let shippingPolicy;
let submitting = false;

function isDevelopment() {
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function cleanField(formData, name, maxLength = 160) {
  return String(formData.get(name) ?? '').trim().slice(0, maxLength);
}

function readDestination() {
  return {
    country: qs('[name="country"]').value,
    postalCode: qs('[name="postalCode"]').value.trim(),
    province: qs('[name="region"]').value.trim(),
  };
}

function renderSummary() {
  const preliminary = cartTotals(readCart(), catalog);
  const destination = readDestination();
  const estimate = calculateEstimatedShipping(shippingPolicy, destination, preliminary.subtotalCents);
  const totals = cartTotals(readCart(), catalog, estimate.shippingCents);
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
  qs('[data-shipping]').textContent = Number.isInteger(totals.shippingCents)
    ? totals.shippingCents === 0 ? 'GRATIS' : formatMoney(totals.shippingCents)
    : 'Pendiente';
  qs('[data-total]').textContent = formatMoney(totals.totalCents);

  const destinationError = qs('[data-destination-error]');
  destinationError.hidden = !estimate.error;
  destinationError.textContent = estimate.error ? shippingErrorMessage(estimate.error) : '';

  const freeShippingMessage = qs('[data-free-shipping-message]');
  const freeShippingZone = ['peninsula', 'balearic'].includes(estimate.zone);
  const freeShippingFrom = freeShippingZone ? shippingPolicy.shipping[estimate.zone].freeFromCents : null;
  freeShippingMessage.hidden = !freeShippingZone || !Number.isInteger(totals.subtotalCents);
  if (!freeShippingMessage.hidden) {
    const remainingCents = Math.max(0, freeShippingFrom - totals.subtotalCents);
    freeShippingMessage.textContent = remainingCents > 0
      ? `Te faltan ${formatMoney(remainingCents)} para conseguir envío gratis.`
      : '¡Tienes envío gratis!';
  }

  const formValid = qs('[data-checkout-form]').checkValidity();
  const ready = totals.lines.length > 0 && totals.pricesComplete && Number.isInteger(totals.shippingCents) && !estimate.error && formValid;
  const blocker = qs('[data-checkout-blocker]');
  blocker.hidden = ready;
  if (!ready) {
    blocker.textContent = estimate.error
      ? shippingErrorMessage(estimate.error)
      : !shippingPolicy
        ? STORE_CONFIG.shippingMessage
        : Number.isInteger(totals.shippingCents)
          ? 'Completa todos los datos obligatorios para continuar.'
          : 'Completa una dirección de envío disponible para calcular el total.';
  }
  const button = qs('[data-pay]');
  button.disabled = !ready || submitting;
  button.textContent = submitting ? 'CONECTANDO CON SUMUP…' : ready ? 'PAGAR CON SUMUP' : 'CHECKOUT PENDIENTE DE ACTIVAR';
  return { totals, ready };
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
    const confirmedTotalCents = Number.isInteger(payload.total_cents) ? payload.total_cents : totals.totalCents;
    track('begin_checkout', { currency: STORE_CONFIG.currency, value: confirmedTotalCents / 100, items: order.items });
    window.location.href = payload.hosted_checkout_url;
  } catch (error) {
    submitting = false;
    renderSummary();
    errorNotice.textContent = shippingErrorMessage(error.message);
    errorNotice.hidden = false;
    sessionStorage.setItem('lican-merch-payment-error', errorNotice.textContent);
    if (isDevelopment()) console.error('Error al iniciar el checkout de SumUp:', error.message);
  }
}

function renderShippingPolicy() {
  const target = qs('[data-shipping-policy]');
  const peninsula = shippingPolicy.shipping.peninsula;
  const balearic = shippingPolicy.shipping.balearic;
  const europe = shippingPolicy.shipping.europe;
  target.replaceChildren(
    createElement('p', 'eyebrow', 'TARIFAS DE ENVÍO'),
    createElement('strong', '', 'Península'),
    createElement('p', 'muted', `Pedidos inferiores a ${formatMoney(peninsula.lowOrderLimitCents)} — envío ${formatMoney(peninsula.under25Cents)}`),
    createElement('p', 'muted', `Pedidos de ${formatMoney(peninsula.lowOrderLimitCents)} a ${formatMoney(peninsula.freeFromCents - 1)} — envío ${formatMoney(peninsula.from25To39Cents)}`),
    createElement('p', 'muted', `Pedidos desde ${formatMoney(peninsula.freeFromCents)} — envío gratis`),
    createElement('strong', '', 'Baleares'),
    createElement('p', 'muted', `Pedidos inferiores a ${formatMoney(balearic.freeFromCents)} — envío ${formatMoney(balearic.under40Cents)}`),
    createElement('p', 'muted', `Pedidos desde ${formatMoney(balearic.freeFromCents)} — envío gratis`),
    createElement('strong', '', 'Europa'),
    createElement('p', 'muted', `Envío europeo — ${formatMoney(europe.flatRateCents)}`),
  );
}

function renderCountries() {
  const select = qs('[name="country"]');
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecciona un país';
  select.append(placeholder);
  shippingPolicy.countries.forEach(({ code, name }) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    select.append(option);
  });
}

function watchForm() {
  const destinationFields = new Set(['country', 'postalCode', 'region']);
  qs('[data-checkout-form]').querySelectorAll('input, select').forEach((field) => {
    field.addEventListener(field.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (destinationFields.has(field.name)) saveShippingDestination(readDestination());
      renderSummary();
    });
  });
  window.addEventListener('lican:cart-change', renderSummary);
}

async function initCheckout() {
  await initShell();
  [catalog, shippingPolicy] = await Promise.all([loadCatalog(), loadShippingPolicy()]);
  renderCountries();
  renderShippingPolicy();
  watchForm();
  qs('[data-payment-mode]').textContent = PAYMENT_MODE === 'mock'
    ? 'MODO MOCK · NINGÚN COBRO REAL'
    : 'SUMUP · PAGO SEGURO REDIRIGIDO';
  renderSummary();
  qs('[data-checkout-form]').addEventListener('submit', submitCheckout);
}

initCheckout().catch((error) => {
  qs('[data-checkout-main]').replaceChildren(createElement('p', 'notice notice--error', 'No se ha podido cargar la política de envíos. Inténtalo de nuevo.'));
  if (isDevelopment()) console.error(error);
});
