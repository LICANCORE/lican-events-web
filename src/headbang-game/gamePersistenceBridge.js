import {
  isSupabaseConfigured,
  supabaseClient,
  supabaseConfigurationError,
} from './supabaseClient.js';
import { readLocalGameSave } from './gameSaveSchema.js';
import { createSyncCoordinator } from './persistence/syncCoordinator.js';

const BRIDGE_VERSION = '3.0.1';
const CLOUD_SYNC_ENABLED =
  import.meta.env.VITE_HEADBANG_CLOUD_SYNC_ENABLED === 'true';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const AUTH_EVENTS_WITH_SESSION = new Set([
  'INITIAL_SESSION',
  'SIGNED_IN',
  'TOKEN_REFRESHED',
  'USER_UPDATED',
  'PASSWORD_RECOVERY',
]);
const PASSWORD_REQUIREMENTS = Object.freeze({
  minimumLength: 10,
  uppercase: /[A-Z]/u,
  lowercase: /[a-z]/u,
  number: /\d/u,
  symbol: /[^A-Za-z0-9]/u,
});

const authCallbacks = new Set();
let authSubscription = null;
let progressRowPromise = null;
let syncCoordinator = null;

const bridgeStatus = {
  ready: false,
  configured: isSupabaseConfigured,
  authenticated: false,
  userId: null,
  recoveryMode: false,
  localSaveFound: false,
  progressRowReady: false,
  error: supabaseConfigurationError,
  lastAuthEvent: null,
  lastTestedAt: null,
};

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function validateEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || normalizedEmail.length > 254) {
    return null;
  }

  return EMAIL_PATTERN.test(normalizedEmail) ? normalizedEmail : null;
}

function getMissingPasswordRequirements(password) {
  const value = String(password ?? '');
  const missing = [];

  if (value.length < PASSWORD_REQUIREMENTS.minimumLength) {
    missing.push('minimum_length');
  }
  if (!PASSWORD_REQUIREMENTS.uppercase.test(value)) {
    missing.push('uppercase');
  }
  if (!PASSWORD_REQUIREMENTS.lowercase.test(value)) {
    missing.push('lowercase');
  }
  if (!PASSWORD_REQUIREMENTS.number.test(value)) {
    missing.push('number');
  }
  if (!PASSWORD_REQUIREMENTS.symbol.test(value)) {
    missing.push('symbol');
  }

  return missing;
}

function getPasswordValidationMessage(missingRequirements) {
  const labels = {
    minimum_length: '10 caracteres',
    uppercase: 'una mayúscula',
    lowercase: 'una minúscula',
    number: 'un número',
    symbol: 'un símbolo',
  };

  return `La contraseña necesita: ${missingRequirements
    .map((requirement) => labels[requirement])
    .join(', ')}.`;
}

function getConfirmationUrl(mode) {
  const url = new URL('/headbangdealers_the_game/', window.location.origin);
  url.searchParams.set('auth', mode);
  return url.toString();
}

