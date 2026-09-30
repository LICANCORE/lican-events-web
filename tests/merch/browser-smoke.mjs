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

async function openPage(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}`));
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

try {
  const { context, page } = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/merch/`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('h1').innerText(), /WEAR THE/);
  assert.equal(await page.locator('#colecciones, [data-collections]').count(), 0);
  assert.equal(await page.locator('#catalogo').evaluate((element) => element.getBoundingClientRect().top < 750), true);
  assert.equal(await page.locator('.product-card').count(), 6);
  assert.equal(await firstRowCount(page), 4);
  await loadProductImages(page);
  assert.equal(await page.locator('.product-card img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), true);
  assert.equal(await page.locator('.product-card img').evaluateAll((images) => images.every((image) => getComputedStyle(image).objectFit === 'contain')), true);
  assert.equal(await page.locator('.product-card__description').evaluateAll((descriptions) => descriptions.every((description) => description.clientHeight <= Number.parseFloat(getComputedStyle(description).lineHeight) * 2 + 1)), true);
  assert.equal(await page.locator('.product-card').first().locator('.product-card__signal').innerText(), 'SOLD OUT');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  await page.screenshot({ path: path.join(screenshots, 'desktop-1440.webp'), fullPage: true });

  await page.getByRole('button', { name: 'HEADBANG DEALERS' }).click();
  assert.equal(await page.locator('.product-card').count(), 4);
  await page.getByRole('button', { name: 'TODOS' }).click();
  await page.locator('.product-card .product-card__action').first().click();
  await page.waitForLoadState('networkidle');
  assert.match(await page.locator('[data-product-name]').innerText(), /CAMISETA BASS TRAFFICKERS/i);
  assert.equal(await page.locator('[data-product-thumbnails] button').count(), 11);
  assert.equal(await page.locator('[data-product-main-image]').evaluate((image) => getComputedStyle(image).objectFit), 'contain');
  assert.equal(await page.locator('[data-add-to-cart]').isDisabled(), true);
  assert.equal(await page.locator('[data-quantity]').isDisabled(), true);
  assert.equal(await page.locator('[data-size-select]').isDisabled(), true);
  assert.equal(await page.locator('[data-add-to-cart]').innerText(), 'AGOTADO');
  await page.locator('[data-add-to-cart]').click({ force: true });
  assert.equal(await page.locator('.cart-count').innerText(), '0');
  await page.screenshot({ path: path.join(screenshots, 'product-desktop.webp'), fullPage: true });

  await page.evaluate(() => localStorage.setItem('lican-merch-cart-v1', JSON.stringify({ items: [{ productId: 'camiseta-bass-traffickers-headbang-dealers', variantId: null, quantity: 2 }] })));
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.cart-count').innerText(), '2');
  await page.getByRole('button', { name: 'Abrir carrito' }).click();
  assert.equal(await page.locator('.cart-line').count(), 1);
  assert.match(await page.locator('.cart-summary').innerText(), /Faltan precios confirmados/);
  await page.locator('.cart-line input').fill('3');
  await page.locator('.cart-line input').press('Tab');
  assert.equal(await page.locator('.cart-count').innerText(), '3');
  await page.getByRole('button', { name: 'ELIMINAR' }).click();
  assert.match(await page.locator('.cart-empty').innerText(), /carrito está vacío/);
  await context.close();

  for (const width of [320, 375, 390, 430, 768, 1024, 1920]) {
    const mobile = await openPage({ width, height: width <= 430 ? 860 : 1000 });
    await mobile.page.goto(`${baseUrl}/merch/`, { waitUntil: 'networkidle' });
    assert.equal(await mobile.page.evaluate(() => window.innerWidth), width);
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `overflow at ${width}px`);
    assert.equal(await mobile.page.locator('.product-card').count(), 6);
    const expectedColumns = width >= 1101 ? 4 : width >= 801 ? 3 : width >= 561 ? 2 : 1;
    assert.equal(await firstRowCount(mobile.page), expectedColumns, `grid columns at ${width}px`);
    if (width === 390) {
      await loadProductImages(mobile.page);
      await mobile.page.screenshot({ path: path.join(screenshots, 'mobile-390.webp'), fullPage: true });
    }
    await mobile.context.close();
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
  assert.match(await status.page.locator('[data-status-copy]').innerText(), /ningún cobro/i);
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
  await mockContext.route('**/merch/data/products.json', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const shirt = data.products.find((product) => product.id === 'camiseta-bass-traffickers-headbang-dealers');
    shirt.priceCents = 2500;
    shirt.stock = 5;
    shirt.availability = 'in-stock';
    shirt.purchasable = true;
    shirt.variants = [{ id: 'm', name: 'M', priceCents: 2500, stock: 5 }];
    await route.fulfill({ response, json: data });
  });
  await mockContext.route('**/merch/js/config.js', async (route) => {
    const response = await route.fetch();
    const source = (await response.text()).replace('peninsula: null', 'peninsula: 495');
    await route.fulfill({ response, body: source, contentType: 'application/javascript' });
  });
  const mockPage = await mockContext.newPage();
  mockPage.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  mockPage.on('pageerror', (error) => errors.push(error.message));
  await mockPage.goto(`${baseUrl}/merch/product.html?product=camiseta-bass-traffickers-headbang-dealers`, { waitUntil: 'networkidle' });
  await mockPage.locator('[data-size-select]').selectOption('m');
  await mockPage.locator('[data-quantity]').fill('2');
  await mockPage.locator('[data-add-to-cart]').click();
  assert.equal(await mockPage.locator('.cart-count').innerText(), '2');
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
  assert.match(await mockPage.locator('[data-total]').innerText(), /54,95/);
  await mockPage.locator('[data-pay]').click();
  await mockPage.waitForURL('**/merch/success.html?mode=mock&order=*');
  assert.match(await mockPage.locator('[data-status-copy]').innerText(), /ningún cobro/i);
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
  console.log('Browser smoke test passed: catalog, product, cart, full mock checkout, status, navigation and 8 responsive widths.');
} finally {
  await browser.close();
}
