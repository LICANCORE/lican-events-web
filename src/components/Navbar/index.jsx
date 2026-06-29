import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { navigationItems } from '../../data/navigation';
import { nextEvent } from '../../data/events';
import useLanguage from '../../i18n/useLanguage';
import scrollToSection from '../../utils/scrollToSection';
import Brand from '../Brand';
import Icon from '../Icon';
import LanguageSelector from '../LanguageSelector';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();

  const handleNavigation = (to) => {
    setOpen(false);

    const [pathname, hash] = to.split('#');
    const normalizedPathname = pathname || '/';

    if (hash && location.pathname === normalizedPathname && location.hash === `#${hash}`) {
      window.requestAnimationFrame(() => {
        scrollToSection(`#${hash}`);
      });
    }
  };

  return (
    <header className="topbar">
      <Brand />
      <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>
        <span /><span />
        <span className="sr-only">{t.nav.openMenu}</span>
      </button>
      <nav id="main-navigation" className={`nav-links ${open ? 'nav-links--open' : ''}`} aria-label="Navegación principal">
        {navigationItems.map((item) => (
          <Link key={item.to} to={item.to} onClick={() => handleNavigation(item.to)}>{t.nav[item.key]}</Link>
        ))}
        <LanguageSelector className="language-selector--mobile" />
      </nav>
      <div className="topbar__actions">
        <LanguageSelector className="language-selector--desktop" />
        <a className="button button--primary topbar__tickets" href={nextEvent.ticketUrl} target="_blank" rel="noreferrer"><Icon name="ticket" size={16} /> {t.nav.tickets}</a>
      </div>
    </header>
  );
}
