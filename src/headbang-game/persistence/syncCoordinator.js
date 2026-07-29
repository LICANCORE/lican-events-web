import { validateCloudSave, normalizeCloudSave } from './cloudSaveValidator.js';
import { mergeCloudSaves, summarizeCloudSave } from './cloudSaveMerge.js';
import {
  HEADBANG_CLOUD_SAVE_ID,
  createEmptyCloudSave,
  isMeaningfulCloudSave,
} from './cloudSaveSchema.js';
import {
  detectActiveSaveAdapter,
  summarizeDetectedSave,
} from './localSaveDetector.js';
import {
  getRegisteredSaveAdapters,
} from './adapters/saveAdapterRegistry.js';
import {
  applyCanonicalSave,
  consumeReloadMarker,
  createLocalBackup,
} from './localSaveWriter.js';
import {
  createInitialSyncStatus,
  createSyncHistory,
  getOrCreateDeviceId,
  loadPersistedSyncState,
  persistSyncState,
  publicSyncStatus,
} from './syncState.js';

const POLL_INTERVAL_MS = 2500;
const SYNC_DEBOUNCE_MS = 3000;
const MAX_CONFLICT_RETRIES = 2;
const MAX_NETWORK_RETRIES = 3;

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson(value[key])]),
    );
  }
  return value;
}

function canonicalDetectionHash(detection) {
  if (!detection) {
    return null;
  }
  const canonical = normalizeCloudSave(
    detection.adapter.toCanonical(detection.save),
  );
  return hashString(JSON.stringify(stableJson(canonical)));
}

function safeError(error, fallback = 'Error de sincronización.') {
  const message = String(error?.message ?? '').toLowerCase();
  if (
    error?.code === 'revision_conflict' ||
    error?.code === '40001' ||
    message.includes('revision_conflict')
  ) {
    return {
      errorCode: 'revision_conflict',
      message: 'La partida cloud cambió en otro dispositivo.',
    };
  }
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('offline')
  ) {
    return {
      errorCode: 'network_error',
      message: 'Sin conexión. Los cambios permanecen guardados localmente.',
    };
  }
  if (
    message.includes('column') ||
    message.includes('function') ||
    message.includes('schema')
  ) {
    return {
      errorCode: 'schema_not_ready',
      message: 'La migración cloud de la Fase 3 todavía no está aplicada.',
    };
  }
  return { errorCode: error?.code ?? 'sync_failed', message: fallback };
}

function result(success, message, extra = {}) {
  return {
    success,
    message,
    errorCode: success ? null : extra.errorCode ?? 'sync_failed',
    ...extra,
  };
}

