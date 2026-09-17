import { Link } from 'react-router-dom';

import Brand from '../Brand';
import { contactLinks, navigationItems } from '../../data/links';
import useLanguage from '../../i18n/useLanguage';
import { consentCopy } from '../../consent/copy';
import { getLocalizedPath } from '../../i18n/languageRoutes';

export default function Footer() {
  const { localizePath, t, language } = useLanguage();
  const privacy = consentCopy[language];

  return (
    <footer className="site-footer">
      <div className="footer__brand">
        <Brand />
        <p>{t.footer.description}</p>
        <p>{contactLinks.location}</p>
      </div>
      <div>
        <p className="footer__label">{t.footer.navigation}</p>
        <nav className="footer__links" aria-label="Navegación del pie">
          {navigationItems.map((item) => <Link to={localizePath(item.to)} key={item.to}>{t.nav[item.key]}</Link>)}
        </nav>
      </div>
      <div>
        <p className="footer__label">{t.footer.contact}</p>
        <div className="footer__links">
          <a href={`mailto:${contactLinks.email}`}>{contactLinks.email}</a>
          <a href={contactLinks.instagram} target="_blank" rel="noreferrer">{contactLinks.instagramLabel}</a>
          <span>{contactLinks.location}</span>
          <Link to={getLocalizedPath(language, 'cookies')}>{privacy.cookies}</Link>
          <Link to={getLocalizedPath(language, 'privacy')}>{privacy.privacy}</Link>
          <button className="cookie-preferences-button" type="button" onClick={() => window.licanConsent?.openPreferences()}>{privacy.preferences}</button>
        </div>
      </div>
      <p className="footer__legal">© 2026 LICAN Events</p>
    </footer>
  );
}
