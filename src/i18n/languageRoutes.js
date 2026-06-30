export const supportedRouteLanguages = ['cast', 'cat', 'eng', 'nl', 'deutsch'];

export const localizedRoutes = {
  cast: {
    prefix: '',
    slugs: { home: '', events: 'eventos', services: 'servicios', artists: 'artistas', gallery: 'galeria', contact: 'contacto' },
  },
  cat: {
    prefix: 'cat',
    slugs: { home: '', events: 'esdeveniments', services: 'serveis', artists: 'artistes', gallery: 'galeria', contact: 'contacte' },
  },
  eng: {
    prefix: 'eng',
    slugs: { home: '', events: 'events', services: 'services', artists: 'artists', gallery: 'gallery', contact: 'contact' },
  },
  nl: {
    prefix: 'nl',
    slugs: { home: '', events: 'events', services: 'diensten', artists: 'artiesten', gallery: 'galerij', contact: 'contact' },
  },
  deutsch: {
    prefix: 'deutsch',
    slugs: { home: '', events: 'veranstaltungen', services: 'dienstleistungen', artists: 'kuenstler', gallery: 'galerie', contact: 'kontakt' },
  },
};

export const languagePrefixes = Object.fromEntries(
  Object.entries(localizedRoutes).map(([language, config]) => [language, config.prefix ? `/${config.prefix}` : '']),
);

const prefixLanguages = Object.fromEntries(
  Object.entries(localizedRoutes).filter(([, config]) => config.prefix).map(([language, config]) => [config.prefix, language]),
);

const legacySlugs = {
  cat: { eventos: 'events', servicios: 'services', artistas: 'artists', contacto: 'contact' },
  eng: { eventos: 'events', servicios: 'services', artistas: 'artists', galeria: 'gallery', contacto: 'contact' },
  nl: { eventos: 'events', servicios: 'services', artistas: 'artists', galeria: 'gallery', contacto: 'contact' },
  deutsch: { eventos: 'events', servicios: 'services', artistas: 'artists', galeria: 'gallery', contacto: 'contact' },
};

const cleanPathname = (pathname = '/') => {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  const normalized = `/${path.split('/').filter(Boolean).join('/')}`;
  return normalized === '/' ? '/' : normalized.replace(/\/$/, '');
};

export function getLocalizedPath(language, pageKey) {
  const config = localizedRoutes[language] || localizedRoutes.cast;
  const slug = config.slugs[pageKey];
  if (slug === undefined) return config.prefix ? `/${config.prefix}` : '/';
  return `/${[config.prefix, slug].filter(Boolean).join('/')}`;
}

export function detectLangFromPath(pathname) {
  const firstSegment = cleanPathname(pathname).split('/').filter(Boolean)[0];
  return prefixLanguages[firstSegment] || 'cast';
}

export function stripLanguagePrefix(pathname) {
  const segments = cleanPathname(pathname).split('/').filter(Boolean);
  if (prefixLanguages[segments[0]]) segments.shift();
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function detectPageKeyFromPath(pathname) {
  const language = detectLangFromPath(pathname);
  const segments = cleanPathname(pathname).split('/').filter(Boolean);
  if (localizedRoutes[language].prefix) segments.shift();
  if (!segments.length) return 'home';

  const slug = segments[0];
  const canonical = Object.entries(localizedRoutes[language].slugs).find(([, value]) => value === slug);
  if (canonical) return canonical[0];
  return legacySlugs[language]?.[slug] || null;
}

export function switchLanguagePath(currentPath, targetLanguage) {
  const url = new URL(currentPath || '/', 'https://www.licanevents.com');
  const pageKey = detectPageKeyFromPath(url.pathname) || 'home';
  return `${getLocalizedPath(targetLanguage, pageKey)}${url.search}${url.hash}`;
}

export function canonicalizeLocalizedPath(currentPath) {
  const url = new URL(currentPath || '/', 'https://www.licanevents.com');
  const language = detectLangFromPath(url.pathname);
  const pageKey = detectPageKeyFromPath(url.pathname);
  if (!pageKey) return null;
  return `${getLocalizedPath(language, pageKey)}${url.search}${url.hash}`;
}

// Backwards-compatible names used by existing components.
export const getLanguageFromPathname = detectLangFromPath;

export function localizePath(to, language) {
  if (!to || /^(?:https?:|mailto:|tel:|#)/.test(to)) return to;
  const url = new URL(to, 'https://www.licanevents.com');
  const pageKey = detectPageKeyFromPath(url.pathname);

  if (pageKey) return `${getLocalizedPath(language, pageKey)}${url.search}${url.hash}`;

  // Auxiliary pages do not have translated equivalents. Keep their real,
  // unprefixed route working instead of manufacturing a URL the router cannot serve.
  return `${stripLanguagePrefix(url.pathname)}${url.search}${url.hash}`;
}

export function getLegacyRouteEntries(language) {
  return Object.entries(legacySlugs[language] || {}).map(([slug, pageKey]) => ({ slug, pageKey }));
}
