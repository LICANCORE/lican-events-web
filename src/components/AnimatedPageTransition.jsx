import { useLocation } from 'react-router-dom';

export default function AnimatedPageTransition({ children }) {
  const location = useLocation();

  return (
    <div className="page-transition page-transition--entering" key={`${location.pathname}${location.hash}`}>
      {children}
    </div>
  );
}
