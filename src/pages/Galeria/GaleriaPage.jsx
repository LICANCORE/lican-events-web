import GalleryCarousel from '../../components/GalleryCarousel';
import { galleryItems } from '../../data/gallery';
import usePageTitle from '../../hooks/usePageTitle';
import './galeria.css';

export default function GaleriaPage() {
  usePageTitle('Galería');

  return (
    <section className="gallery-page" aria-labelledby="gallery-page-title">
      <div className="shell">
        <header className="gallery-page__heading">
          <p>Memoria visual · LICAN Events</p>
          <h1 id="gallery-page-title">Galería</h1>
          <div>
            <p>Una selección de nuestras noches, artistas, visuales y público.</p>
            <span>{galleryItems.length} fotografías</span>
          </div>
        </header>
        <GalleryCarousel items={galleryItems} />
      </div>
    </section>
  );
}