function getSafeError(error, context = 'generic') {
  const message = String(error?.message ?? '').toLowerCase();
  const status = Number(error?.status ?? 0);

  if (status === 429 || message.includes('rate limit')) {
    return {
      errorCode: 'too_many_requests',
      message: 'Demasiados intentos. Espera un momento antes de continuar.',
    };
  }

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return {
      errorCode: 'invalid_credentials',
      message: 'No se ha podido iniciar sesión con esos datos.',
    };
  }

  if (message.includes('email not confirmed')) {
    return {
      errorCode: 'email_not_confirmed',
      message: 'Confirma tu correo antes de iniciar sesión.',
    };
  }

  if (message.includes('already registered') || message.includes('already exists')) {
    return {
      errorCode: 'signup_pending',
      message:
        'Si la dirección puede registrarse, recibirás un correo de confirmación.',
    };
  }

  if (message.includes('password') && message.includes('weak')) {
    return {
      errorCode: 'weak_password',
      message: 'La contraseña no cumple los requisitos de seguridad.',
    };
  }

  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('offline')
  ) {
    return {
      errorCode: 'network_error',
      message:
        'No se ha podido conectar con la cuenta. Puedes seguir jugando como invitado.',
    };
  }

  const fallbackMessages = {
    signup:
      'No se ha podido crear la cuenta. Revisa los datos o inténtalo más tarde.',
    signin:
      'No se ha podido iniciar sesión. Revisa los datos o inténtalo más tarde.',
    signout:
      'No se ha podido cerrar la sesión correctamente. Inténtalo de nuevo.',
    recovery:
      'No se han podido enviar las instrucciones. Inténtalo más tarde.',
    password:
      'No se ha podido actualizar la contraseña. Solicita un nuevo enlace.',
    progress:
      'La cuenta está conectada, pero no se pudo preparar el progreso cloud.',
    generic:
      'No se ha podido conectar con la cuenta. Puedes seguir jugando como invitado.',
  };

  return {
    errorCode: 'request_failed',
    message: fallbackMessages[context] ?? fallbackMessages.generic,
  };
}

function successResult({
  authenticated = bridgeStatus.authenticated,
  userId = bridgeStatus.userId,
  message,
  extra = {},
}) {
  return {
    success: true,
    authenticated,
    userId,
    message,
    errorCode: null,
    ...extra,
  };
}

function failureResult(errorCode, message, extra = {}) {
  return {
    success: false,
    authenticated: bridgeStatus.authenticated,
    userId: bridgeStatus.userId,
    message,
    errorCode,
    // V019's access gate still consumes the legacy nested error shape, while
    // account-ui.js uses the top-level fields. Keep both until the game bundle
    // can be rebuilt from source.
    error: {
      code: errorCode,
      message,
    },
    ...extra,
  };
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
  };
}

function sanitizeSession(session) {
  if (!session?.user) {
    return null;
  }

  return {
    authenticated: true,
    userId: session.user.id,
    expiresAt: session.expires_at ?? null,
    user: sanitizeUser(session.user),
  };
}

async function getRawSession() {
  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session ?? null;
}

async function getSession() {
  return sanitizeSession(await getRawSession());
}

async function getCurrentUser() {
  const session = await getRawSession();
  return sanitizeUser(session?.user);
}

syncCoordinator = createSyncCoordinator({
  supabaseClient,
  getSession: getRawSession,
  enabled: CLOUD_SYNC_ENABLED && Boolean(supabaseClient),
});

function readLocalSave() {
  return readLocalGameSave();
}

function getAuthState() {
  return {
    configured: bridgeStatus.configured,
    ready: bridgeStatus.ready,
    authenticated: bridgeStatus.authenticated,
    userId: bridgeStatus.userId,
    recoveryMode: bridgeStatus.recoveryMode,
    progressRowReady: bridgeStatus.progressRowReady,
    lastAuthEvent: bridgeStatus.lastAuthEvent,
    error: bridgeStatus.error,
  };
}

function emitAuthChange(event, session) {
  const detail = {
    authenticated: Boolean(session?.user),
    userId: session?.user?.id ?? null,
    event,
  };

  window.dispatchEvent(
    new CustomEvent('headbang-auth-changed', {
      detail,
    }),
  );

  for (const callback of authCallbacks) {
    try {
      callback({ ...detail });
    } catch {
      // A consumer callback must never break authentication state tracking.
    }
  }
}

function updateAuthStatus(event, session) {
  Object.assign(bridgeStatus, {
    authenticated: Boolean(session?.user),
    userId: session?.user?.id ?? null,
    recoveryMode:
      event === 'PASSWORD_RECOVERY' ||
      (bridgeStatus.recoveryMode && event !== 'SIGNED_OUT'),
    error: null,
    lastAuthEvent: event,
  });

  if (!session?.user) {
    bridgeStatus.progressRowReady = false;
  }

  syncCoordinator.markAuthenticated(Boolean(session?.user));
  emitAuthChange(event, session);
}

