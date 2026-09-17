import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { localizedRoutes, getLocalizedPath, switchLanguagePath } from '../src/i18n/languageRoutes.js';

const source = readFileSync(new URL('../public/consent.js', import.meta.url), 'utf8');
const valid = (analytics = true, marketing = false) => JSON.stringify({ version: '1', necessary: true, analytics, marketing, timestamp: new Date().toISOString() });
function setup(saved = null, blocked = false) {
  const scripts = [], events = {}, store = new Map(saved ? [['lican_cookie_consent', saved]] : []);
  const context = vm.createContext({ URL, Event, Date, console,
    location: new URL('https://www.licanevents.com/eventos'),
    document: { cookie: '', title: 'Eventos', createElement: () => ({}), head: { appendChild: (s) => scripts.push(s) } },
    localStorage: { getItem: (key) => { if (blocked) throw Error(); return store.get(key) || null; },
      setItem: (key, value) => { if (blocked) throw Error(); store.set(key, value); } },
    addEventListener: (name, fn) => { events[name] = fn; }, dispatchEvent() {},
  });
  context.window = context;
  vm.runInContext(source, context);
  return { context, api: context.licanConsent, scripts, events, store };
}

test('deny all before any config or remote load; accept/reject and helper gated', () => {
  const { context: w, api, scripts, store } = setup();
  assert.equal(w.dataLayer[0][0], 'consent');
  assert.equal(w.dataLayer[0][1], 'default');
  assert.deepEqual(Object.values(w.dataLayer[0][2]), ['denied', 'denied', 'denied', 'denied']);
  assert.equal(scripts.length, 0);
  assert.equal(api.trackPageView('/'), false);
  api.updateConsentPreferences({ analytics: true, marketing: true });
  assert.equal(scripts.length, 1);
  assert.equal(w.dataLayer[1][1], 'update');
  assert.equal(w.dataLayer[1][2].analytics_storage, 'granted');
  assert.equal(w.dataLayer[1][2].ad_user_data, 'denied');
  assert.equal(w.dataLayer.find((a) => a[0] === 'config')[2].send_page_view, false);
  assert.equal(JSON.parse(store.get('lican_cookie_consent')).marketing, true);
  vm.runInContext(readFileSync(new URL('../public/analytics-events.js', import.meta.url), 'utf8'), w);
  w.trackLicanEvent('click_contact');
  const before = w.dataLayer.filter((a) => a[0] === 'event').length;
  api.updateConsentPreferences({ analytics: false });
  w.trackLicanEvent('click_contact');
  assert.equal(w.dataLayer.filter((a) => a[0] === 'event').length, before);
  assert.equal(w['ga-disable-G-C2SPKSH8HJ'], true);
  api.updateConsentPreferences({ analytics: true });
  assert.equal(scripts.length, 1);
});

test('restores valid choice; malformed, expired and wrong-version preferences fail closed', () => {
  assert.equal(setup(valid()).scripts.length, 1);
  assert.equal(setup(valid(false)).api.getSnapshot().preferences.analytics, false);
  for (const raw of ['oops', '{}', valid().replace('"1"', '"0"'), valid().replace(/"timestamp":"[^"]+"/, '"timestamp":"2020-01-01"')]) {
    const h = setup(raw);
    assert.equal(h.scripts.length, 0);
    assert.equal(h.api.getSnapshot().preferences, null);
  }
});

test('blocked storage does not crash and cross-tab revocation updates immediately', () => {
  const h = setup(null, true);
  assert.doesNotThrow(() => h.api.updateConsentPreferences({ analytics: true }));
  assert.equal(h.api.getSnapshot().storageAvailable, false);
  h.events.storage({ key: 'lican_cookie_consent', newValue: valid(false) });
  assert.equal(h.api.getSnapshot().analytics, false);
  h.events.storage({ key: null, newValue: null });
  assert.equal(h.api.getSnapshot().preferences, null);
});

test('both legal pages localize and preserve language switching', () => {
  for (const language of Object.keys(localizedRoutes)) for (const key of ['cookies', 'privacy']) {
    const path = getLocalizedPath(language, key);
    assert.notEqual(path, getLocalizedPath(language, 'home'));
    assert.equal(switchLanguagePath(getLocalizedPath('cast', key), language), path);
  }
});
