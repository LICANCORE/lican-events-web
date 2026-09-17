const NEWSLETTER_ENDPOINT =
  "https://newsletter-headbang-dealers-the-game.licancorp.workers.dev";
const ACCESS_STORAGE_KEY = "headbangDealersNewsletterAccess";
const ACCESS_SOURCE = "headbang-dealers-game";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const PASSWORD_REQUIREMENTS = [
  (value) => value.length >= 10,
  (value) => /[A-Z]/u.test(value),
  (value) => /[a-z]/u.test(value),
  (value) => /\d/u.test(value),
  (value) => /[^A-Za-z0-9]/u.test(value),
];

const copy = {
  es: {
    signupButton: "CREAR USUARIO",
    signupCopy:
      "Crea tu usuario. Recibirás un correo para confirmar la cuenta antes de iniciar sesión.",
    connectingSignup: "CREANDO USUARIO EN HEADBANG CLOUD...",
    connectingSignin: "INICIANDO SESIÓN EN HEADBANG CLOUD...",
    emailRequired: "INTRODUCE TU CORREO ELECTRÓNICO.",
    emailInvalid: "INTRODUCE UN CORREO ELECTRÓNICO VÁLIDO.",
    passwordRequired: "INTRODUCE TU CONTRASEÑA.",
    passwordWeak:
      "LA CONTRASEÑA DEBE TENER 10 CARACTERES, MAYÚSCULA, MINÚSCULA, NÚMERO Y SÍMBOLO.",
    passwordMismatch: "LAS CONTRASEÑAS NO COINCIDEN.",
    cloudUnavailable:
      "SUPABASE NO ESTÁ DISPONIBLE. PUEDES CONTINUAR COMO INVITADO.",
    signupFailed:
      "NO SE HA PODIDO CREAR EL USUARIO. REVISA LOS DATOS O INTÉNTALO DE NUEVO.",
    signinFailed:
      "NO SE HA PODIDO INICIAR SESIÓN. REVISA LOS DATOS O INTÉNTALO DE NUEVO.",
    confirmed:
      "USUARIO CREADO. REVISA TU CORREO PARA CONFIRMAR LA CUENTA.",
    confirmedNewsletter:
      "USUARIO CREADO Y NEWSLETTER GUARDADA. REVISA TU CORREO PARA CONFIRMAR LA CUENTA.",
    confirmedNewsletterFailed:
      "USUARIO CREADO. REVISA TU CORREO PARA CONFIRMARLO. LA NEWSLETTER NO SE HA PODIDO GUARDAR.",
    signedUp: "USUARIO CREADO Y SESIÓN INICIADA.",
    signedIn: "SESIÓN INICIADA.",
    newsletterSaved: " NEWSLETTER GUARDADA.",
    newsletterFailed: " LA NEWSLETTER NO SE HA PODIDO GUARDAR.",
  },
  en: {
    signupButton: "CREATE USER",
    signupCopy:
      "Create your user. You will receive an email to confirm the account before signing in.",
    connectingSignup: "CREATING USER IN HEADBANG CLOUD...",
    connectingSignin: "SIGNING IN TO HEADBANG CLOUD...",
    emailRequired: "ENTER YOUR EMAIL.",
    emailInvalid: "ENTER A VALID EMAIL.",
    passwordRequired: "ENTER YOUR PASSWORD.",
    passwordWeak:
      "USE 10 CHARACTERS WITH UPPERCASE, LOWERCASE, A NUMBER AND A SYMBOL.",
    passwordMismatch: "THE PASSWORDS DO NOT MATCH.",
    cloudUnavailable:
      "SUPABASE IS UNAVAILABLE. YOU CAN CONTINUE AS A GUEST.",
    signupFailed: "THE USER COULD NOT BE CREATED. CHECK THE DATA AND TRY AGAIN.",
    signinFailed: "SIGN IN FAILED. CHECK THE DATA AND TRY AGAIN.",
    confirmed: "USER CREATED. CHECK YOUR EMAIL TO CONFIRM THE ACCOUNT.",
    confirmedNewsletter:
      "USER CREATED AND NEWSLETTER SAVED. CHECK YOUR EMAIL TO CONFIRM THE ACCOUNT.",
    confirmedNewsletterFailed:
      "USER CREATED. CHECK YOUR EMAIL TO CONFIRM IT. THE NEWSLETTER COULD NOT BE SAVED.",
    signedUp: "USER CREATED AND SIGNED IN.",
    signedIn: "SIGNED IN.",
    newsletterSaved: " NEWSLETTER SAVED.",
    newsletterFailed: " THE NEWSLETTER COULD NOT BE SAVED.",
  },
  de: {
    signupButton: "BENUTZER ERSTELLEN",
    signupCopy:
      "Erstelle deinen Benutzer. Du erhältst eine E-Mail, um das Konto vor der Anmeldung zu bestätigen.",
    connectingSignup: "BENUTZER WIRD IN HEADBANG CLOUD ERSTELLT...",
    connectingSignin: "ANMELDUNG BEI HEADBANG CLOUD...",
    emailRequired: "GIB DEINE E-MAIL-ADRESSE EIN.",
    emailInvalid: "GIB EINE GÜLTIGE E-MAIL-ADRESSE EIN.",
    passwordRequired: "GIB DEIN PASSWORT EIN.",
    passwordWeak:
      "VERWENDE 10 ZEICHEN MIT GROSS- UND KLEINBUCHSTABEN, ZAHL UND SYMBOL.",
    passwordMismatch: "DIE PASSWÖRTER STIMMEN NICHT ÜBEREIN.",
    cloudUnavailable:
      "SUPABASE IST NICHT VERFÜGBAR. DU KANNST ALS GAST WEITERSPIELEN.",
    signupFailed:
      "DER BENUTZER KONNTE NICHT ERSTELLT WERDEN. PRÜFE DIE DATEN UND VERSUCHE ES ERNEUT.",
    signinFailed:
      "DIE ANMELDUNG IST FEHLGESCHLAGEN. PRÜFE DIE DATEN UND VERSUCHE ES ERNEUT.",
    confirmed:
      "BENUTZER ERSTELLT. PRÜFE DEINE E-MAIL, UM DAS KONTO ZU BESTÄTIGEN.",
    confirmedNewsletter:
      "BENUTZER ERSTELLT UND NEWSLETTER GESPEICHERT. PRÜFE DEINE E-MAIL, UM DAS KONTO ZU BESTÄTIGEN.",
    confirmedNewsletterFailed:
      "BENUTZER ERSTELLT. PRÜFE DEINE E-MAIL ZUR BESTÄTIGUNG. DER NEWSLETTER KONNTE NICHT GESPEICHERT WERDEN.",
    signedUp: "BENUTZER ERSTELLT UND ANGEMELDET.",
    signedIn: "ANGEMELDET.",
    newsletterSaved: " NEWSLETTER GESPEICHERT.",
    newsletterFailed: " DER NEWSLETTER KONNTE NICHT GESPEICHERT WERDEN.",
  },
  eo: {
    signupButton: "KREI UZANTON",
    signupCopy:
      "Kreu vian uzanton. Vi ricevos retmesaĝon por konfirmi la konton antaŭ ensaluto.",
    connectingSignup: "KREANTE UZANTON EN HEADBANG CLOUD...",
    connectingSignin: "ENSALUTANTE EN HEADBANG CLOUD...",
    emailRequired: "ENIGU VIAN RETPOŜTADRESON.",
    emailInvalid: "ENIGU VALIDAN RETPOŜTADRESON.",
    passwordRequired: "ENIGU VIAN PASVORTON.",
    passwordWeak:
      "UZU 10 SIGNOJN KUN MAJUSKLO, MINUSKLO, NUMERO KAJ SIMBOLO.",
    passwordMismatch: "LA PASVORTOJ NE KONGRUAS.",
    cloudUnavailable:
      "SUPABASE NE DISPONEBLAS. VI POVAS DAŬRIGI KIEL GASTO.",
    signupFailed:
      "LA UZANTO NE POVIS ESTI KREITA. KONTROLU LA DATUMOJN KAJ REPROVU.",
    signinFailed:
      "ENSALUTO FIASKIS. KONTROLU LA DATUMOJN KAJ REPROVU.",
    confirmed:
      "UZANTO KREITA. KONTROLU VIAN RETPOŜTON POR KONFIRMI LA KONTON.",
    confirmedNewsletter:
      "UZANTO KREITA KAJ NOVAĴLETERO KONSERVITA. KONTROLU VIAN RETPOŜTON POR KONFIRMI LA KONTON.",
    confirmedNewsletterFailed:
      "UZANTO KREITA. KONTROLU VIAN RETPOŜTON POR KONFIRMI ĜIN. LA NOVAĴLETERO NE POVIS ESTI KONSERVITA.",
    signedUp: "UZANTO KREITA KAJ ENSALUTINTA.",
    signedIn: "ENSALUTINTA.",
    newsletterSaved: " NOVAĴLETERO KONSERVITA.",
    newsletterFailed: " LA NOVAĴLETERO NE POVIS ESTI KONSERVITA.",
  },
};

