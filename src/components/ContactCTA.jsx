import { ButtonLink } from './HomeUI';
import { contactLinks } from '../data/links';
import useLanguage from '../i18n/useLanguage';

export default function ContactCTA({ artist = false }) {
  const { t } = useLanguage();
  const content = artist ? t.contactCta.artist : t.contactCta.general;

  return (
    <section className="contact-cta shell" aria-labelledby="contact-cta-title">
      <div>
        <p className="eyebrow"><span />{t.contactCta.eyebrow}</p>
        <h2 id="contact-cta-title">{content.title}</h2>
        <p>{content.description}</p>
      </div>
      <div className="contact-cta__actions">
        <ButtonLink to={artist ? '/contacto?tipo=artistas' : '/contacto'}>{t.contactCta.contact}</ButtonLink>
        <ButtonLink to={contactLinks.instagram} variant="outline" icon="instagram">Instagram</ButtonLink>
      </div>
    </section>
  );
}
