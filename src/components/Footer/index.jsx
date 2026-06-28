import Brand from '../Brand';
import { contactLinks, navigationItems } from '../../data/links';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer__brand">
        <Brand />
        <p>Promotora y productora cultural de música electrónica underground.</p>
        <p>{contactLinks.location}</p>
      </div>
      <div>
        <p className="footer__label">Navegación</p>
        <nav className="footer__links" aria-label="Navegación del pie">
          {navigationItems.map((item) => <a href={item.to} key={item.to}>{item.label}</a>)}
        </nav>
      </div>
      <div>
        <p className="footer__label">Contacto</p>
        <div className="footer__links">
          <a href={`mailto:${contactLinks.email}`}>{contactLinks.email}</a>
          <a href={contactLinks.instagram} target="_blank" rel="noreferrer">{contactLinks.instagramLabel}</a>
          <span>{contactLinks.location}</span>
        </div>
      </div>
      <p className="footer__legal">© 2026 LICAN Events</p>
    </footer>
  );
}
