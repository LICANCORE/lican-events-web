import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      let frame;
      let attempts = 0;

      const scrollToTarget = () => {
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));

        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }

        attempts += 1;
        if (attempts < 10) frame = window.requestAnimationFrame(scrollToTarget);
      };

      frame = window.requestAnimationFrame(scrollToTarget);

      return () => window.cancelAnimationFrame(frame);
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    return undefined;
  }, [pathname, hash]);

  return null;
}
