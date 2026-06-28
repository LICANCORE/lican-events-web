export function GalleryGrid({ title, items = [] }) {
  return (
    <section className="gallery-grid">
      <h2>{title}</h2>
      <div className="gallery-items">
        {items.map((item) => (
          <div key={item} className="gallery-item">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
