import { addItem, readCart, writeCart } from './cart.js';
import { findProduct, loadCatalog } from './data.js';
import { track } from './tracking.js';
import { createProductCard, initShell, openCart } from './ui.js';
import { createElement, formatMoney, getQueryParam, qs } from './utils.js';

function renderGallery(product) {
  const main = qs('[data-product-main-image]');
  const thumbnails = qs('[data-product-thumbnails]');
  const selectImage = (image, button) => {
    main.src = image.src;
    main.alt = image.alt;
    main.width = image.width;
    main.height = image.height;
    thumbnails.querySelectorAll('button').forEach((entry) => entry.classList.toggle('is-active', entry === button));
  };

  product.images.forEach((image, index) => {
    const button = createElement('button', `product-thumb${index === 0 ? ' is-active' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-label', `Ver imagen ${index + 1}`);
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = '';
    img.width = 92;
    img.height = 112;
    img.loading = 'lazy';
    button.append(img);
    button.addEventListener('click', () => selectImage(image, button));
    thumbnails.append(button);
  });
  if (product.images[0]) selectImage(product.images[0], thumbnails.firstElementChild);
}

function renderProduct(product, catalog) {
  document.title = `${product.name} | LICAN MERCH`;
  qs('meta[name="description"]')?.setAttribute('content', product.description);
  qs('[data-product-brand]').textContent = `${product.brand} · ${product.collection}`;
  qs('[data-product-name]').textContent = product.name;
  qs('[data-product-type]').textContent = product.type;
  qs('[data-product-price]').textContent = formatMoney(product.priceCents);
  qs('[data-product-description]').textContent = product.description;
  renderGallery(product);

  const features = qs('[data-product-features]');
  product.features.forEach((feature) => features.append(createElement('li', '', feature)));
  const pending = qs('[data-product-pending]');
  product.pending.forEach((item) => pending.append(createElement('li', '', item)));

  const sizeField = qs('[data-size-field]');
  const sizeSelect = qs('[data-size-select]');
  if (!product.requiresSize) sizeField.hidden = true;
  if (product.requiresSize && !product.variants.length) {
    sizeSelect.disabled = true;
    const option = document.createElement('option');
    option.textContent = 'Tallas pendientes de confirmar';
    option.value = '';
    sizeSelect.append(option);
  } else {
    product.variants.forEach((variant) => {
      const option = document.createElement('option');
      option.value = variant.id;
      option.textContent = variant.name;
      sizeSelect.append(option);
    });
  }

  const addButton = qs('[data-add-to-cart]');
  const purchaseNote = qs('[data-purchase-note]');
  const canPurchase = product.purchasable && Number.isInteger(product.priceCents) && (!product.requiresSize || product.variants.length);
  addButton.disabled = !canPurchase;
  addButton.textContent = canPurchase ? 'AÑADIR AL CARRITO' : 'VENTA PENDIENTE DE ACTIVAR';
  purchaseNote.textContent = canPurchase
    ? 'Impuestos y disponibilidad se validarán antes del pago.'
    : 'Estamos completando precio, stock y condiciones reales. Esta pieza todavía no se puede comprar.';

  addButton.addEventListener('click', () => {
    const variantId = sizeSelect.value || null;
    if (product.requiresSize && !variantId) {
      sizeSelect.setCustomValidity('Selecciona una talla.');
      sizeSelect.reportValidity();
      return;
    }
    const quantity = Math.max(1, Math.min(99, Number.parseInt(qs('[data-quantity]').value, 10) || 1));
    writeCart(addItem(readCart(), product.id, variantId, quantity));
    track('add_to_cart', { currency: product.currency, value: product.priceCents / 100, items: [{ item_id: product.id, quantity }] });
    openCart();
  });

  const related = catalog.products.filter((entry) => entry.id !== product.id && (entry.brand === product.brand || entry.collection === product.collection)).slice(0, 3);
  const relatedGrid = qs('[data-related]');
  related.forEach((entry) => relatedGrid.append(createProductCard(entry)));
  if (!related.length) qs('[data-related-section]').hidden = true;
  track('view_item', { currency: product.currency, value: Number.isInteger(product.priceCents) ? product.priceCents / 100 : undefined, items: [{ item_id: product.id, item_name: product.name }] });
}

async function initProduct() {
  await initShell();
  const host = qs('[data-product-page]');
  try {
    const catalog = await loadCatalog();
    const product = findProduct(catalog, getQueryParam('product'));
    if (!product) throw new Error('No hemos encontrado esta pieza en el catálogo.');
    renderProduct(product, catalog);
    host.hidden = false;
  } catch (error) {
    host.replaceChildren(createElement('div', 'empty-state', error.message));
    host.hidden = false;
  }
}

initProduct();