const form = document.getElementById("newsletter-form");
const panel = document.getElementById("newsletter-panel");
const gate = document.getElementById("newsletter-gate");
const language = document.getElementById("newsletter-language");
const email = document.getElementById("newsletter-email");
const password = document.getElementById("newsletter-password");
const passwordConfirm = document.getElementById(
  "newsletter-password-confirm",
);
const consent = document.getElementById("newsletter-consent");
const honeypot = document.getElementById("newsletter-website");
const submit = document.getElementById("newsletter-submit");
const status = document.getElementById("newsletter-status");

let pending = false;
let completed = false;

function currentCopy() {
  return copy[language?.value] ?? copy.es;
}

function currentMode() {
  return panel?.classList.contains("is-signin") ? "signin" : "signup";
}

function setStatus(message, kind = "info") {
  status.textContent = message;
  status.dataset.kind = kind;
}

function setPending(value) {
  pending = value;
  submit.disabled = value;
  submit.setAttribute("aria-disabled", String(value));
}

function syncSignupCopy() {
  if (currentMode() !== "signup") {
    return;
  }

  const text = currentCopy();
  const description = panel?.querySelector("[data-gate-copy='copy']");
  if (description) {
    description.textContent = text.signupCopy;
  }
  submit.textContent = text.signupButton;
}

