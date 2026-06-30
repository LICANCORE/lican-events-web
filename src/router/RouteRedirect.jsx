import { Navigate, useLocation } from 'react-router-dom';

export default function RouteRedirect({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}
