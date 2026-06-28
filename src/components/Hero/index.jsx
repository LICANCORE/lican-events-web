export function HeroSection({ title, subtitle, ctaLabel }) {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {ctaLabel ? <button type="button">{ctaLabel}</button> : null}
      </div>
    </section>
  );
}