export function createSyncCoordinator({
  supabaseClient,
  getSession,
  enabled,
  storage = typeof window === 'undefined' ? null : window.localStorage,
  online = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  reload = () => window.location.reload(),
} = {}) {
  if (!storage) {
    throw new Error('Sync coordinator requires a storage implementation.');
  }

  const history = createSyncHistory();
  const status = loadPersistedSyncState(
    storage,
    createInitialSyncStatus({ enabled, online: online() }),
  );
  status.enabled = Boolean(enabled);
  status.online = online();
  status.phase = !enabled
    ? 'disabled'
    : status.pendingSync
      ? status.online
        ? 'pending'
        : 'offline'
      : status.firstSyncComplete
        ? 'synchronized'
        : 'idle';

  let activeDetection = null;
  let syncPromise = null;
  let pollTimer = null;
  let debounceTimer = null;
  let retryTimer = null;
  let retries = 0;
  let lastLocalHash = null;
  const deviceId = getOrCreateDeviceId(storage);

  function updateStatus(patch, { persist = true } = {}) {
    Object.assign(status, patch);
    if (persist) {
      persistSyncState(storage, status);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('headbang-cloud-sync-state', {
          detail: publicSyncStatus(status),
        }),
      );
    }
  }

  async function authenticatedUser() {
    const session = await getSession();
    const user = session?.user ?? null;
    updateStatus({ authenticated: Boolean(user) }, { persist: false });
    return user;
  }

  function detectLocalSave() {
    activeDetection = detectActiveSaveAdapter(storage);
    const summary = summarizeDetectedSave(activeDetection);
    updateStatus({
      adapterId: summary.adapterId,
      localSaveDetected: summary.localSaveDetected,
      localRevision: canonicalDetectionHash(activeDetection),
    });
    return summary;
  }

  function getActiveSaveAdapter() {
    if (!activeDetection) {
      detectLocalSave();
    }
    if (!activeDetection) {
      return null;
    }
    return {
      id: activeDetection.adapter.id,
      localStorageKeys: [...activeDetection.adapter.localStorageKeys],
      priority: activeDetection.adapter.priority,
      localStorageKey: activeDetection.localStorageKey,
      gameBuildVersion: activeDetection.gameBuildVersion,
      valid: activeDetection.validation.valid,
    };
  }

  function localCanonical() {
    if (!activeDetection) {
      detectLocalSave();
    }
    if (!activeDetection) {
      return null;
    }
    const converted = activeDetection.adapter.toCanonical(activeDetection.save);
    const validation = validateCloudSave(converted);
    if (!validation.valid) {
      const error = new Error(validation.message);
      error.code = validation.errorCode;
      throw error;
    }
    return validation.value;
  }

  async function getCloudSave() {
    if (!enabled) {
      return result(false, 'Sincronización en preparación.', {
        errorCode: 'sync_disabled',
        cloudSave: null,
      });
    }
    const user = await authenticatedUser();
    if (!user) {
      return result(false, 'Inicia sesión para consultar la partida cloud.', {
        errorCode: 'not_authenticated',
        cloudSave: null,
      });
    }

    try {
      const { data, error } = await supabaseClient
        .from('game_progress')
        .select(
          'cloud_save,cloud_schema_version,game_build_version,local_save_format,last_device_id,last_synced_at,sync_revision',
        )
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        throw error;
      }

      const cloudSave = isMeaningfulCloudSave(data?.cloud_save)
        ? normalizeCloudSave(data.cloud_save)
        : null;
      updateStatus({
        cloudSaveDetected: Boolean(cloudSave),
        cloudRevision: Number(data?.sync_revision) || 0,
        lastSyncAt: data?.last_synced_at ?? status.lastSyncAt,
        error: null,
      });
      return result(true, 'Partida cloud consultada.', {
        cloudSave,
        revision: Number(data?.sync_revision) || 0,
        lastSyncedAt: data?.last_synced_at ?? null,
        source: data
          ? {
              gameBuildVersion: data.game_build_version ?? null,
              localSaveFormat: data.local_save_format ?? null,
            }
          : null,
      });
    } catch (error) {
      const safe = safeError(error, 'No se pudo leer la partida cloud.');
      updateStatus({ phase: 'error', error: safe.message });
      return result(false, safe.message, {
        errorCode: safe.errorCode,
        cloudSave: null,
      });
    }
  }

  async function previewSync() {
    if (!enabled) {
      return result(false, 'Sincronización en preparación.', {
        errorCode: 'sync_disabled',
        syncCase: 'disabled',
      });
    }

    const detection = detectLocalSave();
    const cloudResult = await getCloudSave();
    if (!cloudResult.success) {
      return cloudResult;
    }

    const localSave = detection.localSaveDetected ? localCanonical() : null;
    const cloudSave = cloudResult.cloudSave;
    let syncCase = 'none';
    if (localSave && cloudSave) {
      syncCase = 'both';
    } else if (localSave) {
      syncCase = 'only_local';
    } else if (cloudSave) {
      syncCase = 'only_cloud';
    }

    const merged =
      localSave && cloudSave ? mergeCloudSaves(localSave, cloudSave) : null;
    const phaseByCase = {
      none: 'waiting_for_local',
      only_local: 'only_local',
      only_cloud: 'only_cloud',
      both: 'pending_choice',
    };
    updateStatus({
      phase: phaseByCase[syncCase],
      conflict: syncCase === 'both',
      error: null,
    });

    return result(true, 'Previsualización preparada.', {
      syncCase,
      recommended: syncCase === 'both' ? 'combine' : null,
      localSummary: localSave ? summarizeCloudSave(localSave) : null,
      cloudSummary: cloudSave ? summarizeCloudSave(cloudSave) : null,
      mergedSummary: merged ? summarizeCloudSave(merged) : null,
      localSave,
      cloudSave,
      mergedSave: merged,
      cloudRevision: cloudResult.revision,
    });
  }

  function withIdentity(save, user) {
    const now = new Date().toISOString();
    const normalized = normalizeCloudSave(save);
    normalized.identity = {
      saveId: normalized.identity.saveId || crypto.randomUUID(),
      userId: user.id,
      createdAt: normalized.identity.createdAt || now,
      updatedAt: now,
    };
    return normalized;
  }

  async function upload(save, expectedRevision, user) {
    const canonical = withIdentity(save, user);
    const validation = validateCloudSave(canonical);
    if (!validation.valid) {
      return result(false, validation.message, {
        errorCode: validation.errorCode,
      });
    }

    const { data, error } = await supabaseClient.rpc(
      'sync_headbang_cloud_save',
      {
        p_expected_revision: expectedRevision,
        p_cloud_save: validation.value,
        p_cloud_schema_version: validation.value.cloudSchemaVersion,
        p_game_build_version:
          activeDetection?.gameBuildVersion ??
          validation.value.source.gameBuildVersion,
        p_local_save_format:
          activeDetection?.localStorageKey ??
          validation.value.source.localSaveFormat,
        p_last_device_id: deviceId,
      },
    );
    if (error) {
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return result(true, 'Partida guardada en la nube.', {
      cloudSave: validation.value,
      revision: Number(row?.sync_revision) || expectedRevision + 1,
      lastSyncedAt: row?.last_synced_at ?? new Date().toISOString(),
    });
  }

  function applyCloudSave(
    cloudSave,
    { revision = status.cloudRevision, requestReload = true } = {},
  ) {
    if (!activeDetection) {
      detectLocalSave();
    }
    if (!activeDetection) {
      const adapter = getRegisteredSaveAdapters()[0] ?? null;
      if (adapter) {
        activeDetection = {
          adapter,
          adapterId: adapter.id,
          save: {},
          localStorageKey: adapter.localStorageKeys[0],
          gameBuildVersion:
            adapter.localStorageKeys[0]?.match(/v(\d+)$/u)?.[1]
              ? `V${adapter.localStorageKeys[0].match(/v(\d+)$/u)[1]}`
              : null,
          validation: { valid: true },
        };
      }
    }
    if (!activeDetection) {
      return result(false, 'No existe un formato local activo al que aplicar.', {
        errorCode: 'missing_adapter',
      });
    }
    const validation = validateCloudSave(cloudSave);
    if (!validation.valid) {
      return result(false, validation.message, {
        errorCode: validation.errorCode,
      });
    }
    const application = applyCanonicalSave({
      adapter: activeDetection.adapter,
      cloudSave: validation.value,
      currentLocalSave: activeDetection.save,
      localStorageKey: activeDetection.localStorageKey,
      storage,
      revision,
      createBackup: true,
      requestReload,
    });
    if (application.success) {
      activeDetection = detectActiveSaveAdapter(storage);
      lastLocalHash = canonicalDetectionHash(activeDetection);
      status.localRevision = lastLocalHash;
    }
    return application;
  }

  async function mergeLocalAndCloud(localSave, cloudSave) {
    const local = localSave ?? localCanonical();
    const remote =
      cloudSave ?? (await getCloudSave()).cloudSave ?? createEmptyCloudSave();
    return mergeCloudSaves(local ?? createEmptyCloudSave(), remote);
  }

  async function performSync({ strategy, requestReload, automatic }) {
    if (!online()) {
      updateStatus({
        phase: 'offline',
        online: false,
        pendingSync: true,
        error: null,
      });
      return result(false, 'Sin conexión. Los cambios permanecen localmente.', {
        errorCode: 'offline',
      });
    }

    const user = await authenticatedUser();
    if (!user) {
      return result(false, 'Inicia sesión para sincronizar.', {
        errorCode: 'not_authenticated',
      });
    }

    let preview = await previewSync();
    if (!preview.success) {
      return preview;
    }
    if (!status.firstSyncComplete && automatic) {
      return result(false, 'Elige cómo gestionar la primera sincronización.', {
        errorCode: 'sync_choice_required',
        needsChoice: true,
        syncCase: preview.syncCase,
      });
    }
    if (
      preview.syncCase === 'both' &&
      !strategy &&
      !status.firstSyncComplete
    ) {
      return result(false, 'Elige cómo combinar las partidas.', {
        errorCode: 'sync_choice_required',
        needsChoice: true,
        syncCase: preview.syncCase,
      });
    }
    if (preview.syncCase === 'none') {
      updateStatus({ phase: 'waiting_for_local', pendingSync: false });
      return result(true, 'La sincronización esperará al primer progreso local.', {
        waitingForLocal: true,
      });
    }

    const selectedStrategy =
      strategy ??
      (preview.syncCase === 'only_cloud'
        ? 'cloud'
        : preview.syncCase === 'both'
          ? 'combine'
          : 'local');
    let target =
      selectedStrategy === 'cloud'
        ? preview.cloudSave
        : selectedStrategy === 'local'
          ? preview.localSave
          : preview.mergedSave;
    let revision = preview.cloudRevision;
    let uploadResult = null;

    if (selectedStrategy === 'local' && activeDetection) {
      createLocalBackup(storage, activeDetection.localStorageKey);
    }

    if (selectedStrategy !== 'cloud') {
      for (
        let conflictAttempt = 0;
        conflictAttempt <= MAX_CONFLICT_RETRIES;
        conflictAttempt += 1
      ) {
        try {
          uploadResult = await upload(target, revision, user);
          break;
        } catch (error) {
          const safe = safeError(error);
          if (
            safe.errorCode !== 'revision_conflict' ||
            conflictAttempt === MAX_CONFLICT_RETRIES
          ) {
            throw error;
          }
          const fresh = await getCloudSave();
          if (!fresh.success) {
            return fresh;
          }
          revision = fresh.revision;
          target = mergeCloudSaves(target, fresh.cloudSave);
          updateStatus({ conflict: true, phase: 'conflict' });
        }
      }
    }

    const finalSave = uploadResult?.cloudSave ?? target;
    const finalRevision = uploadResult?.revision ?? revision;
    let application = null;
    if (selectedStrategy !== 'local') {
      application = applyCloudSave(finalSave, {
        revision: finalRevision,
        requestReload,
      });
      if (!application.success) {
        return application;
      }
    }

    const syncedAt =
      uploadResult?.lastSyncedAt ??
      preview.cloudSave?.identity?.updatedAt ??
      new Date().toISOString();
    updateStatus({
      phase: 'synchronized',
      pendingSync: false,
      firstSyncComplete: true,
      lastSyncAt: syncedAt,
      cloudRevision: finalRevision,
      conflict: false,
      error: null,
      online: true,
    });
    activeDetection = detectActiveSaveAdapter(storage);
    lastLocalHash = canonicalDetectionHash(activeDetection);
    updateStatus({ localRevision: lastLocalHash });
    history.add({
      action: selectedStrategy,
      success: true,
      revision: finalRevision,
    });
    retries = 0;

    if (application?.reloadRequired && requestReload) {
      window.setTimeout(reload, 50);
    }
    return result(true, 'Partida sincronizada.', {
      strategy: selectedStrategy,
      revision: finalRevision,
      reloadRequired: Boolean(application?.reloadRequired),
    });
  }

  async function syncNow({
    strategy = null,
    requestReload = true,
    automatic = false,
  } = {}) {
    if (!enabled) {
      return result(false, 'Sincronización en preparación.', {
        errorCode: 'sync_disabled',
      });
    }
    if (syncPromise) {
      return syncPromise;
    }
    updateStatus({ phase: 'syncing', error: null, online: online() });
    syncPromise = performSync({ strategy, requestReload, automatic })
      .catch((error) => {
        const safe = safeError(error);
        const networkFailure = safe.errorCode === 'network_error';
        updateStatus({
          phase: networkFailure ? 'offline' : 'error',
          pendingSync: true,
          conflict: safe.errorCode === 'revision_conflict',
          error: safe.message,
          online: online(),
        });
        history.add({
          action: strategy ?? 'combine',
          success: false,
          errorCode: safe.errorCode,
        });
        if (networkFailure) {
          scheduleRetry();
        }
        return result(false, safe.message, { errorCode: safe.errorCode });
      })
      .finally(() => {
        syncPromise = null;
      });
    return syncPromise;
  }

  function scheduleRetry() {
    if (
      retryTimer ||
      retries >= MAX_NETWORK_RETRIES ||
      !status.pendingSync ||
      !online()
    ) {
      return;
    }
    const delay = 1000 * 2 ** retries;
    retries += 1;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      void syncNow({ automatic: true, requestReload: false });
    }, delay);
  }

  function markLocalChange() {
    updateStatus({
      phase: online() ? 'pending' : 'offline',
      pendingSync: true,
      online: online(),
    });
    if (
      !status.firstSyncComplete ||
      !status.authenticated ||
      !online() ||
      debounceTimer
    ) {
      return;
    }
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void syncNow({ automatic: true, requestReload: false });
    }, SYNC_DEBOUNCE_MS);
  }

  function inspectLocalChange() {
    const detection = detectActiveSaveAdapter(storage);
    const hash = canonicalDetectionHash(detection);
    if (lastLocalHash !== null && hash !== lastLocalHash) {
      activeDetection = detection;
      markLocalChange();
    }
    lastLocalHash = hash;
  }

  function handleOnline() {
    updateStatus({ online: true, phase: status.pendingSync ? 'pending' : status.phase });
    if (status.pendingSync && status.firstSyncComplete) {
      retries = 0;
      scheduleRetry();
    }
  }

  function handleOffline() {
    updateStatus({ online: false, phase: 'offline' });
  }

  function handleVisibility() {
    if (document.visibilityState === 'hidden') {
      inspectLocalChange();
    }
  }

  function start() {
    consumeReloadMarker(storage);
    detectLocalSave();
    lastLocalHash = canonicalDetectionHash(activeDetection);
    if (!enabled || typeof window === 'undefined') {
      return;
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    pollTimer = window.setInterval(inspectLocalChange, POLL_INTERVAL_MS);
  }

  function cancelPendingSync() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (retryTimer) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
    retries = 0;
    updateStatus({ pendingSync: false, conflict: false, error: null });
    return result(true, 'Sincronización pendiente cancelada.');
  }

  function destroy() {
    cancelPendingSync();
    if (pollTimer) {
      window.clearInterval(pollTimer);
    }
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibility);
  }

  return {
    id: HEADBANG_CLOUD_SAVE_ID,
    start,
    destroy,
    detectLocalSave,
    getActiveSaveAdapter,
    getCloudSave,
    previewSync,
    syncNow,
    applyCloudSave,
    mergeLocalAndCloud,
    getSyncStatus: () => publicSyncStatus(status),
    getSyncHistory: () => history.get(),
    cancelPendingSync,
    markAuthenticated(authenticated) {
      updateStatus({ authenticated: Boolean(authenticated) }, { persist: false });
    },
  };
}