function subscribeAuth(callback) {
  if (typeof callback === 'function') {
    authCallbacks.add(callback);
  }

  return () => unsubscribeAuth(callback);
}

function unsubscribeAuth(callback) {
  if (typeof callback === 'function') {
    authCallbacks.delete(callback);
    return;
  }

  authCallbacks.clear();
}

async function ensureProgressRow() {
  if (!supabaseClient) {
    return failureResult(
      'not_configured',
      'La cuenta cloud no está configurada. Puedes seguir jugando como invitado.',
    );
  }

  if (progressRowPromise) {
    return progressRowPromise;
  }

  progressRowPromise = (async () => {
    try {
      const session = await getRawSession();
      const user = session?.user;

      if (!user) {
        return failureResult(
          'not_authenticated',
          'Inicia sesión para preparar la partida cloud.',
        );
      }

      const { error } = await supabaseClient
        .from('game_progress')
        .upsert(
          { user_id: user.id },
          { onConflict: 'user_id', ignoreDuplicates: true },
        );

      if (error) {
        const safeError = getSafeError(error, 'progress');
        bridgeStatus.error = safeError.message;
        bridgeStatus.progressRowReady = false;
        return failureResult(safeError.errorCode, safeError.message);
      }

      bridgeStatus.progressRowReady = true;
      bridgeStatus.error = null;

      return successResult({
        authenticated: true,
        userId: user.id,
        message: 'Partida cloud preparada.',
      });
    } catch (error) {
      const safeError = getSafeError(error, 'progress');
      bridgeStatus.error = safeError.message;
      bridgeStatus.progressRowReady = false;
      return failureResult(safeError.errorCode, safeError.message);
    } finally {
      progressRowPromise = null;
    }
  })();

  return progressRowPromise;
}

async function signUp(email, password) {
  const normalizedEmail = validateEmail(email);

  if (!normalizedEmail) {
    return failureResult(
      'invalid_email',
      'Introduce una dirección de correo válida.',
    );
  }

  const missingRequirements = getMissingPasswordRequirements(password);

  if (missingRequirements.length > 0) {
    return failureResult(
      'weak_password',
      getPasswordValidationMessage(missingRequirements),
      { missingRequirements },
    );
  }

  if (!supabaseClient) {
    return failureResult(
      'not_configured',
      'La cuenta cloud no está configurada. Puedes seguir jugando como invitado.',
    );
  }

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getConfirmationUrl('confirmed'),
      },
    });

    if (error) {
      const safeError = getSafeError(error, 'signup');
      return failureResult(safeError.errorCode, safeError.message);
    }

    if (data.session?.user) {
      const progressResult = await ensureProgressRow();
      return successResult({
        authenticated: true,
        userId: data.session.user.id,
        message: 'Cuenta creada e iniciada.',
        extra: { progressReady: progressResult.success },
      });
    }

    return successResult({
      authenticated: false,
      userId: data.user?.id ?? null,
      message: 'Revisa tu correo para confirmar la cuenta.',
      extra: { confirmationRequired: true },
    });
  } catch (error) {
    const safeError = getSafeError(error, 'signup');
    return failureResult(safeError.errorCode, safeError.message);
  }
}

async function signIn(email, password) {
  const normalizedEmail = validateEmail(email);

  if (!normalizedEmail || !String(password ?? '')) {
    return failureResult(
      'invalid_credentials',
      'Introduce un correo y una contraseña válidos.',
    );
  }

  if (!supabaseClient) {
    return failureResult(
      'not_configured',
      'La cuenta cloud no está configurada. Puedes seguir jugando como invitado.',
    );
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.session?.user) {
      const safeError = getSafeError(error, 'signin');
      return failureResult(safeError.errorCode, safeError.message);
    }

    const progressResult = await ensureProgressRow();

    return successResult({
      authenticated: true,
      userId: data.session.user.id,
      message: progressResult.success
        ? 'Sesión iniciada. Partida cloud preparada.'
        : 'Sesión iniciada. El progreso cloud se preparará más tarde.',
      extra: { progressReady: progressResult.success },
    });
  } catch (error) {
    const safeError = getSafeError(error, 'signin');
    return failureResult(safeError.errorCode, safeError.message);
  }
}

