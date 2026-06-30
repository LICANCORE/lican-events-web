import { Link } from 'react-router-dom';
import Icon from './Icon';
import useLanguage from '../i18n/useLanguage';

export function Eyebrow({ children }) {
  return <p className="eyebrow"><span />{children}</p>;
}

export function SectionTitle({ eyebrow, title, accent, description, align = 'left', heading = 'h2', headingId }) {
  const Heading = heading;

  return (
    <header className={`section-heading section-heading--${align}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading id={headingId}>
        <span className="section-heading__base">{title}</span>
        {accent ? <> <span className="section-heading__accent">{accent}</span></> : null}
      </Heading>
      {description ? <p className="section-heading__description">{description}</p> : null}
    </header>
  );
}

export function ButtonLink({ to, children, variant = 'primary', icon = 'arrow', className = '' }) {
  const { localizePath } = useLanguage();
  const classes = `button button--${variant} ${className}`.trim();
  const content = <>{children}<Icon name={icon} size={17} /></>;
  return to.startsWith('http') || to.startsWith('mailto:') ? (
    <a className={classes} href={to} target={to.startsWith('http') ? '_blank' : undefined} rel={to.startsWith('http') ? 'noreferrer' : undefined}>{content}</a>
  ) : <Link className={classes} to={localizePath(to)}>{content}</Link>;
}
