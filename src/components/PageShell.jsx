export default function PageShell({ title, children }) {
  return (
    <section className="page-shell" aria-labelledby={title ? 'page-title' : undefined}>
      {title ? <h1 id="page-title" className="page-shell__title">{title}</h1> : null}
      {children}
    </section>
  );
}
