import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import LanguageContext from './language-context';
import { getLanguageFromPathname, localizePath, stripLanguagePrefix } from './languageRoutes';
import { languageMeta, translations } from './translations';

const STORAGE_KEY = 'lican-language';

const getStoredLanguage = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || 'cast';
  } catch {
    return 'cast';
  }
};

export default function LanguageProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const language = getLanguageFromPathname(location.pathname) || getStoredLanguage();

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Some embedded browsers disable storage; language still works for the session.
    }
    document.documentElement.lang = languageMeta[language].htmlLang;

    const basePath = stripLanguagePrefix(location.pathname);
    document.querySelectorAll('link[data-lican-hreflang]').forEach((link) => link.remove());
    Object.entries({ cast: 'es', cat: 'ca', eng: 'en', nl: 'nl' }).forEach(([code, hreflang]) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hreflang;
      link.href = `https://www.licanevents.com${localizePath(basePath, code)}`;
      link.dataset.licanHreflang = 'true';
      document.head.appendChild(link);
    });
  }, [language, location.pathname]);

  const changeLanguage = useCallback((nextLanguage) => {
    const current = `${location.pathname}${location.search}${location.hash}`;
    navigate(localizePath(current, nextLanguage));
  }, [location.hash, location.pathname, location.search, navigate]);

  const getLocalizedPath = useCallback((to) => localizePath(to, language), [language]);

  const value = useMemo(() => ({
    language,
    setLanguage: changeLanguage,
    changeLanguage,
    localizePath: getLocalizedPath,
    t: translations[language],
  }), [changeLanguage, getLocalizedPath, language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
