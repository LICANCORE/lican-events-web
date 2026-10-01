import { loadCatalog } from './data.js';
import { addItem, cartTotals, clearCart, readCart, removeItem, updateItem, writeCart } from './cart.js';
import { track } from './tracking.js';
import { createElement, formatMoney, productUrl, qs } from './utils.js';

function buildHeader() {
  const header = qs('[data-site-header]');
  if (!header) return;

  const nav = createElement('nav', 'merch-nav');
  nav.setAttribute('aria-label', 'Navegación de LICAN MERCH');

  const brand = createElement('a', 'merch-brand');
  brand.href = './';
  brand.setAttribute('aria-label', 'LICAN MERCH — inicio');
  brand.append(createElement('span', '', 'LICAN'), createElement('span', '', 'MERCH'));

  const links = createElement('div', 'merch-nav__links');
  const shopLink = createElement('a', '', 'CATÁLOGO');
  shopLink.href = './#catalogo';
  const mainLink = createElement('a', '', 'LICAN EVENTS ↗');
  mainLink.href = '/';
  links.append(shopLink, mainLink);

  const actions = createElement('div', 'merch-nav__actions');
  const menuButton = createElement('button', 'icon-button merch-nav__menu', 'MENÚ');
  menuButton.type = 'button';
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  const cartButton = createElement('button', 'cart-trigger');
  cartButton.type = 'button';
  cartButton.setAttribute('aria-label', 'Abrir carrito');
  cartButton.append(document.createTextNode('CARRITO '), createElement('span', 'cart-count', '0'));
  cartButton.addEventListener('click', openCart);
  actions.append(menuButton, cartButton);
  nav.append(brand, links, actions);
  header.append(nav);
}

function buildFooter() {
  const footer = qs('[data-site-footer]');
  if (!footer) return;
  const grid = createElement('div', 'merch-footer__grid');
  const about = createElement('div');
  const title = createElement('p', 'merch-footer__brand', 'LICAN MERCH');
  about.append(title, createElement('p', 'muted', 'Merchandising oficial de LICAN EVENTS. Escena, colección y cultura bass.'));

  const nav = createElement('div', 'merch-footer__links');
  const navTitle = createElement('strong', '', 'NAVEGACIÓN');
  const catalog = createElement('a', '', 'Catálogo'); catalog.href = './#catalogo';
  const lican = createElement('a', '', 'LICAN EVENTS'); lican.href = '/';
  const contact = createElement('a', '', 'info@licanevents.com'); contact.href = 'mailto:info@licanevents.com';
  nav.append(navTitle, catalog, lican, contact);

  const legal = createElement('div', 'merch-footer__links');
  legal.id = 'legal-pending';
  legal.append(createElement('strong', '', 'LEGAL'));
  const privacy = createElement('a', '', 'Privacidad'); privacy.href = '/privacidad';
  legal.append(privacy, createElement('span', 'muted', 'Compra · devoluciones · envíos: documentos pendientes'));
  grid.append(about, nav, legal);
  footer.append(grid, createElement('p', 'merch-footer__copy', `© ${new Date().getFullYear()} LICAN EVENTS`));
}

function buildDrawer() {
  const host = qs('[data-cart-host]');
  if (!host) return;
  host.className = 'cart-layer';
  host.hidden = true;

  const backdrop = createElement('button', 'cart-backdrop');
  backdrop.type = 'button';
  backdrop.setAttribute('aria-label', 'Cerrar carrito');
  backdrop.addEventListener('click', closeCart);

  const drawer = createElement('aside', 'cart-drawer');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-labelledby', 'cart-title');
  const head = createElement('div', 'cart-drawer__head');
  const heading = createElement('div');
  heading.append(createElement('span', 'eyebrow', 'TU SELECCIÓN'), createElement('h2', '', 'CARRITO'));
  const close = createElement('button', 'icon-button', 'CERRAR ×');
  close.type = 'button';
  close.addEventListener('click', closeCart);
  head.append(heading, close);
  drawer.append(head, createElement('div', 'cart-drawer__body'));
  host.append(backdrop, drawer);
}

export function openCart() {
  const host = qs('[data-cart-host]');
  if (!host) return;
  host.hidden = false;
  requestAnimationFrame(() => host.classList.add('is-open'));
  document.body.classList.add('drawer-open');
  renderCart();
  track('view_cart');
}

export function closeCart() {
  const host = qs('[data-cart-host]');
  if (!host) return;
  host.classList.remove('is-open');
  document.body.classList.remove('drawer-open');
  window.setTimeout(() => { host.hidden = true; }, 220);
}