async function signOut() {
  if (!supabaseClient) {
    return failureResult(
      'not_configured',
      'La cuenta cloud no está configurada.',
    );
  }

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      const safeError = getSafeError(error, 'signout');
      return failureResult(safeError.errorCode, safeError.message);
    }

    Object.assign(bridgeStatus, {
      authenticated: false,
      userId: null,
      recoveryMode: false,
      progressRowReady: false,
      error: null,
    });

    return successResult({
      authenticated: false,
      userId: null,
      message: 'Sesión cerrada. Continúas en modo invitado.',
    });
  } catch (error) {
    const safeError = getSafeError(error, 'signout');
    return failureResult(safeError.errorCode, safeError.message);
  }
}

async function sendPasswordReset(email) {
  const normalizedEmail = validateEmail(email);

  if (!normalizedEmail) {
    return failureResult(
      'invalid_email',
      'Introduce una dirección de correo válida.',
    );
  }

  if (!supabaseClient) {
    return failureResult(
      'not_configured',
      'La cuenta cloud no está configurada. Puedes seguir jugando como invitado.',
    );
  }

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: getConfirmationUrl('recovery'),
      },
    );

    if (error) {
      const safeError = getSafeError(error, 'recovery');
      return failureResult(safeError.errorCode, safeError.message);
    }

    return successResult({
      authenticated: false,
      userId: null,
      message:
        'Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer la contraseña.',
    });
  } catch (error) {
    const safeError = getSafeError(error, 'recovery');
    return failureResult(safeError.errorCode, safeError.message);
  }
}

function clearAuthModeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('auth');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

async function updatePassword(newPassword) {
  const missingRequirements = getMissingPasswordRequirements(newPassword);

  if (missingRequirements.length > 0) {
    return failureResult(
      'weak_password',
      getPasswordValidationMessage(missingRequirements),
      { missingRequirements },
    );
  }

  if (!supabaseClient) {
    return failureResult(
      'not_configured',
      'La cuenta cloud no está configurada.',
    );
  }

  try {
    const { data, error } = await supabaseClient.auth.updateUser({
      password: newPassword,
    });

    if (error || !data.user) {
      const safeError = getSafeError(error, 'password');
      return failureResult(safeError.errorCode, safeError.message);
    }

    bridgeStatus.recoveryMode = false;
    clearAuthModeFromUrl();
    const progressResult = await ensureProgressRow();

    return successResult({
      authenticated: true,
      userId: data.user.id,
      message: 'Contraseña actualizada correctamente.',
      extra: { progressReady: progressResult.success },
    });
  } catch (error) {
    const safeError = getSafeError(error, 'password');
    return failureResult(safeError.errorCode, safeError.message);
  }
}

async function testConnection() {
  const localSaveFound = readLocalSave() !== null;
  let session = null;
  let error = supabaseConfigurationError;

  if (supabaseClient) {
    try {
      session = await getRawSession();
      error = null;
    } catch (sessionError) {
      error = getSafeError(sessionError).message;
    }
  }

  const result = {
    configured: isSupabaseConfigured,
    authenticated: Boolean(session?.user),
    userId: session?.user?.id ?? null,
    localSaveFound,
    error,
  };

  Object.assign(bridgeStatus, result, {
    lastTestedAt: new Date().toISOString(),
  });

  return result;
}

