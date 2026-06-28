import { Link } from 'react-router-dom';
import Icon from './Icon';

export function Eyebrow({ children }) {
  return <p className="eyebrow"><span />{children}</p>;
}

export function SectionTitle({ eyebrow, title, accent, description, align = 'left' }) {
  return (
    <header className={`section-heading section-heading--${align}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2>{title} {accent ? <span>{accent}</span> : null}</h2>
      {description ? <p className="section-heading__description">{description}</p> : null}
    </header>
  );
}

export function ButtonLink({ to, children, variant = 'primary', icon = 'arrow', className = '' }) {
  const classes = `button button--${variant} ${className}`.trim();
  const content = <>{children}<Icon name={icon} size={17} /></>;
  return to.startsWith('http') || to.startsWith('mailto:') || to.includes('#') ? (
    <a className={classes} href={to} target={to.startsWith('http') ? '_blank' : undefined} rel={to.startsWith('http') ? 'noreferrer' : undefined}>{content}</a>
  ) : <Link className={classes} to={to}>{content}</Link>;
}
