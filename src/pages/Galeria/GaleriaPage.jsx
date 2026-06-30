import GalleryCarousel from '../../components/GalleryCarousel';
import ContactCTA from '../../components/ContactCTA';
import { galleryItems } from '../../data/gallery';
import usePageTitle from '../../hooks/usePageTitle';
import useLanguage from '../../i18n/useLanguage';
import '../Home/home.css';
import '../shared-pages.css';
import './galeria.css';

export default function GaleriaPage() {
  const { t } = useLanguage();
  usePageTitle(t.pages.gallery.title, t.pages.gallery.description);

  return (
    <div className="content-page">
      <h1 className="sr-only">{t.pages.gallery.h1}</h1>
      <section className="gallery-page" aria-label={t.pages.gallery.h1}>
        <div className="shell">
          <GalleryCarousel items={galleryItems} />
        </div>
      </section>
      <ContactCTA />
    </div>
  );
}
