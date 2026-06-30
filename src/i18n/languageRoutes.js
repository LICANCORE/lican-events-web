export const languagePrefixes = {
  cast: '',
  cat: '/cat',
  eng: '/eng',
  nl: '/nl',
};

const prefixLanguages = {
  cat: 'cat',
  eng: 'eng',
  nl: 'nl',
};

export function getLanguageFromPathname(pathname) {
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  return prefixLanguages[firstSegment] || 'cast';
}

export function stripLanguagePrefix(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (prefixLanguages[segments[0]]) segments.shift();
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function localizePath(to, language) {
  if (!to || to.startsWith('http') || to.startsWith('mailto:') || to.startsWith('#')) return to;

  const url = new URL(to, 'https://www.licanevents.com');
  const basePath = stripLanguagePrefix(url.pathname);
  const prefix = languagePrefixes[language] || '';
  const localizedPathname = basePath === '/' ? (prefix || '/') : `${prefix}${basePath}`;

  return `${localizedPathname}${url.search}${url.hash}`;
}
