import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import Icon from '../../components/Icon';
import ContactCTA from '../../components/ContactCTA';
import { ButtonLink, Eyebrow, SectionTitle } from '../../components/HomeUI';
import PublicImage from '../../components/PublicImage';
import { siteConfig } from '../../config/site';
import { artistServices } from '../../data/artists';
import { partyBrands } from '../../data/brands';
import { nextEvent } from '../../data/events';
import { contactLinks, inquiryTypes } from '../../data/links';
import { partnerLogos } from '../../data/partnerLogos';
import { realizedEventFilters, realizedEvents } from '../../data/realizedEvents';
import { services } from '../../data/services';
import usePageTitle from '../../hooks/usePageTitle';
import { languageMeta } from '../../i18n/translations';
import useLanguage from '../../i18n/useLanguage';
import './home.css';

export function Hero() {
  const { language, t } = useLanguage();

  return (
    <section id="inicio" className="home-hero" aria-labelledby="hero-title">
      <PublicImage className="home-hero__image" src="/images/headbang-dealers/headbang dealers-dubstep-publico-barcelona-hero.webp" alt="Público de LICAN Events en una noche de música electrónica" />
      <div className="home-hero__noise" />
      <div className="home-hero__content shell">
        <Eyebrow>Tarragona · Barcelona · Underground</Eyebrow>
        <h1 id="hero-title" className="sr-only">LICAN EVENTS</h1>
        <div className="home-hero__title">
          {language === 'nl' ? (
            <>
              <span className="hero-title__line">{t.hero.desktopLine1}</span>
              <span className="hero-title__line hero-title__gradient">{t.hero.desktopLine2}</span>
            </>
          ) : null}
          {language === 'eng' ? (
            <>
              <span className="hero-title__line hero-title__desktop-only">{t.hero.desktopLine1}</span>
              <span className="hero-title__line hero-title__gradient hero-title__desktop-only">{t.hero.desktopLine2}</span>
            </>
          ) : null}
          <span className={`hero-title__line hero-title__lead ${language === 'eng' ? 'hero-title__mobile-only' : ''} ${language === 'nl' ? 'hero-title__hidden' : ''}`}>
            <span>{t.hero.line1}</span>{' '}<span>{t.hero.line2}</span>
          </span>
          <span className={`hero-title__line hero-title__gradient ${language === 'eng' ? 'hero-title__mobile-only' : ''} ${language === 'nl' ? 'hero-title__hidden' : ''}`}>{t.hero.gradient}</span>
        </div>
        <p>{t.hero.description}</p>
        <div className="button-row">
          <ButtonLink to={nextEvent.ticketUrl} icon="ticket">{t.hero.nextEvent}</ButtonLink>
          <ButtonLink to="/servicios" variant="outline">{t.hero.hireServices}</ButtonLink>
          <a className="text-link" href="#newsletter">{t.hero.joinNewsletter} <Icon name="arrow" size={16} /></a>
        </div>
      </div>
      <a className="home-hero__scroll" href="#eventos" aria-label={t.hero.scroll}><span /> Scroll</a>
    </section>
  );
}

export function NextEvent() {
  const [eventBrand, eventTitle] = nextEvent.name.split(': ');
  const { t } = useLanguage();

  return (
    <section className="next-event home-section">
      <div className="next-event__visual">
        <PublicImage src={nextEvent.image} alt="Hydraxxx en una sesión FERAL" loading="lazy" />
        <span className="next-event__stamp">{t.next.stamp1}<br />{t.next.stamp2}</span>
      </div>
      <div id="eventos" className="next-event__content">
        <Eyebrow>{t.next.eyebrow}</Eyebrow>
        <h2>
          <span className="next-event__title-line">{eventBrand}:</span>
          <span className="next-event__title-line next-event__title-name">{eventTitle}</span>
        </h2>
        <div className="event-meta">
          <p><Icon name="calendar" /> <span>{nextEvent.date}</span></p>
          <p><Icon name="clock" /> <span>{nextEvent.time}</span></p>
          <p><Icon name="pin" /> <span>{nextEvent.venue} · {nextEvent.city}</span></p>
        </div>
        <div className="lineup">
          <p className="micro-label">Line-up</p>
          <ul>{nextEvent.lineUp.map((artist) => <li key={artist}>{artist}</li>)}</ul>
        </div>
        <EventCountdown target={nextEvent.startsAt} />
        <ButtonLink to={nextEvent.ticketUrl} icon="ticket">{t.next.buy}</ButtonLink>
      </div>
    </section>
  );
}

