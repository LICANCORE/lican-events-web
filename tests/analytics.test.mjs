import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const trackerSource = read('src/components/AnalyticsTracker.jsx')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default function', 'function');

// Exercise the actual tracker effect with controlled routing and effect timing.
function harness() {
  const calls = [];
  const timers = new Map();
  const ref = { current: null };
  let nextTimer = 0;
  let previousDeps;
  let cleanup;
  let effect;
  let location;
  const window = {
    gtag: (...args) => calls.push(args),
    setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  };
  const document = { title: '' };
  const context = vm.createContext({ window, document,
    useLocation: () => location,
    useRef: () => ref,
    useEffect: (fn, deps) => {
      if (!previousDeps || deps.some((dep, i) => dep !== previousDeps[i])) {
        cleanup?.();
        previousDeps = deps;
        effect = fn;
        cleanup = fn();
      }
    },
  });
  vm.runInContext(trackerSource, context);
  return {
    calls, window, document,
    navigate(path) {
      window.location = new URL(path, 'https://licanevents.com');
      location = window.location;
      vm.runInContext('AnalyticsTracker()', context);
    },
    strictReplay() { cleanup(); cleanup = effect(); },
    flush() {
      for (const [id, fn] of timers) { timers.delete(id); fn(); }
    },
  };
}

test('initial view once in StrictMode; current title, search and full URL', () => {
  const h = harness();
  h.navigate('/eventos?brand=feral');
  h.strictReplay();
  h.document.title = 'Eventos | LICAN Events';
  h.flush();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0])), ['event', 'page_view', {
    page_path: '/eventos?brand=feral',
    page_location: 'https://licanevents.com/eventos?brand=feral',
    page_title: 'Eventos | LICAN Events',
  }]);
  h.navigate('/eventos?brand=feral#newsletter'); h.flush();
  h.strictReplay(); h.flush();
  assert.equal(h.calls.length, 1);
});

test('all requested routes, query changes and back navigation emit views', () => {
  const h = harness();
  const routes = ['/', '/eventos', '/servicios', '/artistas', '/galeria',
    '/contacto', '/cat/esdeveniments', '/eng/events', '/nl/diensten',
    '/deutsch/veranstaltungen', '/eo/eventoj', '/eo/eventoj?brand=feral', '/'];
  for (const route of routes) { h.navigate(route); h.flush(); }
  assert.deepEqual(h.calls.map((call) => call[2].page_path), routes);
});

test('redirects cancel transient views and missing gtag does not throw', () => {
  const h = harness();
  h.navigate('/old-route'); h.navigate('/eventos'); h.flush();
  assert.deepEqual(h.calls.map((call) => call[2].page_path), ['/eventos']);
  h.window.gtag = undefined;
  h.navigate('/contacto');
  assert.doesNotThrow(() => h.flush());
});

test('base tag queues commands once and helper forwards custom events', () => {
  const html = read('index.html');
  assert.equal((html.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 1);
  const context = vm.createContext({});
  context.window = context;
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  vm.runInContext(read('public/analytics-events.js'), context);
  assert.equal(context.dataLayer.length, 2);
  assert.equal(context.dataLayer[1][1], 'G-C2SPKSH8HJ');
  assert.equal(context.dataLayer[1][2].send_page_view, false);
  context.trackLicanEvent('click_buy_tickets', { event_id: 'test' });
  assert.equal(context.dataLayer[2][1], 'click_buy_tickets');
  assert.equal(context.dataLayer[2][2].event_id, 'test');
  context.trackLicanEvent('click_contact');
  assert.equal(Object.keys(context.dataLayer[3][2]).length, 0);
  context.gtag = undefined;
  assert.doesNotThrow(() => context.trackLicanEvent('click_contact'));
});

test('standalone pages have one automatic tag; 404 redirect has none', () => {
  for (const file of ['public/descubre-tu-bass/index.html', 'public/headbangdealers_the_game/index.html']) {
    const html = read(file);
    assert.equal((html.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 1);
    assert.match(html, /gtag\('config', 'G-C2SPKSH8HJ'\);/);
    assert.match(html, /src="\/analytics-events.js"/);
  }
  assert.doesNotMatch(read('public/404.html'), /gtag|analytics-events/);
});
