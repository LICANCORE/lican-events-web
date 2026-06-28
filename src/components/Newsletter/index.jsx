import { useId, useState } from 'react';

import { siteConfig } from '../../config/site';
import Icon from '../Icon';
import './newsletter.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Newsletter({ id, compact = false }) {
  const fieldId = useId();
  const emailId = `${id || fieldId}-email`;
  const rgpdId = `${id || fieldId}-rgpd`;
  const messageId = `${id || fieldId}-message`;
  const [email, setEmail] = useState('');
  const [rgpd, setRgpd] = useState(false);
  const [status, setStatus] = useState('idle');
  const [errors, setErrors] = useState({});

  const resetErrorState = (field) => {
    setErrors((current) => ({ ...current, [field]: '' }));
    if (status === 'error') setStatus('idle');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};
    const normalizedEmail = email.trim();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = 'Introduce un email válido.';
    }
    if (!rgpd) {
      nextErrors.rgpd = 'Debes aceptar las comunicaciones para suscribirte.';
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setStatus('error');
      return;
    }

    setErrors({});
    setStatus('submitting');

    try {
      const response = await fetch(siteConfig.newsletterEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, rgpd: true }),
      });

      const result = await response.json();

      if (!response.ok || result?.success !== true) {
        throw new Error('Newsletter request failed');
      }

      setStatus('success');
      setEmail('');
      setRgpd(false);
    } catch {
      setStatus('error');
      setErrors({ submit: 'No se ha podido enviar. Inténtalo de nuevo.' });
    }
  };

  const isSubmitting = status === 'submitting';
  const isSuccess = status === 'success';

  return (
    <section id={id} className={`newsletter newsletter--${status} ${compact ? 'newsletter--compact' : ''}`}>
      <div className="newsletter__copy">
        <p className="newsletter__eyebrow">Comunidad LICAN</p>
        <h2>Apúntate a la newsletter</h2>
        <p>Recibe nuestros próximos eventos, ofertas y noticias de LICAN.</p>
      </div>

      <form className="newsletter__form" onSubmit={handleSubmit} noValidate>
        <div className="newsletter__email-row">
          <label className="sr-only" htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@email.com"
            value={email}
            required
            disabled={isSubmitting || isSuccess}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              resetErrorState('email');
            }}
          />
          <button className="button button--primary" type="submit" disabled={isSubmitting || isSuccess}>
            {isSubmitting ? 'Enviando...' : isSuccess ? 'Suscrito' : 'Enviar'}
            {!isSubmitting ? <Icon name={isSuccess ? 'ticket' : 'arrow'} size={17} /> : <span className="newsletter__spinner" aria-hidden="true" />}
          </button>
        </div>

        {errors.email ? <p id={`${emailId}-error`} className="newsletter__field-error">{errors.email}</p> : null}

        <label className={`newsletter__consent ${errors.rgpd ? 'newsletter__consent--error' : ''}`} htmlFor={rgpdId}>
          <input
            id={rgpdId}
            name="rgpd"
            type="checkbox"
            checked={rgpd}
            required
            disabled={isSubmitting || isSuccess}
            aria-invalid={Boolean(errors.rgpd)}
            aria-describedby={errors.rgpd ? `${rgpdId}-error` : undefined}
            onChange={(event) => {
              setRgpd(event.target.checked);
              resetErrorState('rgpd');
            }}
          />
          <span>Acepto recibir comunicaciones de LICAN EVENTS sobre eventos, ofertas y noticias. Puedo darme de baja en cualquier momento.</span>
        </label>

        {errors.rgpd ? <p id={`${rgpdId}-error`} className="newsletter__field-error">{errors.rgpd}</p> : null}

        <div id={messageId} className="newsletter__status" aria-live="polite">
          {isSubmitting ? <p>Enviando...</p> : null}
          {isSuccess ? <p>Ya estás dentro. Te avisaremos de las próximas fechas.</p> : null}
          {errors.submit ? <p>{errors.submit}</p> : null}
        </div>
      </form>
    </section>
  );
}