function validate(mode) {
  const text = currentCopy();
  const normalizedEmail = email.value.trim().toLowerCase();
  const passwordValue = password.value;

  if (!normalizedEmail) {
    return { valid: false, message: text.emailRequired, field: email };
  }
  if (
    normalizedEmail.length > 254 ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    return { valid: false, message: text.emailInvalid, field: email };
  }
  if (!passwordValue) {
    return { valid: false, message: text.passwordRequired, field: password };
  }
  if (
    mode === "signup" &&
    !PASSWORD_REQUIREMENTS.every((requirement) => requirement(passwordValue))
  ) {
    return { valid: false, message: text.passwordWeak, field: password };
  }
  if (mode === "signup" && passwordValue !== passwordConfirm.value) {
    return {
      valid: false,
      message: text.passwordMismatch,
      field: passwordConfirm,
    };
  }

  return {
    valid: true,
    email: normalizedEmail,
    password: passwordValue,
  };
}

async function waitForCloud(timeoutMs = 8_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (window.HeadbangCloud?.isConfigured) {
      return window.HeadbangCloud;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 80));
  }
  return null;
}

async function subscribeToNewsletter(normalizedEmail) {
  if (!consent.checked) {
    return { requested: false, success: true };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(NEWSLETTER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        privacyAccepted: true,
        newsletterConsent: true,
        consentTimestamp: new Date().toISOString(),
        source: ACCESS_SOURCE,
        gameVersion: "V019",
        website: honeypot.value,
      }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    return { requested: true, success: response.ok && result?.success === true };
  } catch {
    return { requested: true, success: false };
  } finally {
    window.clearTimeout(timeout);
  }
}

