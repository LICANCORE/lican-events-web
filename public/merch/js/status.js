import { clearCart, readCart } from './cart.js';
import { CHECKOUT_STATUS_ENDPOINT } from './config.js';
import { track } from './tracking.js';
import { initShell } from './ui.js';
import { formatMoney, getQueryParam, qs } from './utils.js';

function isDevelopment() {
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function setStatus({ code, kicker, title, copy, reference = '', notice, actionLabel, actionHref, error = false }) {
  const card = qs('[data-status-card]');
  card.classList.toggle('status-card--error', error);
  qs('[data-status-code]').textContent = code;
  qs('[data-status-kicker]').textContent = kicker;
  qs('[data-status-title]').textContent = title;
  qs('[data-status-copy]').textContent = copy;
  qs('[data-order-id]').textContent = reference;
  qs('[data-status-notice]').textContent = notice;
  const action = qs('[data-status-action]');
  action.textContent = actionLabel;
  action.href = actionHref;
}

function renderMockStatus() {
  const order = getQueryParam('order');
  setStatus({
    code: '✓',
    kicker: 'SIMULACIÓN COMPLETADA',
    title: 'FLUJO DE PRUEBA FINALIZADO',
    copy: 'No se ha realizado ningún cobro. Esta pantalla valida la interfaz, no acredita un pago real.',
    reference: order ? `Referencia: ${order}` : '',
    notice: 'El modo mock nunca confirma ni representa un pago de SumUp.',
    actionLabel: 'VOLVER A LICAN MERCH',
    actionHref: './',
  });
}

function renderUnverifiedStatus(copy = 'No existe un checkout verificable en esta sesión.') {
  setStatus({
    code: '!',
    kicker: 'PAGO NO COMPLETADO',
    title: 'SIN CONFIRMACIÓN',
    copy,
    notice: 'El carrito se conserva. Inicia o reintenta el pago desde el checkout de LICAN MERCH.',
    actionLabel: 'VOLVER AL CHECKOUT',
    actionHref: './checkout.html',
    error: true,
  });
}

function renderCheckoutStatus(payload) {
  const reference = `Referencia: ${payload.checkout_reference}${Number.isFinite(payload.amount) ? ` · Total: ${formatMoney(Math.round(payload.amount * 100), payload.currency)}` : ''}`;
  if (payload.status === 'PAID') {
    const cart = readCart();
    if (payload.sandbox !== true && sessionStorage.getItem(`lican_purchase_tracked_${payload.checkout_id}`) !== '1') {
      track('purchase', {
        transaction_id: payload.checkout_reference,
        value: payload.amount,
        currency: payload.currency,
        items: cart.items.map((item) => ({ item_id: item.productId, item_variant: item.variantId, quantity: item.quantity })),
      });
      sessionStorage.setItem(`lican_purchase_tracked_${payload.checkout_id}`, '1');
    }
    clearCart();
    setStatus({
      code: '✓',
      kicker: payload.sandbox ? 'SUMUP SANDBOX · PAGO VERIFICADO' : 'PAGO VERIFICADO',
      title: 'PEDIDO CONFIRMADO',
      copy: payload.sandbox
        ? 'SumUp ha confirmado el pago de prueba. No se ha movido dinero real.'
        : 'SumUp ha confirmado el pago. Conserva la referencia para cualquier consulta.',
      reference,
      notice: 'El carrito se ha vaciado únicamente después de recibir el estado PAID desde SumUp.',
      actionLabel: 'CONTINUAR EN LICAN MERCH',
      actionHref: './',
    });
    return;
  }

  if (payload.status === 'PENDING') {
    setStatus({
      code: '…',
      kicker: 'ESTADO VERIFICADO',
      title: 'PAGO PENDIENTE',
      copy: 'SumUp todavía no ha confirmado el pago. El carrito se conserva.',
      reference,
      notice: 'Puedes volver a comprobar esta página o regresar al checkout.',
      actionLabel: 'VOLVER AL CHECKOUT',
      actionHref: './checkout.html',
    });
    return;
  }

  setStatus({
    code: '!',
    kicker: 'PAGO NO COMPLETADO',
    title: payload.status === 'EXPIRED' ? 'CHECKOUT CADUCADO' : 'PAGO RECHAZADO',
    copy: 'SumUp no ha confirmado el pago. No se ha vaciado el carrito.',
    reference,
    notice: 'Vuelve al checkout para intentarlo de nuevo.',
    actionLabel: 'VOLVER AL CHECKOUT',
    actionHref: './checkout.html',
    error: true,
  });
}

async function verifyCheckout() {
  const checkoutId = sessionStorage.getItem('lican_checkout_id');
  const expectedReference = sessionStorage.getItem('lican_checkout_reference');
  if (!checkoutId || !expectedReference) {
    renderUnverifiedStatus();
    return;
  }

  try {
    const url = new URL(CHECKOUT_STATUS_ENDPOINT);
    url.searchParams.set('id', checkoutId);
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? 'STATUS_CHECK_FAILED');
    if (payload.checkout_id !== checkoutId || payload.checkout_reference !== expectedReference) throw new Error('CHECKOUT_MISMATCH');
    renderCheckoutStatus(payload);
  } catch (error) {
    renderUnverifiedStatus('No se ha podido verificar el pago con SumUp. No se ha vaciado el carrito.');
    if (isDevelopment()) console.error('Error al verificar el checkout de SumUp:', error.message);
  }
}

async function initStatus() {
  await initShell();
  const page = document.body.dataset.status;
  if (page === 'success') {
    if (getQueryParam('mode') === 'mock') renderMockStatus();
    else await verifyCheckout();
    return;
  }

  const message = sessionStorage.getItem('lican-merch-payment-error');
  if (message) qs('[data-status-copy]').textContent = message;
}

initStatus();
