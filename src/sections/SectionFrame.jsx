export default function SectionFrame({ children, title }) {
  return (
    <section className="section-frame" aria-labelledby={title ? 'section-title' : undefined}>
      {title ? <h2 id="section-title" className="section-frame__title">{title}</h2> : null}
      {children}
    </section>
  );
}