function grantAccess(authResult, newsletterResult) {
  const timestamp = new Date().toISOString();
  try {
    localStorage.setItem(
      ACCESS_STORAGE_KEY,
      JSON.stringify({
        accountAccess: true,
        subscribed:
          newsletterResult.requested === true &&
          newsletterResult.success === true,
        timestamp,
        consentVersion: "2",
        source: ACCESS_SOURCE,
        userId: authResult.userId ?? null,
      }),
    );
  } catch {
    // Auth success must not be reversed by unavailable browser storage.
  }

  window.setTimeout(() => {
    gate.classList.add("is-hidden");
    document.documentElement.dataset.appVisible = "true";
    window.dispatchEvent(
      new CustomEvent("headbang-account-gate-complete", {
        detail: {
          authenticated: authResult.authenticated === true,
          confirmationRequired: authResult.confirmationRequired === true,
          newsletterSubscribed:
            newsletterResult.requested === true &&
            newsletterResult.success === true,
        },
      }),
    );
  }, authResult.confirmationRequired ? 2_600 : 1_100);
}

function successMessage(mode, authResult, newsletterResult) {
  const text = currentCopy();

  if (authResult.confirmationRequired) {
    if (!newsletterResult.requested) {
      return text.confirmed;
    }
    return newsletterResult.success
      ? text.confirmedNewsletter
      : text.confirmedNewsletterFailed;
  }

  const base = mode === "signup" ? text.signedUp : text.signedIn;
  if (!newsletterResult.requested) {
    return base;
  }
  return `${base}${
    newsletterResult.success ? text.newsletterSaved : text.newsletterFailed
  }`;
}

async function handleSubmit(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (pending || completed) {
    return;
  }

  const mode = currentMode();
  const validation = validate(mode);
  if (!validation.valid) {
    setStatus(validation.message, "error");
    validation.field.focus();
    return;
  }

  const text = currentCopy();
  setPending(true);
  setStatus(
    mode === "signup" ? text.connectingSignup : text.connectingSignin,
    "info",
  );

  try {
    const cloud = await waitForCloud();
    if (!cloud) {
      setStatus(text.cloudUnavailable, "error");
      return;
    }

    const authResult =
      mode === "signup"
        ? await cloud.signUp(validation.email, validation.password)
        : await cloud.signIn(validation.email, validation.password);

    password.value = "";
    passwordConfirm.value = "";

    if (!authResult?.success) {
      setStatus(
        authResult?.message ??
          (mode === "signup" ? text.signupFailed : text.signinFailed),
        "error",
      );
      return;
    }

    const newsletterResult = await subscribeToNewsletter(validation.email);
    setStatus(
      successMessage(mode, authResult, newsletterResult),
      newsletterResult.requested && !newsletterResult.success
        ? "warning"
        : "success",
    );
    completed = true;
    grantAccess(authResult, newsletterResult);
  } catch {
    setStatus(
      mode === "signup" ? text.signupFailed : text.signinFailed,
      "error",
    );
  } finally {
    if (!completed) {
      setPending(false);
    }
  }
}

form.addEventListener("submit", handleSubmit, { capture: true });

email.addEventListener("input", () => {
  if (status.dataset.kind === "error") {
    setStatus("");
  }
});

language?.addEventListener("change", () => {
  window.setTimeout(syncSignupCopy, 0);
});

new MutationObserver(syncSignupCopy).observe(panel, {
  attributes: true,
  attributeFilter: ["class"],
});

new MutationObserver(syncSignupCopy).observe(gate, {
  attributes: true,
  attributeFilter: ["class"],
});

window.addEventListener("headbang-cloud-ready", syncSignupCopy);
window.setTimeout(syncSignupCopy, 0);
