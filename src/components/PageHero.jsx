import useLanguage from '../i18n/useLanguage';

export default function PageHero({ page }) {
  const { t } = useLanguage();
  const content = t.pages[page];
  const titleLines = content.h1Lines || [{ base: content.h1 }];

  return (
    <header className="page-hero shell">
      <p className="eyebrow"><span />LICAN EVENTS</p>
      <h1>
        {titleLines.map((line, index) => (
          <span className="page-hero__title-line" key={`${line.base || ''}-${line.accent || ''}-${index}`}>
            {line.base ? <span>{line.base}</span> : null}
            {line.base && line.accent ? ' ' : null}
            {line.accent ? <span className="page-hero__title-accent">{line.accent}</span> : null}
            {line.after ? <> <span>{line.after}</span></> : null}
          </span>
        ))}
      </h1>
      <p>{content.intro}</p>
    </header>
  );
}
