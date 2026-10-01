import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseUrl = process.env.MERCH_BASE_URL ?? 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const screenshots = path.resolve('artifacts', 'merch-qa');
await mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];
const failedRequests = [];

function watchPage(page) {
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`));
}

async function openPage(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  watchPage(page);
  return { context, page };
}

async function loadProductImages(page) {
  const images = page.locator('.product-card img');
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((node) => node.decode());
  }
}

async function firstRowCount(page) {
  return page.locator('.product-card').evaluateAll((cards) => {
    if (!cards.length) return 0;
    const firstTop = cards[0].getBoundingClientRect().top;
    return cards.filter((card) => Math.abs(card.getBoundingClientRect().top - firstTop) < 1).length;
  });
}

async function cardNames(page) {
  return page.locator('.product-card h3').allTextContents();
}

const orderedNames = [
  'Gorra Under Headbang Dealers',
  'Encendedor de plasma Headbang Dealers',
  'Llavero Headbang Dealers',
  'Camiseta Bass Traffickers',
  'Llavero FERAL Club NFC',
  'Clipper Night of Wolves — Naranja',
  'Clipper Night of Wolves — Azul',
];

try {
  const { context, page } = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/merch/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.merch-hero').count(), 0);
  assert.equal(await page.getByText('WEAR THE UNDERGROUND', { exact: true }).count(), 0);
  assert.equal(await page.locator('.catalog-banner').count(), 1);
  assert.equal((await page.locator('h1').innerText()).replace(/\s+/g, ' ').trim(), 'Descubre la filosofía LICAN a través de nuestros productos. La REVOLUCIÓN del merchandise en eventos. Lleva en tu día a día la cultura BASS.');
  assert.equal(await page.locator('.catalog-banner__background').count(), 1);
  assert.equal(await page.locator('.catalog-banner__background').evaluate((image) => image.complete && image.naturalWidth === 2172 && image.naturalHeight === 724), true);
  assert.equal(await page.locator('.catalog-banner').evaluate((banner) => banner.getBoundingClientRect().height < 300), true);
  assert.equal(await page.locator('.catalog-banner h1 span').first().evaluate((line) => line.getBoundingClientRect().height <= Number.parseFloat(getComputedStyle(line).lineHeight) + 1), true);
  assert.equal((await page.locator('.catalog-banner').innerText()).includes('DROP'), false);
  assert.equal((await page.locator('.catalog-banner').innerText()).includes('PIEZAS'), false);
  assert.equal(await page.locator('#colecciones, [data-collections]').count(), 0);
  assert.equal(await page.locator('#catalogo').evaluate((element) => element.getBoundingClientRect().top < 100), true);
  assert.equal(await page.locator('.product-card').count(), 7);
  assert.equal(await firstRowCount(page), 4);
  assert.deepEqual(await cardNames(page), orderedNames);
  assert.deepEqual(await page.locator('.product-card__meta strong').allInnerTexts(), [
    '20,00 €', '10,00 €', '3,00 €', 'Precio pendiente', '3,00 €', '3,00 €', '3,00 €',
  ]);
  assert.deepEqual(await page.locator('.product-card__offer').allInnerTexts(), ['OFERTA\n5,00 €', 'OFERTA\n5,00 €']);
  assert.equal(await page.locator('.product-card__image--secondary').count(), 7);
  assert.equal(await page.locator('.product-card__image--secondary').evaluateAll((images) => images.every((image) => image.src.endsWith('-02.webp'))), true);
  assert.equal(await page.locator('.product-card').nth(0).locator('.product-card__signal').innerText(), 'PREVENTA');
  assert.equal(await page.locator('.product-card').nth(3).locator('.product-card__signal').innerText(), 'SOLD OUT');
  assert.equal(await page.locator('.product-card__add:not([disabled])').count(), 6);
  assert.equal(await page.locator('.product-card').nth(3).locator('.product-card__add').isDisabled(), true);
  assert.equal(await page.locator('.product-card').nth(3).locator('.quantity-stepper button:disabled').count(), 2);
  await loadProductImages(page);
  assert.equal(await page.locator('.product-card img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), true);
  assert.equal(await page.locator('.product-card img').evaluateAll((images) => images.every((image) => getComputedStyle(image).objectFit === 'contain')), true);
  assert.equal(await page.locator('.product-card__description').evaluateAll((descriptions) => descriptions.every((description) => description.clientHeight <= Number.parseFloat(getComputedStyle(description).lineHeight) * 2 + 1)), true);
  await page.locator('.product-card').first().hover();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.product-card').first().locator('.product-card__image--primary').evaluate((image) => getComputedStyle(image).opacity), '0');
  assert.equal(await page.locator('.product-card').first().locator('.product-card__image--secondary').evaluate((image) => getComputedStyle(image).opacity), '1');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  await page.screenshot({ path: path.join(screenshots, 'desktop-1440.webp'), fullPage: true });

  const filterCounts = new Map([
    ['HEADBANG DEALERS', 4],
    ['FERAL', 1],
    ['NIGHT OF WOLVES', 2],
  ]);
  for (const [filter, count] of filterCounts) {
    await page.getByRole('button', { name: filter, exact: true }).click();
    assert.equal(await page.locator('.product-card').count(), count, `${filter} filter`);
  }
  await page.getByRole('button', { name: 'TODOS', exact: true }).click();
  assert.deepEqual(await cardNames(page), orderedNames);

  const capCard = page.locator('.product-card').first();
  await capCard.getByRole('button', { name: 'Aumentar cantidad' }).click();
  await capCard.getByRole('button', { name: 'Aumentar cantidad' }).click();
  assert.equal(await capCard.locator('.quantity-stepper__value').innerText(), '3');
  await capCard.getByRole('button', { name: 'AÑADIR AL CARRITO' }).click();
  assert.equal(await page.locator('.cart-count').innerText(), '3');
  assert.equal(await page.locator('.cart-line').count(), 1);
  assert.equal(await page.locator('.cart-line input').inputValue(), '3');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.cart-count').innerText(), '3');
  await page.getByRole('button', { name: 'Abrir carrito' }).click();
  assert.equal(await page.locator('.cart-line input').inputValue(), '3');
  await page.getByRole('button', { name: 'VACIAR CARRITO' }).click();
  assert.equal(await page.locator('.cart-count').innerText(), '0');

  await page.goto(`${baseUrl}/merch/product.html?product=camiseta-bass-traffickers-headbang-dealers`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('[data-product-name]').innerText(), /CAMISETA BASS TRAFFICKERS/i);
  assert.equal(await page.locator('[data-product-thumbnails] button').count(), 10);
  assert.equal(await page.locator('[data-product-main-image]').evaluate((image) => getComputedStyle(image).objectFit), 'contain');
  assert.equal(await page.locator('.product-status-badge').innerText(), 'SOLD OUT');
  assert.equal(await page.locator('[data-add-to-cart]').isDisabled(), true);
  assert.equal(await page.locator('[data-quantity]').isDisabled(), true);
  assert.equal(await page.locator('[data-size-select]').isDisabled(), true);
  assert.equal(await page.locator('[data-add-to-cart]').innerText(), 'AGOTADO');
  await page.locator('[data-add-to-cart]').click({ force: true });
  assert.equal(await page.locator('.cart-count').innerText(), '0');
  await page.screenshot({ path: path.join(screenshots, 'product-desktop.webp'), fullPage: true });

  await page.goto(`${baseUrl}/merch/product.html?product=gorra-under-headbang-dealers`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.product-status-badge').innerText(), 'PREVENTA');
  assert.match(await page.locator('[data-purchase-note]').innerText(), /fecha de entrega.*no est[áa] confirmada/i);

  for (const [slug, color] of [
    ['night-of-wolves-clipper-orange', 'Naranja'],
    ['night-of-wolves-clipper-blue', 'Azul'],
  ]) {
    await page.goto(`${baseUrl}/merch/product.html?product=${slug}`, { waitUntil: 'networkidle' });
    assert.match(await page.locator('[data-product-name]').innerText(), new RegExp(color, 'i'));
    assert.equal(await page.locator('[data-product-price]').innerText(), '3,00 €');
    assert.equal((await page.locator('.product-offer').innerText()).replace(/\s+/g, ' ').trim(), 'OFERTA 5,00 €');
    assert.equal(await page.locator('[data-product-thumbnails] button').count(), 2);
  }
  await context.close();

  for (const width of [320, 375, 390, 430, 768, 1024, 1920]) {
    const responsive = await openPage({ width, height: width <= 430 ? 860 : 1000 });
    await responsive.page.goto(`${baseUrl}/merch/`, { waitUntil: 'networkidle' });
    assert.equal(await responsive.page.evaluate(() => window.innerWidth), width);
    assert.equal(await responsive.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `overflow at ${width}px`);
    assert.equal(await responsive.page.locator('.product-card').count(), 7);
    const expectedColumns = width >= 1101 ? 4 : width >= 801 ? 3 : width >= 561 ? 2 : 1;
    assert.equal(await firstRowCount(responsive.page), expectedColumns, `grid columns at ${width}px`);
    if (width === 390) {
      await loadProductImages(responsive.page);
      await responsive.page.screenshot({ path: path.join(screenshots, 'mobile-390.webp'), fullPage: true });
    }
    await responsive.context.close();
  }

  const checkout = await openPage({ width: 390, height: 860 });
  await checkout.page.goto(`${baseUrl}/merch/checkout.html`, { waitUntil: 'networkidle' });
  assert.equal(await checkout.page.locator('[data-pay]').isDisabled(), true);
  assert.match(await checkout.page.locator('[data-checkout-blocker]').innerText(), /precio|pago/i);
  assert.equal(await checkout.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  await checkout.page.screenshot({ path: path.join(screenshots, 'checkout-mobile.webp'), fullPage: true });
  await checkout.context.close();

  const status = await openPage({ width: 390, height: 860 });
  await status.page.goto(`${baseUrl}/merch/success.html?mode=mock&order=MOCK-QA`, { waitUntil: 'networkidle' });
  assert.match(await status.page.locator('[data-status-copy]').innerText(), /ning[úu]n cobro/i);
  assert.match(await status.page.locator('[data-order-id]').innerText(), /MOCK-QA/);
  await status.context.close();

  const mockContext = await browser.newContext({ viewport: { width: 390, height: 860 } });
  await mockContext.addInitScript(() => {
    window.addEventListener('lican:commerce', (event) => {
      const events = JSON.parse(sessionStorage.getItem('qa-commerce-events') ?? '[]');
      events.push(event.detail.event);
      sessionStorage.setItem('qa-commerce-events', JSON.stringify(events));
    });
  });
  await mockContext.route('**/merch/js/config.js', async (route) => {
    const response = await route.fetch();
    const source = (await response.text()).replace('peninsula: null', 'peninsula: 495');
    await route.fulfill({ response, body: source, contentType: 'application/javascript' });
  });
  const mockPage = await mockContext.newPage();
  watchPage(mockPage);
  await mockPage.goto(`${baseUrl}/merch/`, { waitUntil: 'networkidle' });
  const mockCap = mockPage.locator('.product-card').first();
  await mockCap.getByRole('button', { name: 'Aumentar cantidad' }).click();
  await mockCap.getByRole('button', { name: 'Aumentar cantidad' }).click();
  await mockCap.getByRole('button', { name: 'AÑADIR AL CARRITO' }).click();
  assert.equal(await mockPage.locator('.cart-count').innerText(), '3');
  await mockPage.locator('.cart-summary .button--primary').click();
  await mockPage.waitForLoadState('networkidle');
  await mockPage.locator('[name="firstName"]').fill('QA');
  await mockPage.locator('[name="lastName"]').fill('LICAN');
  await mockPage.locator('[name="email"]').fill('qa@example.invalid');
  await mockPage.locator('[name="phone"]').fill('+34000000000');
  await mockPage.locator('[name="address"]').fill('Dirección de prueba 1');
  await mockPage.locator('[name="postalCode"]').fill('43001');
  await mockPage.locator('[name="city"]').fill('Tarragona');
  await mockPage.locator('[name="region"]').fill('Tarragona');
  await mockPage.locator('[name="shippingMethod"]').selectOption('peninsula');
  await mockPage.locator('[name="terms"]').check();
  assert.equal(await mockPage.locator('[data-pay]').isEnabled(), true);
  assert.match(await mockPage.locator('[data-total]').innerText(), /64,95/);
  await mockPage.locator('[data-pay]').click();
  await mockPage.waitForURL('**/merch/success.html?mode=mock&order=*');
  assert.match(await mockPage.locator('[data-status-copy]').innerText(), /ning[úu]n cobro/i);
  const trackedEvents = JSON.parse(await mockPage.evaluate(() => sessionStorage.getItem('qa-commerce-events')));
  assert.equal(trackedEvents.includes('add_to_cart'), true);
  assert.equal(trackedEvents.includes('begin_checkout'), true);
  assert.equal(trackedEvents.includes('purchase'), false);
  assert.equal(await mockPage.evaluate(() => JSON.parse(localStorage.getItem('lican-merch-cart-v1')).items.length), 0);
  await mockContext.close();

  const main = await openPage({ width: 1440, height: 900 });
  await main.page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  assert.equal(await main.page.locator('a[href="/merch/"]').count() >= 1, true);
  await main.context.close();

  assert.deepEqual(failedRequests, [], `Failed requests:\n${failedRequests.join('\n')}`);
  assert.deepEqual(errors, [], `Console errors:\n${errors.join('\n')}`);
  console.log('Browser smoke test passed: 7-product catalog, quick buy, sold-out/preorder states, split Clippers, cart, full mock checkout and responsive layouts.');
} finally {
  await browser.close();
}
