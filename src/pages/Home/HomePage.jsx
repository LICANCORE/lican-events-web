import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Icon from '../../components/Icon';
import GalleryCarousel from '../../components/GalleryCarousel';
import { ButtonLink, Eyebrow, SectionTitle } from '../../components/HomeUI';
import Newsletter from '../../components/Newsletter';
import PublicImage from '../../components/PublicImage';
import { siteConfig } from '../../config/site';
import { artistServices } from '../../data/artists';
import { partyBrands } from '../../data/brands';
import { collaborators } from '../../data/collaborators';
import { nextEvent, pastEvents } from '../../data/events';
import { galleryItems } from '../../data/gallery';
import { contactLinks, inquiryTypes } from '../../data/links';
import { services } from '../../data/services';
import usePageTitle from '../../hooks/usePageTitle';
import useLanguage from '../../i18n/useLanguage';
import './home.css';

function Hero() {
  const { t } = useLanguage();

  return (
    <section id="inicio" className="home-hero" aria-labelledby="hero-title">
      <PublicImage className="home-hero__image" src="/images/headbang-dealers/headbang dealers-dubstep-publico-barcelona-hero.webp" alt="Público de LICAN Events en una noche de música electrónica" />
      <div className="home-hero__noise" />
      <div className="home-hero__content shell">
        <Eyebrow>Tarragona · Barcelona · Underground</Eyebrow>
        <h1 id="hero-title">
          <span className="hero-title__line hero-title__lead">
            <span>{t.hero.line1}</span>{' '}<span>{t.hero.line2}</span>
          </span>
          <span className="hero-title__line hero-title__gradient">{t.hero.gradient}</span>
        </h1>
        <p>{t.hero.description}</p>
        <div className="button-row">
          <ButtonLink to={nextEvent.ticketUrl} icon="ticket">{t.hero.nextEvent}</ButtonLink>
          <ButtonLink to="/#servicios" variant="outline">{t.hero.hireServices}</ButtonLink>
          <a className="text-link" href="#newsletter">{t.hero.joinNewsletter} <Icon name="arrow" size={16} /></a>
        </div>
      </div>
      <a className="home-hero__scroll" href="#eventos" aria-label={t.hero.scroll}><span /> Scroll</a>
    </section>
  );
}

function NextEvent() {
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

function Parties() {
  const { t } = useLanguage();

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
              <p>{brand.description}</p>
              <a className="party-card__cta" href={brand.to} target="_blank" rel="noreferrer">{t.parties.discover} <Icon name="arrow" size={17} /></a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Memory() {
  const { t } = useLanguage();

  return (
    <section className="home-section memory" aria-labelledby="memory-title">
      <div className="shell">
        <SectionTitle eyebrow={t.memory.eyebrow} title={t.memory.title} accent={t.memory.accent} />
        <div className="memory-list">
          {pastEvents.map((event, index) => (
            <article className="memory-row" key={`${event.name}-${event.venue}`}>
              <span className="memory-row__number">0{index + 1}</span>
              <div className="memory-row__thumb"><PublicImage src={event.image} alt="" loading="lazy" /></div>
              <h3>{event.name}</h3>
              <p>{event.venue}</p>
              <p>{event.city}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BusinessCta() {
  const { t } = useLanguage();

  return (
    <section className="home-section shell">
      <div className="business-cta">
        <div>
          <Eyebrow>{t.business.eyebrow}</Eyebrow>
          <h2>
            <span className="business-title__lead">
              <span>{t.business.lead1}</span>{' '}<span>{t.business.lead2}</span>
            </span>
            <span className="business-title__accent">{t.business.accent}</span>
          </h2>
          <p>{t.business.description}</p>
        </div>
        <div className="business-cta__actions">
          <ButtonLink to="/#servicios">{t.business.services}</ButtonLink>
          <ButtonLink to="/#contacto" variant="outline">{t.business.quote}</ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Services() {
  const { t } = useLanguage();

  return (
    <section className="home-section shell" aria-labelledby="services-title">
      <div id="servicios" className="split-heading">
        <SectionTitle eyebrow={t.services.eyebrow} title={t.services.title} accent={t.services.accent} />
        <div><p>{t.services.description}</p><ButtonLink to="/#contacto" variant="outline">{t.services.quote}</ButtonLink></div>
      </div>
      <div className="services-grid">
        {services.map((service) => (
          <article className="service-card" key={service.title}>
            <Icon name={service.icon} size={24} />
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <Link to="/#servicios">{t.services.info} <Icon name="arrow" size={14} /></Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function Artists() {
  const { t } = useLanguage();

  return (
    <section className="home-section artists" aria-labelledby="artists-title">
      <div id="artistas" className="shell artists__layout">
        <div className="artists__intro">
          <SectionTitle eyebrow={t.artists.eyebrow} title={t.artists.title} accent={t.artists.accent} />
          <p>{t.artists.description}</p>
          <ButtonLink to="/#contacto">{t.artists.cta}</ButtonLink>
        </div>
        <div className="artist-services">
          {artistServices.map((service) => (
            <article key={service.title}>
              <Icon name={service.icon} size={21} />
              <div><h3>{service.title}</h3><p>{service.description}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  const { t } = useLanguage();

  return (
    <section className="home-section shell" aria-labelledby="gallery-title">
      <div className="gallery-heading">
        <SectionTitle eyebrow={t.gallery.eyebrow} title={t.gallery.title} />
        <p className="gallery-heading__count">{galleryItems.length} {t.gallery.photos}</p>
      </div>
      <div id="galeria" className="scroll-anchor" aria-hidden="true" />
      <GalleryCarousel items={galleryItems} />
    </section>
  );
}

function Collaborators() {
  const { t } = useLanguage();

  return (
    <section className="home-section collaborators" aria-labelledby="collaborators-title">
      <div className="shell">
        <SectionTitle eyebrow={t.collaborators.eyebrow} title={t.collaborators.title} accent={t.collaborators.accent} align="center" />
        <div className="collaborator-list">
          {collaborators.map((name) => <span key={name}>{name}</span>)}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const { t } = useLanguage();
  const [fields, setFields] = useState({ name: '', email: '', type: '', message: '', rgpd: false });
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
    <section className="home-section contact shell" aria-labelledby="contact-title">
      <div id="contacto" className="contact__intro">
        <SectionTitle eyebrow={t.contact.eyebrow} title={t.contact.title} accent={t.contact.accent} />
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
  usePageTitle(t.nav.home);

  return (
    <div className="home-page">
      <Hero />
      <NextEvent />
      <Parties />
      <Memory />
      <BusinessCta />
      <div className="shell newsletter-wrap"><Newsletter id="newsletter" compact /></div>
      <Services />
      <Artists />
      <Gallery />
      <Collaborators />
      <div className="home-section shell"><Newsletter id="comunidad" /></div>
      <Contact />
    </div>
  );
}
