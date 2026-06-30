import { useState } from 'react';
import { Link } from 'react-router-dom';

import { navigationItems } from '../../data/navigation';
import useLanguage from '../../i18n/useLanguage';
import Brand from '../Brand';
import Icon from '../Icon';
import LanguageSelector from '../LanguageSelector';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { localizePath, t } = useLanguage();

  const handleNavigation = () => {
    setOpen(false);
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
          <Link key={item.to} to={localizePath(item.to)} onClick={handleNavigation}>{t.nav[item.key]}</Link>
        ))}
        <LanguageSelector className="language-selector--mobile" onLanguageChange={() => setOpen(false)} />
      </nav>
      <div className="topbar__actions">
        <LanguageSelector className="language-selector--desktop" />
        <Link className="button button--primary topbar__tickets" to={localizePath('/eventos')}><Icon name="ticket" size={16} /> {t.nav.tickets}</Link>
      </div>
    </header>
  );
}
