import { useEffect, useId, useRef, useState } from 'react';

import { languageMeta, supportedLanguages } from '../../i18n/translations';
import useLanguage from '../../i18n/useLanguage';

function LanguageFlag({ type }) {
  return <span className={`language-flag language-flag--${type}`} aria-hidden="true" />;
}

export default function LanguageSelector({ className = '', onLanguageChange }) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const current = languageMeta[language];

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`language-selector ${className}`.trim()}>
      <button className="language-selector__trigger" type="button" aria-label={t.nav.language} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((currentOpen) => !currentOpen)}>
        <LanguageFlag type={current.flag} />
        <span>{current.short}</span>
        <span className="language-selector__chevron" aria-hidden="true">⌄</span>
      </button>
      <div id={listId} className={`language-selector__menu ${open ? 'language-selector__menu--open' : ''}`} role="listbox" aria-label={t.nav.language}>
        {supportedLanguages.map((code) => {
          const option = languageMeta[code];
          return (
            <button type="button" role="option" aria-selected={language === code} className={language === code ? 'language-selector__option--active' : ''} onClick={() => { setLanguage(code); setOpen(false); onLanguageChange?.(code); }} key={code}>
              <LanguageFlag type={option.flag} />
              <span>{option.short}</span>
              <small>{option.label}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
