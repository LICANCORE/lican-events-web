import {
  HEADBANG_BACKUP_PREFIX,
  HEADBANG_MAX_LOCAL_BACKUPS,
  HEADBANG_RELOAD_PENDING_KEY,
} from './cloudSaveSchema.js';

function backupKey(now = new Date()) {
  return `${HEADBANG_BACKUP_PREFIX}${now.toISOString().replace(/[:.]/gu, '-')}`;
}

export function listLocalBackups(storage = window.localStorage) {
  const backups = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(HEADBANG_BACKUP_PREFIX)) {
      backups.push(key);
    }
  }
  return backups.sort().reverse();
}

export function createLocalBackup(
  storage,
  localStorageKey,
  { now = new Date(), maximum = HEADBANG_MAX_LOCAL_BACKUPS } = {},
) {
  const current = storage.getItem(localStorageKey);
  if (current === null) {
    return null;
  }

  const key = backupKey(now);
  storage.setItem(
    key,
    JSON.stringify({
      localSaveFormat: localStorageKey,
      createdAt: now.toISOString(),
      save: JSON.parse(current),
    }),
  );

  for (const obsoleteKey of listLocalBackups(storage).slice(maximum)) {
    storage.removeItem(obsoleteKey);
  }
  return key;
}

export function applyCanonicalSave({
  adapter,
  cloudSave,
  currentLocalSave,
  localStorageKey,
  storage = window.localStorage,
  revision = null,
  createBackup = true,
  requestReload = true,
}) {
  if (!adapter || !localStorageKey) {
    return {
      success: false,
      errorCode: 'missing_adapter',
      message: 'No hay un adaptador local compatible.',
    };
  }

  const localSave = adapter.fromCanonical(cloudSave, currentLocalSave ?? {});
  const validation = adapter.validateLocal(localSave);
  if (!validation.valid) {
    return {
      success: false,
      errorCode: 'invalid_local_save',
      message: validation.message,
    };
  }

  let backup = null;
  try {
    if (createBackup) {
      backup = createLocalBackup(storage, localStorageKey);
    }

    const serialized = JSON.stringify(localSave);
    const temporaryKey = `${localStorageKey}__headbang_cloud_write`;
    storage.setItem(temporaryKey, serialized);
    if (storage.getItem(temporaryKey) !== serialized) {
      throw new Error('temporary_write_failed');
    }
    storage.setItem(localStorageKey, serialized);
    adapter.writeAuxiliary?.(storage, localSave);
    storage.removeItem(temporaryKey);

    const written = adapter.read(storage);
    const writtenValidation = adapter.validateLocal(written);
    if (!writtenValidation.valid) {
      throw new Error('written_save_invalid');
    }

    if (requestReload) {
      storage.setItem(
        HEADBANG_RELOAD_PENDING_KEY,
        JSON.stringify({
          adapterId: adapter.id,
          revision,
          createdAt: new Date().toISOString(),
        }),
      );
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('headbang-cloud-save-applied', {
          detail: {
            adapterId: adapter.id,
            success: true,
            revision,
          },
        }),
      );
    }

    return {
      success: true,
      errorCode: null,
      message: 'Partida aplicada al dispositivo.',
      adapterId: adapter.id,
      revision,
      backupCreated: backup !== null,
      reloadRequired: requestReload,
    };
  } catch {
    return {
      success: false,
      errorCode: 'local_write_failed',
      message: 'No se ha podido aplicar la partida en este dispositivo.',
      backupCreated: backup !== null,
    };
  }
}

export function consumeReloadMarker(storage = window.localStorage) {
  const marker = storage.getItem(HEADBANG_RELOAD_PENDING_KEY);
  if (marker === null) {
    return null;
  }
  storage.removeItem(HEADBANG_RELOAD_PENDING_KEY);
  try {
    return JSON.parse(marker);
  } catch {
    return { invalid: true };
  }
}