function renderCartLine(line) {
  const article = createElement('article', 'cart-line');
  const image = document.createElement('img');
  image.src = line.product.images[0]?.src ?? '';
  image.alt = '';
  image.width = 88;
  image.height = 104;

  const content = createElement('div', 'cart-line__content');
  content.append(createElement('span', 'eyebrow', line.product.brand), createElement('h3', '', line.product.name));
  if (line.variant) content.append(createElement('p', 'muted', line.variant.name));
  content.append(createElement('p', 'cart-line__price', formatMoney(line.lineTotalCents)));

  const controls = createElement('div', 'cart-line__controls');
  const quantity = document.createElement('input');
  quantity.type = 'number';
  quantity.min = '1';
  quantity.max = '99';
  quantity.value = String(line.quantity);
  quantity.setAttribute('aria-label', `Cantidad de ${line.product.name}`);
  quantity.addEventListener('change', () => {
    writeCart(updateItem(readCart(), line.productId, line.variantId, Number.parseInt(quantity.value, 10)));
  });
  const remove = createElement('button', 'text-button', 'ELIMINAR');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    writeCart(removeItem(readCart(), line.productId, line.variantId));
    track('remove_from_cart', { item_id: line.productId, quantity: line.quantity });
  });
  controls.append(quantity, remove);
  content.append(controls);
  article.append(image, content);
  return article;
}

export async function renderCart() {
  const body = qs('.cart-drawer__body');
  if (!body) return;
  body.replaceChildren(createElement('p', 'muted', 'Cargando carrito…'));
  try {
    const catalog = await loadCatalog();
    const totals = cartTotals(readCart(), catalog);
    document.querySelectorAll('.cart-count').forEach((node) => { node.textContent = String(totals.itemCount); });
    body.replaceChildren();

    if (!totals.lines.length) {
      const empty = createElement('div', 'cart-empty');
      empty.append(createElement('p', '', 'Tu carrito está vacío.'), createElement('p', 'muted', 'Explora el drop y vuelve cuando encuentres tu pieza.'));
      const browse = createElement('a', 'button button--primary', 'EXPLORAR DROP');
      browse.href = './#catalogo';
      browse.addEventListener('click', closeCart);
      empty.append(browse);
      body.append(empty);
      return;
    }

    const list = createElement('div', 'cart-lines');
    totals.lines.forEach((line) => list.append(renderCartLine(line)));
    const summary = createElement('div', 'cart-summary');
    const subtotal = createElement('div', 'cart-summary__row');
    subtotal.append(createElement('span', '', 'Subtotal'), createElement('strong', '', formatMoney(totals.subtotalCents)));
    summary.append(subtotal);
    if (!totals.pricesComplete) summary.append(createElement('p', 'notice notice--warning', 'Faltan precios confirmados. El checkout seguirá bloqueado hasta completar el catálogo.'));
    const checkout = createElement('a', `button button--primary${totals.pricesComplete ? '' : ' is-disabled'}`, 'IR AL CHECKOUT');
    checkout.href = totals.pricesComplete ? './checkout.html' : '#';
    checkout.setAttribute('aria-disabled', String(!totals.pricesComplete));
    const empty = createElement('button', 'button button--ghost', 'VACIAR CARRITO');
    empty.type = 'button';
    empty.addEventListener('click', () => clearCart());
    summary.append(checkout, empty);
    body.append(list, summary);
  } catch (error) {
    body.replaceChildren(createElement('p', 'notice notice--error', error.message));
  }
}

