import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLocalizedPath } from '../i18n/languageRoutes';
import { consentCopy } from './copy';
import useConsent from './useConsent';

export default function ConsentManager({ language = 'cast', standalone = false }) {
  const state = useConsent();
  const t = consentCopy[language] || consentCopy.cast;
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const dialog = useRef(null);
  const opener = useRef(null);
  const showBanner = !state.preferences;

  useEffect(() => {
    const show = () => {
      opener.current = document.activeElement;
      const preferences = window.licanConsent?.getSnapshot().preferences;
      setAnalytics(preferences?.analytics === true);
      setMarketing(preferences?.marketing === true);
      setOpen(true);
    };
    window.addEventListener('lican:open-cookie-preferences', show);
    return () => window.removeEventListener('lican:open-cookie-preferences', show);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const el = dialog.current;
    el.showModal();
    el.querySelector('button')?.focus();
    return () => { el.close(); opener.current?.focus?.(); };
  }, [open]);

  const save = (value, marketingValue = marketing) => {
    window.licanConsent?.updateConsentPreferences({ analytics: value, marketing: marketingValue });
    setOpen(false);
  };
  const links = <div className="lican-consent-links">
    <a href={getLocalizedPath(language, 'cookies')}>{t.cookies}</a>
    <a href={getLocalizedPath(language, 'privacy')}>{t.privacy}</a>
  </div>;

  return createPortal(<div className="lican-consent" lang={{ cast: 'es', cat: 'ca', eng: 'en', nl: 'nl', deutsch: 'de', eo: 'eo' }[language]}>
    {showBanner && !open && <section className="lican-consent-banner" aria-labelledby="lican-consent-title" aria-label={t.preferences}>
      <h2 id="lican-consent-title">{t.title}</h2>
      <p>{t.text}</p>
      <div className="lican-consent-actions">
        <button type="button" onClick={() => save(false)}>{t.reject}</button>
        <button type="button" onClick={() => window.licanConsent?.openPreferences()}>{t.configure}</button>
        <button type="button" onClick={() => save(true, true)}>{t.accept}</button>
      </div>
      {links}
    </section>}
    {standalone && !showBanner && <button className="lican-consent-reopen" type="button" onClick={() => window.licanConsent?.openPreferences()}>{t.preferences}</button>}
    {state.preferences && !state.storageAvailable && <p className="lican-consent-storage" role="status">{t.storage}</p>}
    <dialog ref={dialog} className="lican-consent-dialog" aria-modal="true" aria-labelledby="lican-preferences-title" onCancel={() => setOpen(false)}>
      <div className="lican-consent-dialog-heading">
        <h2 id="lican-preferences-title">{t.preferences}</h2>
        <button type="button" aria-label={t.close} onClick={() => setOpen(false)}>×</button>
      </div>
      <p>{t.text}</p>
      <label className="lican-consent-category">
        <span><strong>{t.necessary}</strong><span>{t.necessaryText}</span><small>{t.always}</small></span>
        <input type="checkbox" checked disabled aria-label={t.necessary} />
      </label>
      <label className="lican-consent-category">
        <span><strong>{t.analytics}</strong><span>{t.analyticsText}</span></span>
        <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} aria-label={t.analytics} />
      </label>
      <label className="lican-consent-category">
        <span><strong>{t.marketing}</strong><span>{t.marketingText}</span><small>{t.inactive}</small></span>
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} aria-label={t.marketing} />
      </label>
      <button className="lican-consent-save" type="button" onClick={() => save(analytics)}>{t.save}</button>
      {links}
    </dialog>
  </div>, document.body);
}
