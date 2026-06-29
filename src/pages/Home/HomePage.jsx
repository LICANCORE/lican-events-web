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
import './home.css';

function Hero() {
  return (
    <section id="inicio" className="home-hero" aria-labelledby="hero-title">
      <PublicImage className="home-hero__image" src="/images/headbang-dealers/headbang dealers-dubstep-publico-barcelona-hero.webp" alt="Público de LICAN Events en una noche de música electrónica" />
      <div className="home-hero__noise" />
      <div className="home-hero__content shell">
        <Eyebrow>Tarragona · Barcelona · Underground</Eyebrow>
        <h1 id="hero-title">Donde la electrónica <span>vibra</span></h1>
        <p>Eventos electrónicos, producción audiovisual, booking y experiencias underground desde Tarragona y Barcelona.</p>
        <div className="button-row">
          <ButtonLink to={nextEvent.ticketUrl} icon="ticket">Ver próximo evento</ButtonLink>
          <ButtonLink to="/#servicios" variant="outline">Contratar servicios</ButtonLink>
          <a className="text-link" href="#newsletter">Unirme a la newsletter <Icon name="arrow" size={16} /></a>
        </div>
      </div>
      <a className="home-hero__scroll" href="#eventos" aria-label="Bajar al próximo evento"><span /> Scroll</a>
    </section>
  );
}