export function createProductCard(product) {
  const article = createElement('article', `product-card product-card--${product.brand.toLowerCase().replace(/[^a-z]+/g, '-')}`);
  const isSoldOut = product.stock === 0 || product.availability === 'sold-out';
  const isPreorder = product.preorder === true || product.availability === 'preorder';
  const link = createElement('a', 'product-card__media');
  link.href = productUrl(product);
  const image = document.createElement('img');
  image.src = product.images[0]?.src ?? '';
  image.alt = product.images[0]?.alt ?? product.name;
  image.width = product.images[0]?.width ?? 800;
  image.height = product.images[0]?.height ?? 1000;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.className = 'product-card__image product-card__image--primary';
  const signalLabel = isSoldOut ? 'SOLD OUT' : isPreorder ? 'PREVENTA' : product.availability === 'coming-soon' ? 'PRÓXIMAMENTE' : null;
  link.append(image);
  if (product.images[1]) {
    const hoverImage = document.createElement('img');
    hoverImage.src = product.images[1].src;
    hoverImage.alt = '';
    hoverImage.width = product.images[1].width ?? 800;
    hoverImage.height = product.images[1].height ?? 1000;
    hoverImage.loading = 'lazy';
    hoverImage.decoding = 'async';
    hoverImage.className = 'product-card__image product-card__image--secondary';
    hoverImage.setAttribute('aria-hidden', 'true');
    link.append(hoverImage);
  }
  if (signalLabel) {
    const signalModifier = isSoldOut ? ' product-card__signal--sold-out' : isPreorder ? ' product-card__signal--preorder' : '';
    link.append(createElement('span', `product-card__signal${signalModifier}`, signalLabel));
  }

  const body = createElement('div', 'product-card__body');
  body.append(
    createElement('p', 'eyebrow', `${product.brand} · ${product.collection}`),
    createElement('h3', '', product.name),
    createElement('p', 'product-card__description', product.description),
  );
  const meta = createElement('div', 'product-card__meta');
  if (Number.isInteger(product.priceCents) && Number.isInteger(product.compareAtPriceCents) && product.compareAtPriceCents > product.priceCents) {
    const offer = createElement('div', 'product-card__offer');
    offer.append(
      createElement('span', '', product.offerLabel ?? 'OFERTA'),
      createElement('del', '', formatMoney(product.compareAtPriceCents)),
    );
    meta.append(offer);
  }
  const stockLabel = isSoldOut ? 'SOLD OUT' : Number.isInteger(product.stock) ? `${product.stock} EN STOCK` : product.purchasable ? 'DISPONIBLE' : 'STOCK POR CONFIRMAR';
  meta.append(
    createElement('strong', '', formatMoney(product.priceCents)),
    createElement('span', `status-dot${isSoldOut ? ' status-dot--sold-out' : ''}`, stockLabel),
  );
  const purchase = createElement('div', 'product-card__purchase');
  const stepper = createElement('div', 'quantity-stepper');
  stepper.setAttribute('aria-label', `Cantidad de ${product.name}`);
  const decrease = createElement('button', 'quantity-stepper__button', '−');
  decrease.type = 'button';
  decrease.setAttribute('aria-label', 'Disminuir cantidad');
  const quantityValue = createElement('output', 'quantity-stepper__value', '1');
  quantityValue.setAttribute('aria-live', 'polite');
  const increase = createElement('button', 'quantity-stepper__button', '+');
  increase.type = 'button';
  increase.setAttribute('aria-label', 'Aumentar cantidad');
  const maxQuantity = Number.isInteger(product.stock) && product.stock > 0 ? product.stock : 99;
  let quantity = 1;
  const syncQuantity = () => { quantityValue.textContent = String(quantity); };
  decrease.addEventListener('click', () => { quantity = Math.max(1, quantity - 1); syncQuantity(); });
  increase.addEventListener('click', () => { quantity = Math.min(maxQuantity, quantity + 1); syncQuantity(); });
  stepper.append(decrease, quantityValue, increase);

  let addButton;
  if (product.requiresSize && !isSoldOut) {
    addButton = createElement('a', 'product-card__add', 'SELECCIONAR OPCIONES');
    addButton.href = productUrl(product);
  } else {
    addButton = createElement('button', 'product-card__add', isSoldOut ? 'AGOTADO' : 'AÑADIR AL CARRITO');
    addButton.type = 'button';
    const canQuickAdd = !isSoldOut && product.purchasable && Number.isInteger(product.priceCents);
    addButton.disabled = !canQuickAdd;
    if (canQuickAdd) {
      addButton.addEventListener('click', () => {
        const cart = readCart();
        const existing = cart.items.find((item) => item.productId === product.id && item.variantId === null)?.quantity ?? 0;
        const allowedQuantity = Number.isInteger(product.stock) ? Math.max(0, product.stock - existing) : quantity;
        const quantityToAdd = Math.min(quantity, allowedQuantity);
        if (quantityToAdd < 1) {
          openCart();
          return;
        }
        writeCart(addItem(cart, product.id, null, quantityToAdd));
        track('add_to_cart', {
          currency: product.currency,
          value: (product.priceCents * quantityToAdd) / 100,
          items: [{ item_id: product.id, item_name: product.name, price: product.priceCents / 100, quantity: quantityToAdd }],
        });
        openCart();
      });
    }
  }
  if (isSoldOut || product.requiresSize) {
    decrease.disabled = true;
    increase.disabled = true;
    stepper.classList.add('quantity-stepper--disabled');
  }

  const action = createElement('a', 'product-card__action', 'VER PRODUCTO →');
  action.href = productUrl(product);
  purchase.append(stepper, addButton, action);
  body.append(meta, purchase);
  article.append(link, body);
  return article;
}

export async function initShell() {
  buildHeader();
  buildFooter();
  buildDrawer();
  await renderCart();
  window.addEventListener('lican:cart-change', renderCart);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCart(); });
}
