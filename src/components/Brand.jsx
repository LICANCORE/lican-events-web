import { Link } from 'react-router-dom';

export default function Brand({ className = '' }) {
  return (
    <Link to="/" className={`brand ${className}`.trim()} aria-label="LICAN Events — Inicio">
      <span>LICAN</span><span>EVENTS</span>
    </Link>
  );
}
