import { useEffect, useMemo, useState } from 'react';

import LanguageContext from './language-context';
import { languageMeta, supportedLanguages, translations } from './translations';

const STORAGE_KEY = 'lican-language';

const getInitialLanguage = () => {
  try {
    const storedLanguage = window.localStorage.getItem(STORAGE_KEY);
    return supportedLanguages.includes(storedLanguage) ? storedLanguage : 'cast';
  } catch {
    return 'cast';
  }
};

export default function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Some embedded browsers disable storage; language still works for the session.
    }
    document.documentElement.lang = languageMeta[language].htmlLang;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: translations[language],
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
