import { Link } from 'react-router-dom';
import useLanguage from '../i18n/useLanguage';

export default function Brand({ className = '' }) {
  const { localizePath, t } = useLanguage();

  return (
    <Link to={localizePath('/')} className={`brand ${className}`.trim()} aria-label={`LICAN Events — ${t.nav.home}`}>
      <span>LICAN</span><span>EVENTS</span>
    </Link>
  );
}
