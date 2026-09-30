import { loadCatalog } from './data.js';
import { createProductCard, initShell } from './ui.js';
import { createElement, qs } from './utils.js';

function renderFilters(products, grid) {
  const host = qs('[data-filters]');
  const brands = ['TODOS', ...new Set(products.map((product) => product.brand))];
  brands.forEach((brand, index) => {
    const button = createElement('button', `filter-chip${index === 0 ? ' is-active' : ''}`, brand);
    button.type = 'button';
    button.addEventListener('click', () => {
      host.querySelectorAll('button').forEach((entry) => entry.classList.toggle('is-active', entry === button));
      grid.replaceChildren();
      products.filter((product) => brand === 'TODOS' || product.brand === brand).forEach((product) => grid.append(createProductCard(product)));
    });
    host.append(button);
  });

}

async function initCatalog() {
  await initShell();
  try {
    const catalog = await loadCatalog();
    const products = catalog.products.filter((product) => product.active);
    const grid = qs('[data-catalog-grid]');
    products.forEach((product) => grid.append(createProductCard(product)));
    renderFilters(products, grid);

    const featured = products.find((product) => product.featured && product.images.length) ?? products[0];
    if (featured) {
      const heroImage = qs('[data-hero-product]');
      heroImage.src = featured.images[0].src;
      heroImage.alt = featured.images[0].alt;
      heroImage.width = featured.images[0].width;
      heroImage.height = featured.images[0].height;
    }
    qs('[data-product-count]').textContent = `${products.length} PIEZAS / DROP 001`;
  } catch (error) {
    qs('[data-catalog-grid]').replaceChildren(createElement('p', 'notice notice--error', error.message));
  }
}

initCatalog();