function getRemainingTime(target) {
  const distance = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor((distance / 3_600_000) % 24),
    minutes: Math.floor((distance / 60_000) % 60),
    seconds: Math.floor((distance / 1_000) % 60),
  };
}

function EventCountdown({ target }) {
  const [remaining, setRemaining] = useState(() => getRemainingTime(target));
  const { t } = useLanguage();

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemainingTime(target)), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const units = [
    ['days', t.next.units.days],
    ['hours', t.next.units.hours],
    ['minutes', t.next.units.minutes],
    ['seconds', t.next.units.seconds],
  ];

  return (
    <div className="countdown" aria-label={t.next.countdownLabel}>
      <p className="micro-label">{t.next.countdown}</p>
      <div className="countdown__units">
        {units.map(([key, label]) => (
          <div key={key}>
            <strong>{String(remaining[key]).padStart(2, '0')}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Parties() {
  const { localizePath, t } = useLanguage();

  return (
    <section className="home-section shell" aria-labelledby="parties-title">
      <SectionTitle eyebrow={t.parties.eyebrow} title={t.parties.title} accent={t.parties.accent} description={t.parties.description} />
      <div className="party-grid">
        {partyBrands.map((brand) => (
          <article className={`party-card party-card--${brand.accent}`} key={brand.name}>
            <PublicImage src={brand.image} alt={`Ambiente de ${brand.name}`} loading="lazy" />
            <div className="party-card__overlay" />
            <div className="party-card__content">
              <p className="micro-label">{t.parties.brand}</p>
              <h3 className="party-card__logo">{brand.name}</h3>
              <p>{t.parties.descriptions?.[brand.name] || brand.description}</p>
              {brand.to.startsWith('http') ? (
                <a className="party-card__cta" href={brand.to} target="_blank" rel="noreferrer">{t.parties.discover} <Icon name="arrow" size={17} /></a>
              ) : (
                <Link className="party-card__cta" to={localizePath(brand.to)}>{t.parties.discover} <Icon name="arrow" size={17} /></Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function RealizedEvents() {
  const { language, t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState('all');
  const visibleEvents = activeFilter === 'all'
    ? realizedEvents
    : realizedEvents.filter((event) => event.brandKey === activeFilter);
  const dateFormatter = new Intl.DateTimeFormat(languageMeta[language].htmlLang, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="home-section realized-events" aria-labelledby="realized-events-title">
      <div className="shell">
        <SectionTitle eyebrow={t.realized.eyebrow} title={t.realized.title} accent={t.realized.accent} description={t.realized.description} />
        <div className="realized-events__filters" aria-label={t.realized.filterLabel}>
          {realizedEventFilters.map((filter) => (
            <button type="button" className={activeFilter === filter ? 'realized-events__filter--active' : ''} aria-pressed={activeFilter === filter} onClick={() => setActiveFilter(filter)} key={filter}>
              {t.realized.filters[filter]}
            </button>
          ))}
        </div>
        <div className="realized-events__grid">
          {visibleEvents.map((event) => {
            const description = language === 'cast'
              ? event.descriptionSEO
              : t.realized.descriptionTemplates[event.brandKey].replace('{title}', event.title);
            const venue = event.venue === 'Por confirmar' ? t.common.toBeConfirmed : event.venue;
            const municipality = event.municipality === 'Por confirmar' ? t.common.toBeConfirmed : event.municipality;

            return (
              <article className="realized-event-card" key={event.id}>
                <figure className="realized-event-card__poster">
                  <PublicImage src={event.image} alt={event.alt} loading="lazy" />
                </figure>
                <div className="realized-event-card__content">
                  <time dateTime={event.date}>{dateFormatter.format(new Date(`${event.date}T12:00:00`))}</time>
                  <h3>{event.title}</h3>
                  <p className="realized-event-card__brand">{event.brand}</p>
                  <p className="realized-event-card__location">{venue} · {municipality}</p>
                  <p className="realized-event-card__description">{description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function BusinessCta() {
  const { language, t } = useLanguage();

  return (
    <section className="home-section shell">
      <div className="business-cta">
        <div>
          <Eyebrow>{t.business.eyebrow}</Eyebrow>
          <h2>
            {language === 'nl' ? (
              <>
                <span className="business-title__line">{t.business.lead1}</span>
                <span className="business-title__line">{t.business.lead2} <span className="business-title__accent">{t.business.accent}</span></span>
              </>
            ) : (
              <>
                <span className="business-title__lead">
                  <span>{t.business.lead1}</span>{' '}<span>{t.business.lead2}</span>
                </span>
                <span className="business-title__accent">{t.business.accent}</span>
              </>
            )}
          </h2>
          <p>{t.business.description}</p>
        </div>
        <div className="business-cta__actions">
          <ButtonLink to="/servicios">{t.business.services}</ButtonLink>
          <ButtonLink to="/contacto" variant="outline">{t.business.quote}</ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function Services() {
  const { localizePath, t } = useLanguage();

  return (
    <section className="home-section shell" aria-labelledby="services-title">
      <div id="servicios" className="split-heading">
        <SectionTitle eyebrow={t.services.eyebrow} title={t.services.title} accent={t.services.accent} />
          <div><p>{t.services.description}</p><ButtonLink to="/contacto" variant="outline">{t.services.quote}</ButtonLink></div>
      </div>
      <div className="services-grid">
        {services.map((service, index) => (
          <article className="service-card" key={service.title}>
            <Icon name={service.icon} size={24} />
            <h3>{t.services.items?.[index]?.title || service.title}</h3>
            <p>{t.services.items?.[index]?.description || service.description}</p>
            <Link to={localizePath('/contacto')}>{t.services.info} <Icon name="arrow" size={14} /></Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Artists() {
  const { t } = useLanguage();

  return (
    <section className="home-section artists" aria-labelledby="artists-title">
      <div id="artistas" className="shell artists__layout">
        <div className="artists__intro">
          <SectionTitle eyebrow={t.artists.eyebrow} title={t.artists.title} accent={t.artists.accent} />
          <p>{t.artists.description}</p>
          <ButtonLink to="/contacto?tipo=artistas">{t.artists.cta}</ButtonLink>
        </div>
        <div className="artist-services">
          {artistServices.map((service, index) => (
            <article key={service.title}>
              <Icon name={service.icon} size={21} />
              <div><h3>{t.artists.items?.[index]?.title || service.title}</h3><p>{t.artists.items?.[index]?.description || service.description}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Partners() {
  const { t } = useLanguage();

  return (
    <section className="home-section partners" aria-labelledby="partners-title">
      <div className="shell">
        <SectionTitle title={t.partners.title} accent={t.partners.accent} align="center" />
      </div>
      <div className="partners-marquee" aria-label={t.partners.ariaLabel}>
        <div className="partners-marquee__track">
          {[0, 1].map((groupIndex) => (
            <div className="partners-marquee__group" aria-hidden={groupIndex === 1 || undefined} key={groupIndex}>
              {partnerLogos.map((logo) => (
                <figure className="partners-marquee__logo" key={`${groupIndex}-${logo.image}`}>
                  <PublicImage src={logo.image} alt={groupIndex === 1 ? '' : logo.alt} loading="lazy" />
                </figure>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Contact({ page = false }) {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [fields, setFields] = useState(() => ({
    name: '',
    email: '',
    type: searchParams.get('tipo') === 'artistas' ? inquiryTypes[2] : '',
    message: '',
    rgpd: false,
  }));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');

  const updateField = (field, value) => {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '', submit: '' }));
    if (status === 'error') setStatus('idle');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalized = {
      name: fields.name.trim(),
      email: fields.email.trim(),
      type: fields.type,
      message: fields.message.trim(),
    };
    const nextErrors = {};

    if (!normalized.name) nextErrors.name = t.contact.errors.name;
    if (!normalized.email) nextErrors.email = t.contact.errors.email;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) nextErrors.email = t.contact.errors.invalidEmail;
    if (!normalized.type) nextErrors.type = t.contact.errors.type;
    if (!normalized.message) nextErrors.message = t.contact.errors.message;
    if (!fields.rgpd) nextErrors.rgpd = t.contact.errors.consent;

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setStatus('error');
      return;
    }

    setErrors({});
    setStatus('submitting');

    try {
      const response = await fetch(siteConfig.contactEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...normalized, rgpd: true }),
      });
      const result = await response.json();

      if (!response.ok || result?.success !== true) throw new Error('Contact request failed');

      setStatus('success');
      setFields({ name: '', email: '', type: '', message: '', rgpd: false });
    } catch {
      setStatus('error');
      setErrors({ submit: t.contact.submitError });
    }
  };

  const isSubmitting = status === 'submitting';
  const isSuccess = status === 'success';

  return (
    <section className={`home-section contact shell ${page ? 'contact--page' : ''}`} aria-labelledby="contact-title">
      <div id="contacto" className="contact__intro">
        <SectionTitle eyebrow={t.contact.eyebrow} title={t.contact.title} accent={t.contact.accent} heading={page ? 'h1' : 'h2'} headingId="contact-title" />
        <p>{t.contact.description}</p>
        <div className="contact__details">
          <a href={`mailto:${contactLinks.email}`}><Icon name="mail" /><span><small>Email</small>{contactLinks.email}</span></a>
          <a href={contactLinks.instagram} target="_blank" rel="noreferrer"><Icon name="instagram" /><span><small>Instagram</small>{contactLinks.instagramLabel}</span></a>
          <p><Icon name="pin" /><span><small>{t.contact.location}</small>{contactLinks.location}</span></p>
        </div>
      </div>
      <form className={`contact-form contact-form--${status}`} onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label>{t.contact.name}
            <input type="text" name="name" placeholder={t.contact.namePlaceholder} value={fields.name} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.name)} onChange={(event) => updateField('name', event.target.value)} />
            {errors.name ? <span className="contact-form__error">{errors.name}</span> : null}
          </label>
          <label>Email
            <input type="email" name="email" inputMode="email" autoComplete="email" placeholder="tu@email.com" value={fields.email} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.email)} onChange={(event) => updateField('email', event.target.value)} />
            {errors.email ? <span className="contact-form__error">{errors.email}</span> : null}
          </label>
        </div>
        <label>{t.contact.queryType}
          <select name="type" value={fields.type} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.type)} onChange={(event) => updateField('type', event.target.value)}>
            <option value="" disabled>{t.contact.select}</option>
            {inquiryTypes.map((type, index) => <option key={type} value={type}>{t.contact.inquiries[index]}</option>)}
          </select>
          {errors.type ? <span className="contact-form__error">{errors.type}</span> : null}
        </label>
        <label>{t.contact.message}
          <textarea name="message" rows="5" placeholder={t.contact.messagePlaceholder} value={fields.message} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.message)} onChange={(event) => updateField('message', event.target.value)} />
          {errors.message ? <span className="contact-form__error">{errors.message}</span> : null}
        </label>
        <label className={`contact-form__consent ${errors.rgpd ? 'contact-form__consent--error' : ''}`}>
          <input type="checkbox" name="rgpd" checked={fields.rgpd} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.rgpd)} onChange={(event) => updateField('rgpd', event.target.checked)} />
          <span>{t.contact.consent}</span>
        </label>
        {errors.rgpd ? <span className="contact-form__error">{errors.rgpd}</span> : null}
        <button className="button button--primary" type="submit" disabled={isSubmitting || isSuccess}>
          {isSubmitting ? t.contact.sending : isSuccess ? t.contact.sent : t.contact.send}
          {isSubmitting ? <span className="contact-form__spinner" aria-hidden="true" /> : <Icon name="arrow" size={17} />}
        </button>
        <div className="contact-form__status" aria-live="polite">
          {isSubmitting ? <p>{t.contact.sending}</p> : null}
          {isSuccess ? <p>{t.contact.success}</p> : null}
          {errors.submit ? <p>{errors.submit}</p> : null}
        </div>
      </form>
    </section>
  );
}

export default function HomePage() {
  const { t } = useLanguage();
  usePageTitle(t.nav.home, t.hero.description);

  return (
    <div className="home-page">
      <Hero />
      <NextEvent />
      <Partners />
      <ContactCTA />
    </div>
  );
}