function NextEvent() {
  return (
    <section id="eventos" className="next-event home-section">
      <div className="next-event__visual">
        <PublicImage src={nextEvent.image} alt="Hydraxxx en una sesión FERAL" loading="lazy" />
        <span className="next-event__stamp">Próximo<br />evento</span>
      </div>
      <div className="next-event__content">
        <Eyebrow>Próxima fecha</Eyebrow>
        <h2>{nextEvent.name}</h2>
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
        <ButtonLink to={nextEvent.ticketUrl} icon="ticket">Comprar entradas</ButtonLink>
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

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemainingTime(target)), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const units = [
    ['days', 'Días'],
    ['hours', 'Horas'],
    ['minutes', 'Minutos'],
    ['seconds', 'Segundos'],
  ];

  return (
    <div className="countdown" aria-label="Tiempo restante para el evento">
      <p className="micro-label">Cuenta atrás</p>
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
  return (
    <section className="home-section shell" aria-labelledby="parties-title">
      <SectionTitle eyebrow="Eventos · Identidad" title="Nuestras" accent="fiestas" description="Tres universos. Una misma forma de entender la pista." />
      <div className="party-grid">
        {partyBrands.map((brand) => (
          <article className={`party-card party-card--${brand.accent}`} key={brand.name}>
            <PublicImage src={brand.image} alt={`Ambiente de ${brand.name}`} loading="lazy" />
            <div className="party-card__overlay" />
            <div className="party-card__content">
              <p className="micro-label">Una marca LICAN</p>
              <h3 className="party-card__logo">{brand.name}</h3>
              <p>{brand.description}</p>
              <a className="party-card__cta" href={brand.to} target="_blank" rel="noreferrer">Descubrir <Icon name="arrow" size={17} /></a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Memory() {
  return (
    <section className="home-section memory" aria-labelledby="memory-title">
      <div className="shell">
        <SectionTitle eyebrow="Memoria LICAN" title="Eventos" accent="realizados" />
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
  return (
    <section className="home-section shell">
      <div className="business-cta">
        <div>
          <Eyebrow>B2B · Producción</Eyebrow>
          <h2>Organizamos tu evento <span>a medida</span></h2>
          <p>Producción, DJs, sonido, visuales, contenido audiovisual, ticketing, campaña y coordinación técnica. Creamos eventos para salas, marcas, ayuntamientos y proyectos culturales.</p>
        </div>
        <div className="business-cta__actions">
          <ButtonLink to="/#servicios">Ver servicios</ButtonLink>
          <ButtonLink to="/#contacto" variant="outline">Solicitar presupuesto</ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="servicios" className="home-section shell" aria-labelledby="services-title">
      <div className="split-heading">
        <SectionTitle eyebrow="B2B · Producción" title="Servicios" accent="profesionales" />
        <div><p>Desde la producción integral hasta el detalle audiovisual que completa la experiencia.</p><ButtonLink to="/#contacto" variant="outline">Solicitar presupuesto</ButtonLink></div>
      </div>
      <div className="services-grid">
        {services.map((service) => (
          <article className="service-card" key={service.title}>
            <Icon name={service.icon} size={24} />
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <Link to="/#servicios">Info <Icon name="arrow" size={14} /></Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function Artists() {
  return (
    <section id="artistas" className="home-section artists" aria-labelledby="artists-title">
      <div className="shell artists__layout">
        <div className="artists__intro">
          <SectionTitle eyebrow="DJs · Productores · Artistas" title="Artistas, DJs" accent="y productores" />
          <p>Book fotográfico, presskit, grabación de sets, contenido audiovisual, visuales, promoción y apoyo para mover tu proyecto con una imagen profesional.</p>
          <ButtonLink to="/#contacto">Quiero trabajar con LICAN</ButtonLink>
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
  return (
    <section id="galeria" className="home-section shell" aria-labelledby="gallery-title">
      <div className="gallery-heading">
        <SectionTitle eyebrow="Memoria visual" title="Galería" />
        <p className="gallery-heading__count">{galleryItems.length} fotografías</p>
      </div>
      <GalleryCarousel items={galleryItems} />
    </section>
  );
}

function Collaborators() {
  return (
    <section className="home-section collaborators" aria-labelledby="collaborators-title">
      <div className="shell">
        <SectionTitle eyebrow="Confianza" title="Colaboradores" accent="y espacios" align="center" />
        <div className="collaborator-list">
          {collaborators.map((name) => <span key={name}>{name}</span>)}
        </div>
      </div>
    </section>
  );
}

function Contact() {
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

    if (!normalized.name) nextErrors.name = 'Introduce tu nombre.';
    if (!normalized.email) nextErrors.email = 'Introduce tu email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) nextErrors.email = 'Introduce un email válido.';
    if (!normalized.type) nextErrors.type = 'Selecciona un tipo de consulta.';
    if (!normalized.message) nextErrors.message = 'Escribe tu mensaje.';
    if (!fields.rgpd) nextErrors.rgpd = 'Debes aceptar la política de privacidad.';

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
      setErrors({ submit: 'No se ha podido enviar. Inténtalo de nuevo o escríbenos a info@licanevents.com.' });
    }
  };

  const isSubmitting = status === 'submitting';
  const isSuccess = status === 'success';

  return (
    <section id="contacto" className="home-section contact shell" aria-labelledby="contact-title">
      <div className="contact__intro">
        <SectionTitle eyebrow="Hablemos" title="Contacta" accent="con LICAN" />
        <p>Entradas, servicios, artistas, patrocinios o colaboraciones. Estamos aquí.</p>
        <div className="contact__details">
          <a href={`mailto:${contactLinks.email}`}><Icon name="mail" /><span><small>Email</small>{contactLinks.email}</span></a>
          <a href={contactLinks.instagram} target="_blank" rel="noreferrer"><Icon name="instagram" /><span><small>Instagram</small>{contactLinks.instagramLabel}</span></a>
          <p><Icon name="pin" /><span><small>Ubicación</small>{contactLinks.location}</span></p>
        </div>
      </div>
      <form className={`contact-form contact-form--${status}`} onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label>Nombre
            <input type="text" name="name" placeholder="Tu nombre" value={fields.name} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.name)} onChange={(event) => updateField('name', event.target.value)} />
            {errors.name ? <span className="contact-form__error">{errors.name}</span> : null}
          </label>
          <label>Email
            <input type="email" name="email" inputMode="email" autoComplete="email" placeholder="tu@email.com" value={fields.email} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.email)} onChange={(event) => updateField('email', event.target.value)} />
            {errors.email ? <span className="contact-form__error">{errors.email}</span> : null}
          </label>
        </div>
        <label>Tipo de consulta
          <select name="type" value={fields.type} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.type)} onChange={(event) => updateField('type', event.target.value)}>
            <option value="" disabled>Selecciona...</option>
            {inquiryTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          {errors.type ? <span className="contact-form__error">{errors.type}</span> : null}
        </label>
        <label>Mensaje
          <textarea name="message" rows="5" placeholder="Cuéntanos en qué podemos ayudarte..." value={fields.message} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.message)} onChange={(event) => updateField('message', event.target.value)} />
          {errors.message ? <span className="contact-form__error">{errors.message}</span> : null}
        </label>
        <label className={`contact-form__consent ${errors.rgpd ? 'contact-form__consent--error' : ''}`}>
          <input type="checkbox" name="rgpd" checked={fields.rgpd} required disabled={isSubmitting || isSuccess} aria-invalid={Boolean(errors.rgpd)} onChange={(event) => updateField('rgpd', event.target.checked)} />
          <span>Acepto que LICAN EVENTS trate mis datos para responder a esta consulta.</span>
        </label>
        {errors.rgpd ? <span className="contact-form__error">{errors.rgpd}</span> : null}
        <button className="button button--primary" type="submit" disabled={isSubmitting || isSuccess}>
          {isSubmitting ? 'Enviando...' : isSuccess ? 'Enviado' : 'Enviar mensaje'}
          {isSubmitting ? <span className="contact-form__spinner" aria-hidden="true" /> : <Icon name="arrow" size={17} />}
        </button>
        <div className="contact-form__status" aria-live="polite">
          {isSubmitting ? <p>Enviando...</p> : null}
          {isSuccess ? <p>Mensaje enviado correctamente. Te responderemos lo antes posible.</p> : null}
          {errors.submit ? <p>{errors.submit}</p> : null}
        </div>
      </form>
    </section>
  );
}

export default function HomePage() {
  usePageTitle('Inicio');

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
