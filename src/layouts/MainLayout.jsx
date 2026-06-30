import { Outlet } from 'react-router-dom';

import AnimatedPageTransition from '../components/AnimatedPageTransition';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import ScrollToTop from '../components/ScrollToTop';
import LanguageProvider from '../i18n/LanguageProvider';

export default function MainLayout() {
  return (
    <LanguageProvider>
      <div className="app-shell">
        <ScrollToTop />
        <Navbar />
        <main className="page-content">
          <AnimatedPageTransition>
            <Outlet />
          </AnimatedPageTransition>
        </main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}
