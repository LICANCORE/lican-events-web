import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import scrollToSection from '../utils/scrollToSection';

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      let frame;
      let attempts = 0;

      const scrollToTarget = () => {
        if (scrollToSection(hash)) return;

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
