import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import Icon from '../Icon';
import PublicImage from '../PublicImage';
import './gallery-carousel.css';

const categoryFilters = ['FERAL', 'Headbang Dealers', 'Night Of Series'];

export default function GalleryCarousel({ items }) {
  const trackRef = useRef(null);
  const frameRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const visibleItems = items.filter((item) => (
    activeCategory === 'all' || item.category === activeCategory
  ));
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, visibleItems.length - 1));
  const selectedItem = selectedIndex === null ? null : visibleItems[selectedIndex];

  useEffect(() => {
    if (!selectedItem) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setSelectedIndex(null);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [selectedItem]);

  const goTo = (index) => {
    const track = trackRef.current;
    if (!track || !visibleItems.length) return;

    const nextIndex = (index + visibleItems.length) % visibleItems.length;
    const slide = track.children[nextIndex];
    track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    setActiveIndex(nextIndex);
  };

  const handleScroll = () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;

      const viewportCenter = track.scrollLeft + track.clientWidth / 2;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      Array.from(track.children).forEach((slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(viewportCenter - slideCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveIndex(closestIndex);
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(safeActiveIndex - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(safeActiveIndex + 1);
    }
  };

  const handleFilter = (category) => {
    setActiveCategory((current) => current === category ? 'all' : category);
    setActiveIndex(0);
    setSelectedIndex(null);
    trackRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const moveLightbox = (direction) => {
    setSelectedIndex((current) => {
      if (current === null) return null;
      return (current + direction + visibleItems.length) % visibleItems.length;
    });
  };

  if (!items.length) {
    return <p className="gallery-carousel__empty" role="status">No se han encontrado imágenes de galería.</p>;
  }

  return (
    <div className="gallery-carousel" role="region" aria-label="Galería de eventos LICAN" aria-roledescription="carrusel">
      <div className="gallery-carousel__toolbar">
        <div className="gallery-carousel__status">
          <p><strong>{String(safeActiveIndex + 1).padStart(2, '0')}</strong> / {String(visibleItems.length).padStart(2, '0')}</p>
          <div className="gallery-carousel__filters" aria-label="Filtrar galería por fiesta">
            {categoryFilters.map((category) => (
              <button
                type="button"
                className={activeCategory === category ? 'gallery-carousel__filter--active' : ''}
                aria-pressed={activeCategory === category}
                onClick={() => handleFilter(category)}
                key={category}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="gallery-carousel__controls">
          <button type="button" onClick={() => goTo(safeActiveIndex - 1)} aria-label="Imagen anterior"><Icon name="arrow" size={20} /></button>
          <button type="button" onClick={() => goTo(safeActiveIndex + 1)} aria-label="Imagen siguiente"><Icon name="arrow" size={20} /></button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="gallery-carousel__track"
        tabIndex="0"
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
      >
        {visibleItems.map((item, index) => (
          <figure
            className={`gallery-carousel__slide ${index === safeActiveIndex ? 'gallery-carousel__slide--active' : ''}`}
            key={item.image}
            role="group"
            aria-label={`${index + 1} de ${visibleItems.length}`}
            aria-roledescription="diapositiva"
          >
            <button className="gallery-carousel__image-button" type="button" onClick={() => setSelectedIndex(index)} aria-label={`Abrir imagen completa de ${item.category}`}>
              <PublicImage src={item.image} alt={item.alt} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} />
            </button>
            <figcaption>
              <span>{item.category}</span>
              {item.featured ? <small>Selección LICAN</small> : null}
            </figcaption>
          </figure>
        ))}
      </div>
      {selectedItem ? createPortal(
        <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Imagen completa de ${selectedItem.category}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedIndex(null); }}>
          <button ref={closeButtonRef} className="gallery-lightbox__close" type="button" onClick={() => setSelectedIndex(null)} aria-label="Cerrar imagen completa">×</button>
          <button className="gallery-lightbox__nav gallery-lightbox__nav--previous" type="button" onClick={() => moveLightbox(-1)} aria-label="Imagen anterior"><Icon name="arrow" size={23} /></button>
          <figure>
            <PublicImage src={selectedItem.image} alt={selectedItem.alt} />
            <figcaption>{selectedItem.category} · {selectedIndex + 1} / {visibleItems.length}</figcaption>
          </figure>
          <button className="gallery-lightbox__nav gallery-lightbox__nav--next" type="button" onClick={() => moveLightbox(1)} aria-label="Imagen siguiente"><Icon name="arrow" size={23} /></button>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
