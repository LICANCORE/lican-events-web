import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import ConsentManager from './ConsentManager';
import useConsent from './useConsent';

export default function StandaloneConsent() {
  const { analytics } = useConsent();
  const tracked = useRef(false);
  const isHeadbangGame = window.location.pathname.startsWith('/headbangdealers_the_game');
  useEffect(() => {
    if (analytics && !tracked.current) {
      tracked.current = window.licanConsent.trackPageView(window.location.pathname + window.location.search);
    }
  }, [analytics]);
  return <ConsentManager standalone={!isHeadbangGame} />;
}

const root = document.createElement('div');
root.id = 'lican-consent-root';
document.body.appendChild(root);
createRoot(root).render(<StandaloneConsent />);
