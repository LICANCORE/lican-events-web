import useLanguage from '../../i18n/useLanguage';
import usePageTitle from '../../hooks/usePageTitle';
import { consentCopy } from '../../consent/copy';
import { legalCopy } from '../../consent/legalCopy';

export default function LegalPage({ type }) {
  const { language } = useLanguage();
  const t = consentCopy[language];
  const copy = legalCopy[language];
  usePageTitle(t[type]);
  return <article className="legal-page">
    <h1>{t[type]}</h1>
    <p>{copy.notice}</p>
    {copy[type].map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}
    <p><a href="mailto:info@licanevents.com">info@licanevents.com</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a> · <a href="https://www.aepd.es/" target="_blank" rel="noreferrer">AEPD</a></p>
    <button type="button" className="cookie-preferences-button" onClick={() => window.licanConsent?.openPreferences()}>{t.preferences}</button>
  </article>;
}
