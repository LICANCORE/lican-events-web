import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import useConsent from '../consent/useConsent';

export default function AnalyticsTracker() {
  const { pathname, search } = useLocation();
  const lastPagePath = useRef(null);
  const { analytics } = useConsent();

  useEffect(() => {
    const pagePath = pathname + search;
    if (!analytics) {
      if (lastPagePath.current !== pagePath) lastPagePath.current = null;
      return undefined;
    }

    // Let page title effects and route redirects finish before recording the view.
    // Cleanup also cancels React StrictMode's first development-only effect.
    const timer = window.setTimeout(() => {
      if (
        lastPagePath.current === pagePath ||
        window.location.pathname + window.location.search !== pagePath ||
        !window.licanConsent?.getSnapshot().analytics
      ) return;

      if (window.licanConsent.trackPageView(pagePath)) lastPagePath.current = pagePath;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname, search, analytics]);

  return null;
}
