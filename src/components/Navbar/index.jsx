import { useState } from 'react';
import { Link } from 'react-router-dom';

import { navigationItems } from '../../data/navigation';
import { nextEvent } from '../../data/events';
import Brand from '../Brand';
import Icon from '../Icon';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const handleNavigation = (to) => {
    setOpen(false);

    const hash = to.split('#')[1];
    if (hash) {
      window.requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  return (
    <header className="topbar">
      <Brand />
      <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>
        <span /><span />
        <span className="sr-only">Abrir menú</span>
      </button>
      <nav id="main-navigation" className={`nav-links ${open ? 'nav-links--open' : ''}`} aria-label="Navegación principal">
        {navigationItems.map((item) => (
          <Link key={item.to} to={item.to} onClick={() => handleNavigation(item.to)}>{item.label}</Link>
        ))}
      </nav>
      <a className="button button--primary topbar__tickets" href={nextEvent.ticketUrl} target="_blank" rel="noreferrer"><Icon name="ticket" size={16} /> Entradas</a>
    </header>
  );
}
