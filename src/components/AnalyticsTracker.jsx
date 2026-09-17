import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function AnalyticsTracker() {
  const { pathname, search } = useLocation();
  const lastPagePath = useRef(null);

  useEffect(() => {
    const pagePath = pathname + search;

    // Let page title effects and route redirects finish before recording the view.
    // Cleanup also cancels React StrictMode's first development-only effect.
    const timer = window.setTimeout(() => {
      if (
        lastPagePath.current === pagePath ||
        window.location.pathname + window.location.search !== pagePath ||
        typeof window.gtag !== 'function'
      ) return;

      window.gtag('event', 'page_view', {
        page_path: pagePath,
        page_location: window.location.href,
        page_title: document.title,
      });
      lastPagePath.current = pagePath;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  return null;
}
