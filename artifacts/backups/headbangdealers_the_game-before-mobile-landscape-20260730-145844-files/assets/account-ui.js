const ACCOUNT_UI_VERSION = "3.0.0";
const PRIVACY_POLICY_URL = null;
// TODO(PUBLIC RELEASE): replace PRIVACY_POLICY_URL with LICAN's published
// privacy/account-terms URL before enabling public account registration.

const PASSWORD_RULES = [
  { id: "minimum_length", label: "10 caracteres", test: (value) => value.length >= 10 },
  { id: "uppercase", label: "Una mayúscula", test: (value) => /[A-Z]/u.test(value) },
  { id: "lowercase", label: "Una minúscula", test: (value) => /[a-z]/u.test(value) },
  { id: "number", label: "Un número", test: (value) => /\d/u.test(value) },
  { id: "symbol", label: "Un símbolo", test: (value) => /[^A-Za-z0-9]/u.test(value) },
];

const state = {
  cloud: null,
  currentScreen: "signin",
  previousFocus: null,
  pending: false,
  failedAttempts: 0,
  cooldownUntil: 0,
  unsubscribe: null,
  syncPreview: null,
  pendingSyncStrategy: null,
  refreshingSync: false,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function maskEmail(email) {
  const [localPart = "", domain = ""] = String(email ?? "").split("@");

  if (!localPart || !domain) {
    return "CUENTA CONECTADA";
  }

  return `${localPart.slice(0, 1)}***@${domain}`;
}

function passwordRulesMarkup() {
  return `
    <ul class="account-password-rules" data-password-rules aria-label="Requisitos de contraseña">
      ${PASSWORD_RULES.map(
        (rule) => `<li data-rule="${rule.id}"><span aria-hidden="true">□</span>${rule.label}</li>`,
      ).join("")}
    </ul>
  `;
}

function fieldMarkup({
  id,
  label,
  type = "text",
  autocomplete,
  inputmode,
}) {
  return `
    <label class="account-field" for="${id}">
      <span>${label}</span>
      <input
        id="${id}"
        name="${id}"
        type="${type}"
        ${autocomplete ? `autocomplete="${autocomplete}"` : ""}
        ${inputmode ? `inputmode="${inputmode}"` : ""}
        aria-describedby="${id}-error"
      />
      <small id="${id}-error" class="account-field-error"></small>
    </label>
  `;
}

function signinMarkup() {
  return `
    <p class="account-eyebrow">HEADBANG CLOUD // ACCESS</p>
    <h2 id="account-title">INICIAR SESIÓN</h2>
    <form id="account-form" data-form="signin" novalidate>
      ${fieldMarkup({
        id: "account-email",
        label: "Correo",
        type: "email",
        autocomplete: "email",
        inputmode: "email",
      })}
      ${fieldMarkup({
        id: "account-password",
        label: "Contraseña",
        type: "password",
        autocomplete: "current-password",
      })}
      <button class="account-primary" type="submit">INICIAR SESIÓN</button>
      <button class="account-secondary" type="button" data-screen="signup">CREAR CUENTA</button>
      <button class="account-text-button" type="button" data-screen="reset">HE OLVIDADO MI CONTRASEÑA</button>
      <button class="account-guest-button" type="button" data-action="guest">CONTINUAR COMO INVITADO</button>
    </form>
  `;
}

function signupMarkup() {
  const legalLabel = PRIVACY_POLICY_URL
    ? "Política de Privacidad y condiciones de la cuenta"
    : "Política de Privacidad y condiciones (URL LEGAL PENDIENTE)";

  return `
    <p class="account-eyebrow">HEADBANG CLOUD // NEW ID</p>
    <h2 id="account-title">CREAR CUENTA</h2>
    <p class="account-copy">La cuenta se utiliza para identificarte y, en una fase posterior, sincronizar tu progreso entre dispositivos.</p>
    <form id="account-form" data-form="signup" novalidate>
      ${fieldMarkup({
        id: "account-email",
        label: "Correo",
        type: "email",
        autocomplete: "email",
        inputmode: "email",
      })}
      ${fieldMarkup({
        id: "account-password",
        label: "Contraseña",
        type: "password",
        autocomplete: "new-password",
      })}
      ${passwordRulesMarkup()}
      ${fieldMarkup({
        id: "account-password-confirm",
        label: "Repetir contraseña",
        type: "password",
        autocomplete: "new-password",
      })}
      <label class="account-consent" for="account-consent">
        <input id="account-consent" name="account-consent" type="checkbox" />
        <span>He leído y acepto la
          <a
            href="${PRIVACY_POLICY_URL ?? "#"}"
            ${PRIVACY_POLICY_URL ? 'target="_blank" rel="noopener noreferrer"' : 'data-action="legal-pending" aria-disabled="true"'}
          >${legalLabel}</a>.
        </span>
      </label>
      <small id="account-consent-error" class="account-field-error"></small>
      <div id="headbang-turnstile-slot" data-turnstile-integration="pending" hidden></div>
      <button class="account-primary" type="submit">CREAR CUENTA</button>
      <button class="account-secondary" type="button" data-screen="signin">YA TENGO CUENTA</button>
      <button class="account-guest-button" type="button" data-action="guest">CONTINUAR COMO INVITADO</button>
    </form>
  `;
}

function confirmationMarkup() {
  return `
    <p class="account-eyebrow">HEADBANG CLOUD // VERIFY</p>
    <h2 id="account-title">CONFIRMA TU CORREO</h2>
    <div class="account-signal" aria-hidden="true">EMAIL_SIGNAL // SENT</div>
    <p class="account-copy account-copy--strong">Cuenta creada. Revisa tu correo y confirma la dirección antes de iniciar sesión.</p>
    <button class="account-primary" type="button" data-screen="signin">VOLVER AL INICIO DE SESIÓN</button>
    <button class="account-guest-button" type="button" data-action="guest">CONTINUAR COMO INVITADO</button>
  `;
}

function resetMarkup() {
  return `
    <p class="account-eyebrow">HEADBANG CLOUD // RECOVERY</p>
    <h2 id="account-title">RECUPERAR CONTRASEÑA</h2>
    <p class="account-copy">Te enviaremos un enlace de un solo uso si existe una cuenta asociada.</p>
    <form id="account-form" data-form="reset" novalidate>
      ${fieldMarkup({
        id: "account-email",
        label: "Correo",
        type: "email",
        autocomplete: "email",
        inputmode: "email",
      })}
      <button class="account-primary" type="submit">ENVIAR INSTRUCCIONES</button>
      <button class="account-secondary" type="button" data-screen="signin">VOLVER</button>
      <button class="account-guest-button" type="button" data-action="guest">CONTINUAR COMO INVITADO</button>
    </form>
  `;
}

function newPasswordMarkup() {
  return `
    <p class="account-eyebrow">HEADBANG CLOUD // NEW KEY</p>
    <h2 id="account-title">NUEVA CONTRASEÑA</h2>
    <form id="account-form" data-form="new-password" novalidate>
      ${fieldMarkup({
        id: "account-password",
        label: "Nueva contraseña",
        type: "password",
        autocomplete: "new-password",
      })}
      ${passwordRulesMarkup()}
      ${fieldMarkup({
        id: "account-password-confirm",
        label: "Repetir contraseña",
        type: "password",
        autocomplete: "new-password",
      })}
      <button class="account-primary" type="submit">GUARDAR NUEVA CONTRASEÑA</button>
      <button class="account-guest-button" type="button" data-action="guest">CONTINUAR COMO INVITADO</button>
    </form>
  `;
}

const SYNC_STATUS_LABELS = {
  disabled: "SIN CONFIGURAR",
  idle: "SIN CONFIGURAR",
  waiting_for_local: "SIN CONFIGURAR",
  only_local: "SOLO LOCAL",
  only_cloud: "SOLO NUBE",
  pending_choice: "PENDIENTE DE COMBINAR",
  synchronized: "SINCRONIZADA",
  syncing: "SINCRONIZANDO",
  pending: "CAMBIOS PENDIENTES",
  offline: "SIN CONEXIÓN",
  conflict: "CONFLICTO",
  error: "ERROR DE SINCRONIZACIÓN",
};

function formatSyncDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "TODAVÍA NO";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function authenticatedMarkup(maskedEmail, progressReady, syncStatus) {
  const syncEnabled = Boolean(syncStatus?.enabled);
  const statusLabel =
    SYNC_STATUS_LABELS[syncStatus?.phase] ?? "SIN CONFIGURAR";

  return `
    <p class="account-eyebrow">HEADBANG CLOUD // ONLINE</p>
    <h2 id="account-title">CUENTA CONECTADA</h2>
    <div class="account-cloud-state">
      <span class="account-cloud-dot" aria-hidden="true"></span>
      <strong>${progressReady ? "PARTIDA EN LA NUBE ACTIVADA" : "CLOUD PREPARADO"}</strong>
    </div>
    <p class="account-identity">${escapeHtml(maskedEmail)}</p>
    <section class="account-sync-card" aria-labelledby="account-sync-title">
      <p class="account-eyebrow" id="account-sync-title">PARTIDA EN LA NUBE</p>
      ${
        syncEnabled
          ? `
        <strong class="account-sync-status">${statusLabel}</strong>
        <dl class="account-sync-details">
          <div><dt>ÚLTIMA SINCRONIZACIÓN</dt><dd>${formatSyncDate(syncStatus.lastSyncAt)}</dd></div>
          <div><dt>DISPOSITIVO</dt><dd>ESTE DISPOSITIVO</dd></div>
        </dl>
        <button class="account-primary" type="button" data-action="sync-now">SINCRONIZAR AHORA</button>
        <button class="account-secondary" type="button" data-action="manage-sync">GESTIONAR PARTIDAS</button>
      `
          : `
        <strong class="account-sync-status">SINCRONIZACIÓN EN PREPARACIÓN</strong>
        <p class="account-copy">La cuenta funciona con normalidad. El progreso continúa guardándose solo en este dispositivo.</p>
      `
      }
    </section>
    <button class="account-danger" type="button" data-action="signout">CERRAR SESIÓN</button>
    <button class="account-secondary" type="button" data-action="close">VOLVER AL JUEGO</button>
  `;
}

function syncManagementMarkup(preview) {
  const copy = {
    none: "Todavía no existe progreso local ni cloud. La sincronización esperará a que el juego cree una partida.",
    only_local: "Se ha encontrado progreso en este dispositivo.",
    only_cloud: "Se ha encontrado una partida guardada en la nube.",
    both: "Se combinará el progreso de este dispositivo con la partida en la nube. No se perderán niveles, personajes ni objetos desbloqueados.",
  };
  let actions = '<button class="account-secondary" type="button" data-screen="authenticated">VOLVER</button>';

  if (preview.syncCase === "only_local") {
    actions = `
      <button class="account-primary" type="button" data-sync-strategy="local">GUARDAR EN LA NUBE</button>
      <button class="account-secondary" type="button" data-screen="authenticated">MANTENER SOLO EN ESTE DISPOSITIVO, POR AHORA</button>
    `;
  } else if (preview.syncCase === "only_cloud") {
    actions = `
      <button class="account-primary" type="button" data-sync-strategy="cloud">CARGAR PARTIDA</button>
      <button class="account-secondary" type="button" data-screen="authenticated">CONTINUAR SIN CARGARLA</button>
    `;
  } else if (preview.syncCase === "both") {
    actions = `
      <button class="account-primary" type="button" data-sync-strategy="combine">COMBINAR PARTIDAS <small>RECOMENDADO</small></button>
      <button class="account-secondary" type="button" data-sync-confirm="local">USAR PARTIDA DE ESTE DISPOSITIVO</button>
      <button class="account-secondary" type="button" data-sync-confirm="cloud">USAR PARTIDA DE LA NUBE</button>
      <button class="account-guest-button" type="button" data-screen="authenticated">CANCELAR</button>
    `;
  }

  return `
    <p class="account-eyebrow">HEADBANG CLOUD // SAVE CONTROL</p>
    <h2 id="account-title">GESTIONAR PARTIDAS</h2>
    <p class="account-copy account-copy--strong">${copy[preview.syncCase] ?? copy.none}</p>
    ${actions}
  `;
}

function syncConfirmationMarkup(strategy) {
  return `
    <p class="account-eyebrow">HEADBANG CLOUD // CONFIRM</p>
    <h2 id="account-title">CONFIRMAR REEMPLAZO</h2>
    <p class="account-copy account-copy--strong">Esta acción puede sustituir parte del progreso de la otra partida. Se creará una copia de seguridad antes de continuar.</p>
    <button class="account-danger" type="button" data-sync-strategy="${strategy}">CONFIRMAR Y CONTINUAR</button>
    <button class="account-secondary" type="button" data-action="manage-sync">CANCELAR</button>
  `;
}

function unavailableMarkup() {
  return `
    <p class="account-eyebrow">HEADBANG CLOUD // OFFLINE</p>
    <h2 id="account-title">SEÑAL NO DISPONIBLE</h2>
    <p class="account-copy">No se ha podido conectar con la cuenta. Puedes seguir jugando como invitado.</p>
    <button class="account-primary" type="button" data-action="guest">CONTINUAR COMO INVITADO</button>
  `;
}

function createInterface() {
  const menuActions = document.querySelector("#menu-screen .menu-actions");
  if (!menuActions || document.getElementById("account-button")) {
    return;
  }

  const accountButton = document.createElement("button");
  accountButton.id = "account-button";
  accountButton.className = "menu-button account-menu-button";
  accountButton.type = "button";
  accountButton.innerHTML = '<span>CUENTA</span><strong id="account-menu-state">MODO INVITADO</strong>';
  menuActions.append(accountButton);

  const overlay = document.createElement("div");
  overlay.id = "account-overlay";
  overlay.className = "account-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="account-backdrop" data-action="close"></div>
    <section
      id="account-dialog"
      class="account-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-title"
      tabindex="-1"
    >
      <div class="account-scanlines" aria-hidden="true"></div>
      <button class="account-close" type="button" data-action="close" aria-label="Cerrar cuenta">×</button>
      <div id="account-content" class="account-content"></div>
      <p id="account-feedback" class="account-feedback" aria-live="assertive"></p>
      <small class="account-version">CLOUD BRIDGE // ${ACCOUNT_UI_VERSION}</small>
    </section>
  `;
  document.body.append(overlay);

  accountButton.addEventListener("click", async () => {
    const authState = state.cloud?.getAuthState();
    await openModal(authState?.authenticated ? "authenticated" : "signin");
  });
  overlay.addEventListener("click", handleOverlayClick);
  overlay.addEventListener("submit", handleSubmit);
  overlay.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown, true);
}

function setFieldError(fieldId, message = "") {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(`${fieldId}-error`);
  if (field) {
    field.setAttribute("aria-invalid", String(Boolean(message)));
  }
  if (error) {
    error.textContent = message;
  }
}

function setFeedback(message = "", kind = "") {
  const feedback = document.getElementById("account-feedback");
  if (!feedback) {
    return;
  }
  feedback.textContent = message;
  feedback.dataset.kind = kind;
}

function clearSensitiveInputs() {
  for (const input of document.querySelectorAll(
    '#account-overlay input[type="password"]',
  )) {
    input.value = "";
  }
}

function setPending(pending) {
  state.pending = pending;
  const overlay = document.getElementById("account-overlay");
  if (!overlay) {
    return;
  }

  for (const control of overlay.querySelectorAll("button, input")) {
    control.disabled = pending;
  }
  overlay.classList.toggle("is-pending", pending);
}

function registerFailedAttempt() {
  state.failedAttempts += 1;
  if (state.failedAttempts >= 3) {
    state.cooldownUntil = Date.now() + 5000;
    state.failedAttempts = 0;
  }
}

function canRequest() {
  if (state.pending) {
    return false;
  }

  const remainingMs = state.cooldownUntil - Date.now();
  if (remainingMs > 0) {
    setFeedback(
      `Espera ${Math.ceil(remainingMs / 1000)} segundos antes de intentarlo otra vez.`,
      "error",
    );
    return false;
  }

  return true;
}

function updatePasswordRules(value) {
  for (const rule of PASSWORD_RULES) {
    const item = document.querySelector(`[data-rule="${rule.id}"]`);
    if (!item) {
      continue;
    }
    const passed = rule.test(value);
    item.classList.toggle("is-valid", passed);
    const marker = item.querySelector("span");
    if (marker) {
      marker.textContent = passed ? "■" : "□";
    }
  }
}

async function renderScreen(screen, message = "") {
  const content = document.getElementById("account-content");
  if (!content) {
    return;
  }

  state.currentScreen = screen;
  let markup = signinMarkup();

  if (!state.cloud?.isConfigured) {
    markup = unavailableMarkup();
  } else if (screen === "signup") {
    markup = signupMarkup();
  } else if (screen === "confirmation") {
    markup = confirmationMarkup();
  } else if (screen === "reset") {
    markup = resetMarkup();
  } else if (screen === "new-password") {
    markup = newPasswordMarkup();
  } else if (screen === "authenticated") {
    const user = await state.cloud.getCurrentUser().catch(() => null);
    let syncStatus = state.cloud.getSyncStatus?.() ?? {
      enabled: false,
      phase: "disabled",
    };
    if (
      syncStatus.enabled &&
      !syncStatus.firstSyncComplete &&
      !state.syncPreview &&
      !state.refreshingSync &&
      syncStatus.phase === "idle"
    ) {
      state.refreshingSync = true;
      const preview = await state.cloud.previewSync();
      state.refreshingSync = false;
      if (preview.success) {
        state.syncPreview = preview;
      }
      syncStatus = state.cloud.getSyncStatus();
    }
    markup = authenticatedMarkup(
      maskEmail(user?.email),
      state.cloud.getAuthState().progressRowReady,
      syncStatus,
    );
  } else if (screen === "sync-management") {
    const preview = state.syncPreview ?? (await state.cloud.previewSync());
    if (!preview.success) {
      markup = authenticatedMarkup(
        maskEmail((await state.cloud.getCurrentUser().catch(() => null))?.email),
        state.cloud.getAuthState().progressRowReady,
        state.cloud.getSyncStatus(),
      );
      message = preview.message;
    } else {
      state.syncPreview = preview;
      markup = syncManagementMarkup(preview);
    }
  } else if (screen === "sync-confirmation") {
    markup = syncConfirmationMarkup(state.pendingSyncStrategy);
  }

  content.innerHTML = markup;
  setFeedback(message, message ? "success" : "");
  requestAnimationFrame(() => {
    content.querySelector("input, button")?.focus();
  });
}

async function openModal(screen = "signin", message = "") {
  const overlay = document.getElementById("account-overlay");
  if (!overlay) {
    return;
  }

  state.previousFocus = document.activeElement;
  const newsletterGate = document.getElementById("newsletter-gate");
  if (newsletterGate) {
    newsletterGate.dataset.accountPreviousInert = String(newsletterGate.inert);
    newsletterGate.inert = true;
  }
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("account-modal-open");
  await renderScreen(screen, message);
}

function closeModal() {
  if (state.pending) {
    return;
  }

  clearSensitiveInputs();
  const overlay = document.getElementById("account-overlay");
  if (!overlay) {
    return;
  }
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("account-modal-open");
  const newsletterGate = document.getElementById("newsletter-gate");
  if (newsletterGate) {
    newsletterGate.inert =
      newsletterGate.dataset.accountPreviousInert === "true";
    delete newsletterGate.dataset.accountPreviousInert;
  }
  state.previousFocus?.focus?.();
}

async function refreshMenuState() {
  const menuState = document.getElementById("account-menu-state");
  const accountButton = document.getElementById("account-button");
  if (!menuState || !accountButton || !state.cloud) {
    return;
  }

  const authState = state.cloud.getAuthState();
  if (!authState.authenticated) {
    menuState.textContent = "MODO INVITADO";
    accountButton.classList.remove("is-authenticated");
    return;
  }

  const user = await state.cloud.getCurrentUser().catch(() => null);
  menuState.textContent = maskEmail(user?.email);
  accountButton.classList.add("is-authenticated");
}

async function handleOverlayClick(event) {
  const actionTarget = event.target.closest(
    "[data-action], [data-screen], [data-sync-strategy], [data-sync-confirm]",
  );
  if (!actionTarget) {
    return;
  }

  if (actionTarget.dataset.syncStrategy) {
    await performSyncChoice(actionTarget.dataset.syncStrategy);
    return;
  }

  if (actionTarget.dataset.syncConfirm) {
    state.pendingSyncStrategy = actionTarget.dataset.syncConfirm;
    await renderScreen("sync-confirmation");
    return;
  }

  if (actionTarget.dataset.screen) {
    await renderScreen(actionTarget.dataset.screen);
    return;
  }

  const action = actionTarget.dataset.action;
  if (action === "close" || action === "guest") {
    closeModal();
  } else if (action === "legal-pending") {
    event.preventDefault();
    setFeedback(
      "La URL legal de LICAN está pendiente y debe añadirse antes del despliegue público.",
      "warning",
    );
  } else if (action === "signout") {
    await handleSignOut();
  } else if (action === "sync-now") {
    await performSyncNow();
  } else if (action === "manage-sync") {
    await openSyncManagement();
  }
}

async function openSyncManagement() {
  if (!canRequest()) {
    return;
  }
  setPending(true);
  setFeedback("LEYENDO PARTIDAS...", "info");
  const preview = state.syncPreview ?? (await state.cloud.previewSync());
  setPending(false);
  if (!preview.success) {
    setFeedback(preview.message, "error");
    return;
  }
  state.syncPreview = preview;
  await renderScreen("sync-management");
}

async function performSyncNow() {
  if (!canRequest()) {
    return;
  }
  const syncStatus = state.cloud.getSyncStatus();
  if (!syncStatus.firstSyncComplete) {
    await openSyncManagement();
    return;
  }
  await performSyncChoice("combine");
}

async function performSyncChoice(strategy) {
  if (!canRequest()) {
    return;
  }
  setPending(true);
  setFeedback("SINCRONIZANDO PARTIDAS...", "info");
  const syncResult = await state.cloud.syncNow({
    strategy,
    requestReload: true,
  });
  setPending(false);
  if (!syncResult.success) {
    if (syncResult.needsChoice) {
      await openSyncManagement();
      return;
    }
    setFeedback(syncResult.message, "error");
    return;
  }
  state.syncPreview = null;
  state.pendingSyncStrategy = null;
  await renderScreen("authenticated", syncResult.message);
}

function handleInput(event) {
  if (event.target.id === "account-password") {
    updatePasswordRules(event.target.value);
  }
  setFieldError(event.target.id);
}

async function handleSignOut() {
  if (!canRequest()) {
    return;
  }
  setPending(true);
  state.cloud.cancelPendingSync?.();
  const result = await state.cloud.signOut();
  setPending(false);

  if (!result.success) {
    registerFailedAttempt();
    setFeedback(result.message, "error");
    return;
  }

  await refreshMenuState();
  closeModal();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!canRequest()) {
    return;
  }

  const form = event.target;
  const formType = form.dataset.form;
  const email = form.elements["account-email"]?.value ?? "";
  const password = form.elements["account-password"]?.value ?? "";
  const passwordConfirmation =
    form.elements["account-password-confirm"]?.value ?? "";

  if (
    (formType === "signup" || formType === "new-password") &&
    password !== passwordConfirmation
  ) {
    setFieldError(
      "account-password-confirm",
      "Las contraseñas no coinciden.",
    );
    return;
  }

  if (formType === "signup" && !form.elements["account-consent"]?.checked) {
    const consentError = document.getElementById("account-consent-error");
    if (consentError) {
      consentError.textContent =
        "Debes aceptar la política de privacidad y las condiciones de la cuenta.";
    }
    return;
  }

  setPending(true);
  setFeedback("CONECTANDO CON HEADBANG CLOUD...", "info");
  let result;

  if (formType === "signup") {
    result = await state.cloud.signUp(email, password);
  } else if (formType === "signin") {
    result = await state.cloud.signIn(email, password);
  } else if (formType === "reset") {
    result = await state.cloud.sendPasswordReset(email);
  } else if (formType === "new-password") {
    result = await state.cloud.updatePassword(password);
  }

  clearSensitiveInputs();
  setPending(false);

  if (!result?.success) {
    registerFailedAttempt();
    if (result?.errorCode === "invalid_email") {
      setFieldError("account-email", result.message);
    } else if (result?.errorCode === "weak_password") {
      setFieldError("account-password", result.message);
    } else {
      setFeedback(
        result?.message ??
          "No se ha podido conectar con la cuenta. Puedes seguir jugando como invitado.",
        "error",
      );
    }
    return;
  }

  state.failedAttempts = 0;
  await refreshMenuState();

  if (formType === "signup" && result.confirmationRequired) {
    await renderScreen("confirmation");
  } else if (formType === "reset") {
    setFeedback(result.message, "success");
  } else if (formType === "new-password") {
    await renderScreen("authenticated", result.message);
  } else if (formType === "signin") {
    await renderScreen("authenticated", result.message);
  }
}

function handleKeydown(event) {
  const overlay = document.getElementById("account-overlay");
  if (!overlay || overlay.hidden) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusable = [
    ...overlay.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), a[href]:not([aria-disabled="true"])',
    ),
  ].filter((element) => element.offsetParent !== null);

  if (focusable.length === 0) {
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function initializeAccountUi() {
  createInterface();

  if (!window.HeadbangCloud) {
    await new Promise((resolve) => {
      window.addEventListener("headbang-cloud-ready", resolve, { once: true });
      window.setTimeout(resolve, 8000);
    });
  }

  state.cloud = window.HeadbangCloud ?? null;
  if (!state.cloud) {
    await openModal("signin");
    return;
  }

  state.unsubscribe = state.cloud.subscribeAuth(async (authEvent) => {
    await refreshMenuState();
    if (authEvent.event === "PASSWORD_RECOVERY") {
      await openModal("new-password");
    } else if (
      !document.getElementById("account-overlay")?.hidden &&
      state.currentScreen === "authenticated"
    ) {
      await renderScreen(
        authEvent.authenticated ? "authenticated" : "signin",
      );
    }
  });

  window.addEventListener("headbang-cloud-sync-state", async () => {
    if (
      !document.getElementById("account-overlay")?.hidden &&
      state.currentScreen === "authenticated" &&
      !state.pending &&
      !state.refreshingSync
    ) {
      await renderScreen("authenticated");
    }
  });

  await refreshMenuState();

  const authMode = new URLSearchParams(window.location.search).get("auth");
  if (authMode === "recovery") {
    await openModal("new-password");
  } else if (authMode === "confirmed") {
    const authState = state.cloud.getAuthState();
    await openModal(
      authState.authenticated ? "authenticated" : "signin",
      "Correo confirmado. Ya puedes iniciar sesión.",
    );
  }
}

void initializeAccountUi();
