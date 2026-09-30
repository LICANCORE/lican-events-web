import { initShell } from './ui.js';
import { getQueryParam, qs } from './utils.js';

async function initStatus() {
  await initShell();
  const page = document.body.dataset.status;
  if (page === 'success') {
    const mock = getQueryParam('mode') === 'mock';
    const order = getQueryParam('order');
    qs('[data-status-kicker]').textContent = mock ? 'SIMULACIÓN COMPLETADA' : 'PEDIDO RECIBIDO';
    qs('[data-status-title]').textContent = mock ? 'FLUJO DE PRUEBA FINALIZADO' : 'ESTADO EN VALIDACIÓN';
    qs('[data-status-copy]').textContent = mock
      ? 'No se ha realizado ningún cobro. Esta pantalla valida la interfaz, no acredita un pago real.'
      : 'El backend deberá comprobar el estado con SumUp y el webhook antes de marcar el pedido como pagado.';
    if (order) qs('[data-order-id]').textContent = `Referencia: ${order}`;
  } else {
    const message = sessionStorage.getItem('lican-merch-payment-error');
    if (message) qs('[data-status-copy]').textContent = message;
  }
}

initStatus();