async function getScoreTop10() {
  if (!supabaseClient) {
    return {
      success: false,
      scores: [],
      message: 'La clasificación no está disponible en este momento.',
      errorCode: 'not_configured',
    };
  }

  try {
    const { data, error } = await supabaseClient
      .from('score_top_10')
      .select(
        'ranking_position,player_name,score,level_id,game_build_version,submitted_at',
      )
      .order('score', { ascending: false })
      .order('submitted_at', { ascending: true })
      .limit(10);

    if (error) {
      throw error;
    }

    const scores = (Array.isArray(data) ? data : [])
      .slice(0, 10)
      .map((entry, index) => ({
        ranking_position: Math.max(
          1,
          Math.min(10, Math.floor(Number(entry.ranking_position) || index + 1)),
        ),
        player_name: String(entry.player_name ?? 'ANÓNIMO').slice(0, 32),
        score: Math.max(
          0,
          Math.min(
            Number.MAX_SAFE_INTEGER,
            Math.floor(Number(entry.score) || 0),
          ),
        ),
        level_id: String(entry.level_id ?? '').slice(0, 128),
        game_build_version:
          entry.game_build_version === null
            ? null
            : String(entry.game_build_version ?? '').slice(0, 32),
        submitted_at:
          typeof entry.submitted_at === 'string' &&
          Number.isFinite(Date.parse(entry.submitted_at))
            ? new Date(entry.submitted_at).toISOString()
            : null,
      }));

    return {
      success: true,
      scores,
      message: scores.length
        ? 'Clasificación actualizada.'
        : 'Todavía no hay puntuaciones verificadas.',
      errorCode: null,
    };
  } catch {
    return {
      success: false,
      scores: [],
      message: 'No se ha podido cargar la clasificación.',
      errorCode: 'leaderboard_unavailable',
    };
  }
}

function startAuthSubscription() {
  if (!supabaseClient || authSubscription) {
    return;
  }

  const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
    updateAuthStatus(event, session);

    if (AUTH_EVENTS_WITH_SESSION.has(event) && session?.user) {
      window.setTimeout(() => {
        void ensureProgressRow();
      }, 0);
    }
  });

  authSubscription = data.subscription;
}

const HeadbangCloud = Object.freeze({
  version: BRIDGE_VERSION,
  isConfigured: isSupabaseConfigured,
  getSession,
  getCurrentUser,
  readLocalSave,
  testConnection,
  signUp,
  signIn,
  signOut,
  sendPasswordReset,
  updatePassword,
  ensureProgressRow,
  detectLocalSave: () => syncCoordinator.detectLocalSave(),
  getActiveSaveAdapter: () => syncCoordinator.getActiveSaveAdapter(),
  getCloudSave: () => syncCoordinator.getCloudSave(),
  previewSync: () => syncCoordinator.previewSync(),
  syncNow: (options) => syncCoordinator.syncNow(options),
  applyCloudSave: (cloudSave, options) =>
    syncCoordinator.applyCloudSave(cloudSave, options),
  mergeLocalAndCloud: (localSave, cloudSave) =>
    syncCoordinator.mergeLocalAndCloud(localSave, cloudSave),
  getSyncStatus: () => syncCoordinator.getSyncStatus(),
  getSyncHistory: () => syncCoordinator.getSyncHistory(),
  cancelPendingSync: () => syncCoordinator.cancelPendingSync(),
  getScoreTop10,
  getAuthState,
  subscribeAuth,
  unsubscribeAuth,
  get status() {
    return { ...bridgeStatus };
  },
});

window.HeadbangCloud = HeadbangCloud;

async function initializeBridge() {
  syncCoordinator.start();
  startAuthSubscription();

  try {
    const session = await getRawSession();
    Object.assign(bridgeStatus, {
      authenticated: Boolean(session?.user),
      userId: session?.user?.id ?? null,
      recoveryMode:
        new URLSearchParams(window.location.search).get('auth') === 'recovery',
      error: null,
    });
    syncCoordinator.markAuthenticated(Boolean(session?.user));
  } catch (sessionError) {
    bridgeStatus.error = getSafeError(sessionError).message;
  }

  bridgeStatus.ready = true;

  window.dispatchEvent(
    new CustomEvent('headbang-cloud-ready', {
      detail: { version: BRIDGE_VERSION },
    }),
  );
}

void initializeBridge();
