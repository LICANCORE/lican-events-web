/* Synchronous, shared consent authority. Must run before any Google tag. */
(() => {
  if (window.licanConsent) return;
  const CONSENT_VERSION = '1';
  const STORAGE_KEY = 'lican_cookie_consent';
  const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  const MEASUREMENT_ID = 'G-C2SPKSH8HJ';
  const DISABLE_KEY = `ga-disable-${MEASUREMENT_ID}`;
  const listeners = new Set();
  let initialized = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  const googleState = (analytics) => ({
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  });
  window[DISABLE_KEY] = true;
  window.gtag('consent', 'default', googleState(false));

  function parse(raw) {
    try {
      const p = JSON.parse(raw);
      const age = Date.now() - Date.parse(p?.timestamp);
      if (p?.version !== CONSENT_VERSION || p.necessary !== true ||
          typeof p.analytics !== 'boolean' || typeof p.marketing !== 'boolean' ||
          !Number.isFinite(age) || age < 0 || age > MAX_AGE) return null;
      return Object.freeze({ version: CONSENT_VERSION, necessary: true,
        analytics: p.analytics, marketing: p.marketing, timestamp: p.timestamp });
    } catch { return null; }
  }

  let storageAvailable = true;
  let preferences = null;
  try { preferences = parse(window.localStorage.getItem(STORAGE_KEY)); }
  catch { storageAvailable = false; }
  let snapshot = Object.freeze({ preferences, analytics: preferences?.analytics === true, storageAvailable });

  function removeAnalyticsCookies() {
    // Only GA cookies; never touch login, game progress or other functional storage.
    const names = document.cookie.split(';').map((c) => c.trim().split('=')[0])
      .filter((name) => name === '_ga' || name.startsWith('_ga_'));
    const labels = window.location.hostname.split('.');
    const domains = ['', ...labels.map((_, i) => `; domain=${labels.slice(i).join('.')}`)];
    const parts = window.location.pathname.split('/').filter(Boolean);
    const paths = ['/', ...parts.map((_, i) => `/${parts.slice(0, i + 1).join('/')}`)];
    for (const name of names) for (const domain of domains) for (const path of paths) {
      document.cookie = `${name}=; Max-Age=0; path=${path}${domain}; SameSite=Lax`;
    }
  }

  function applyGoogleConsent(analytics) {
    window[DISABLE_KEY] = !analytics;
    window.gtag('consent', 'update', googleState(analytics));
    if (!analytics) { removeAnalyticsCookies(); return; }
    if (initialized) return;
    initialized = true;
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }

  function publish(next) {
    preferences = next;
    snapshot = Object.freeze({ preferences, analytics: preferences?.analytics === true, storageAvailable });
    applyGoogleConsent(snapshot.analytics);
    listeners.forEach((fn) => fn());
  }

  function updateConsentPreferences({ analytics = false, marketing = false } = {}) {
    const next = Object.freeze({ version: CONSENT_VERSION, necessary: true,
      analytics: analytics === true, marketing: marketing === true, timestamp: new Date().toISOString() });
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); storageAvailable = true; }
    catch { storageAvailable = false; }
    publish(next);
  }

  function trackEvent(eventName, params = {}) {
    if (!snapshot.analytics || typeof window.gtag !== 'function') return false;
    window.gtag('event', eventName, params);
    return true;
  }

  window.licanConsent = Object.freeze({
    CONSENT_VERSION, STORAGE_KEY,
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    updateConsentPreferences,
    openPreferences() { window.dispatchEvent(new Event('lican:open-cookie-preferences')); },
    trackEvent,
    trackPageView(pagePath) {
      return trackEvent('page_view', { page_path: pagePath,
        page_location: window.location.href, page_title: document.title });
    },
  });
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) publish(parse(event.newValue));
  });
  // Restore consent before initializing GA; default is always the first command.
  if (preferences) applyGoogleConsent(preferences.analytics);
  else removeAnalyticsCookies();
})();
