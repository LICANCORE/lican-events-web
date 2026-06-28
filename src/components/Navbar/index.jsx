import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { navigationItems } from '../../data/navigation';
import { nextEvent } from '../../data/events';
import Brand from '../Brand';
import Icon from '../Icon';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <Brand />
      <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>
        <span /><span />
        <span className="sr-only">Abrir menú</span>
      </button>
      <nav id="main-navigation" className={`nav-links ${open ? 'nav-links--open' : ''}`} aria-label="Navegación principal">
        {navigationItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setOpen(false)}>{item.label}</NavLink>
        ))}
      </nav>
      <a className="button button--primary topbar__tickets" href={nextEvent.ticketUrl} target="_blank" rel="noreferrer"><Icon name="ticket" size={16} /> Entradas</a>
    </header>
  );
}
