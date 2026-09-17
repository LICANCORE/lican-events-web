// Run against local Vite. Playwright is supplied externally, not a production dependency.
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const base = process.env.CONSENT_TEST_URL || 'http://127.0.0.1:5173';
const output = path.join(os.tmpdir(), 'lican-consent-qa-results');
fs.mkdirSync(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), base, responsive: [], locales: [], errors: [], network: [], cookies: [] };
const routes = { cast: ['/politica-de-cookies', '/politica-de-privacidad'], cat: ['/cat/politica-de-galetes', '/cat/politica-de-privacitat'], eng: ['/eng/cookie-policy', '/eng/privacy-policy'], nl: ['/nl/cookiebeleid', '/nl/privacybeleid'], deutsch: ['/deutsch/cookie-richtlinie', '/deutsch/datenschutz'], eo: ['/eo/politiko-pri-kuketoj', '/eo/privateca-politiko'] };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    async function fresh() {
      const context = await browser.newContext();
      const page = await context.newPage();
      const requests = [];
      page.on('pageerror', (error) => report.errors.push(error.message));
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (/google-analytics\.com$/.test(url.hostname) && url.pathname.includes('collect')) {
          requests.push({ tid: url.searchParams.get('tid'), event: url.searchParams.get('en'), page: url.searchParams.get('dl') });
        }
      });
      await page.goto(base);
      await page.locator('.lican-consent-banner').waitFor();
      return { context, page, requests };
    }
    const h = await fresh();
    const { page: p } = h;
    await p.waitForTimeout(400);
    assert.equal(h.requests.length, 0);
    assert.equal(await p.locator('script[src*="googletagmanager"]').count(), 0);
    assert.equal((await h.context.cookies()).filter(c => c.name.startsWith('_ga')).length, 0);
    await p.getByRole('button', { name: 'RECHAZAR', exact: true }).click();
    await p.locator('a[href="/eventos"]').first().click();
    await p.waitForTimeout(300);
    assert.equal(h.requests.length, 0);
    await p.reload();
    assert.equal(await p.locator('.lican-consent-banner').count(), 0);
    await p.locator('.cookie-preferences-button').click();
    const dialog = p.locator('.lican-consent-dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.getByRole('checkbox', { name: 'Analíticas', exact: true }).isChecked(), false);
    assert.equal(await dialog.getByRole('checkbox', { name: 'Necesarias', exact: true }).isDisabled(), true);
    assert.equal(await dialog.getByRole('checkbox', { name: 'Marketing', exact: true }).isDisabled(), false);
    await dialog.getByRole('checkbox', { name: 'Analíticas', exact: true }).check();
    await dialog.getByRole('button', { name: 'GUARDAR PREFERENCIAS' }).click();
    await p.waitForFunction(() => document.cookie.includes('_ga='), { timeout: 15000 });
    await p.waitForTimeout(1800);
    report.cookies = (await h.context.cookies()).filter(c => c.name.startsWith('_ga')).map(({ name, expires }) => ({ name, lifetimeDays: Math.round((expires - Date.now() / 1000) / 86400) }));
    assert(h.requests.some(r => r.tid === 'G-C2SPKSH8HJ' && r.event === 'page_view'));
    const navigation = ['/servicios', '/artistas', '/galeria', '/contacto'];
    for (const route of navigation) {
      await p.locator(`a[href="${route}"]`).first().click();
      await p.waitForTimeout(450);
    }
    // GA may batch SPA hits for several seconds after the manual command.
    await p.waitForTimeout(8000);
    report.network = h.requests.slice();
    for (const route of ['/eventos', ...navigation]) {
      assert.equal(h.requests.filter(r => r.event === 'page_view' && r.page === base + route).length, 1, `Duplicate/missing view: ${route}`);
    }
    await p.reload();
    await p.waitForTimeout(800);
    assert.equal(await p.locator('.lican-consent-banner').count(), 0);
    assert.equal(await p.evaluate(() => window.licanConsent.getSnapshot().analytics), true);
    await p.locator('.cookie-preferences-button').click();
    await dialog.getByRole('checkbox', { name: 'Analíticas', exact: true }).uncheck();
    await dialog.getByRole('button', { name: 'GUARDAR PREFERENCIAS' }).click();
    assert.equal(await p.evaluate(() => window.licanConsent.getSnapshot().analytics), false);
    assert.equal((await h.context.cookies()).filter(c => c.name.startsWith('_ga')).length, 0);
    const manualBefore = await p.evaluate(() => dataLayer.filter(x => x[0] === 'event' && x[1] === 'page_view').length);
    await p.locator('a[href="/eventos"]').first().click();
    await p.waitForTimeout(500);
    assert.equal(await p.evaluate(() => dataLayer.filter(x => x[0] === 'event' && x[1] === 'page_view').length), manualBefore);
    report.functional = 'First visit, reject, configure, persistence, SPA counts, revoke: PASS';

    // First-visit ACCEPT path independently of configure.
    const accepted = await fresh();
    await accepted.page.getByRole('button', { name: 'ACEPTAR', exact: true }).click();
    assert.equal(await accepted.page.evaluate(() => JSON.parse(localStorage.getItem('lican_cookie_consent')).analytics), true);
    assert.equal(await accepted.page.evaluate(() => JSON.parse(localStorage.getItem('lican_cookie_consent')).marketing), true);
    await accepted.context.close();

    // Localized legal routes and banner, with denial on every page.
    for (const [language, paths] of Object.entries(routes)) {
      await p.evaluate(() => localStorage.removeItem('lican_cookie_consent'));
      for (const route of paths) {
        await p.goto(base + route);
        await p.locator('.legal-page h1').waitFor();
        assert.equal(await p.locator('.legal-page section').count(), 9);
        assert.equal(await p.locator('.lican-consent-banner').count(), 1);
        assert.equal(await p.locator('script[src*="googletagmanager"]').count(), 0);
      }
      report.locales.push(language);
    }

    // Every requested width, plus all six banner translations at the narrowest width.
    for (const width of [1920, 1440, 1366, 1280, 1024, 768, 430, 390, 375, 360]) {
      await p.setViewportSize({ width, height: width < 500 ? 740 : 900 });
      await p.goto(base);
      await p.locator('.lican-consent-banner').waitFor();
      const bounds = await p.locator('.lican-consent-banner').boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Page overflow at ${width}`);
      for (const button of await p.locator('.lican-consent-actions button').all()) assert((await button.boundingBox()).height >= 44);
      await p.screenshot({ path: path.join(output, `banner-${width}.png`) });
      await p.getByRole('button', { name: 'CONFIGURAR', exact: true }).click();
      const box = await dialog.boundingBox();
      assert(box.y >= 0 && box.x >= 0 && box.x + box.width <= width + 1);
      assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await p.screenshot({ path: path.join(output, `panel-${width}.png`) });
      await dialog.getByRole('button', { name: 'Cerrar', exact: true }).focus();
      await p.keyboard.press('Shift+Tab');
      assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'Focus escaped dialog');
      await p.keyboard.press('Escape');
      assert.equal(await dialog.isVisible(), false);
      assert.equal(await p.locator('.lican-consent-banner').count(), 1);
      report.responsive.push(width);
    }
    for (const [language, paths] of Object.entries(routes)) {
      await p.goto(base + paths[0]);
      await p.locator('.lican-consent-banner').waitFor();
      assert.equal(await p.locator('.lican-consent-banner').evaluate(el => el.scrollWidth <= el.clientWidth), true, language);
    }

    // Form integration uses stub responses: no real email/subscription is sent.
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.route('https://lican-contact.licancorp.workers.dev/**', r => r.fulfill({ json: { success: true } }));
    await p.route('https://lican-newsletter.licancorp.workers.dev/**', r => r.fulfill({ json: { success: true } }));
    await p.goto(base + '/contacto');
    await p.getByRole('button', { name: 'RECHAZAR', exact: true }).click();
    await p.locator('input[name="name"]').fill('Consent QA');
    await p.locator('input[name="email"]').fill('qa@example.com');
    await p.locator('select[name="type"]').selectOption({ index: 1 });
    await p.locator('textarea[name="message"]').fill('Local UI test only.');
    await p.locator('input[name="rgpd"]').check();
    await p.locator('.contact-form button[type="submit"]').click();
    await p.locator('.contact-form--success').waitFor();
    await p.goto(base);
    await p.locator('.newsletter input[type="email"]').fill('qa@example.com');
    await p.locator('.newsletter input[type="checkbox"]').check();
    await p.locator('.newsletter button[type="submit"]').click();
    await p.locator('.newsletter--success').waitFor();
    report.forms = 'Contact + newsletter success UI with intercepted requests: PASS';

    // Standalone entrypoints use the same stored rejection and remain operational.
    await p.goto(base + '/descubre-tu-bass/');
    await p.locator('.lican-consent-reopen').waitFor();
    await p.locator('#start').click();
    for (let i = 0; i < 5; i++) {
      await p.locator('#answers input').first().check();
      await p.locator('#next').click();
    }
    await p.locator('#result-name').waitFor({ state: 'visible' });
    assert.equal(await p.locator('#result-name').innerText(), 'Liquid');
    await p.goto(base + '/headbangdealers_the_game/');
    await p.locator('.lican-consent-reopen').waitFor();
    assert.equal(await p.evaluate(() => window.licanConsent.getSnapshot().analytics), false);
    report.standalone = 'BASS five-question flow; game loads with consent control: PASS';
    assert.equal(report.errors.length, 0, report.errors.join('\n'));
    report.status = 'PASS';
  } catch (error) {
    report.status = 'FAIL'; report.failure = error.stack; throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
