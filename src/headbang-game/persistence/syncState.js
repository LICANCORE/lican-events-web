import {
  HEADBANG_DEVICE_ID_KEY,
  HEADBANG_SYNC_STATE_KEY,
} from './cloudSaveSchema.js';

const MAX_HISTORY = 30;

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

export function getOrCreateDeviceId(storage = window.localStorage) {
  const existing = storage.getItem(HEADBANG_DEVICE_ID_KEY);
  if (
    existing &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      existing,
    )
  ) {
    return existing;
  }

  const deviceId = crypto.randomUUID();
  storage.setItem(HEADBANG_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export function createInitialSyncStatus({
  enabled = false,
  online = typeof navigator === 'undefined' ? true : navigator.onLine,
} = {}) {
  return {
    phase: enabled ? 'idle' : 'disabled',
    enabled,
    authenticated: false,
    online,
    adapterId: null,
    localSaveDetected: false,
    cloudSaveDetected: false,
    pendingSync: false,
    firstSyncComplete: false,
    lastSyncAt: null,
    localRevision: null,
    cloudRevision: 0,
    conflict: false,
    error: null,
  };
}

export function loadPersistedSyncState(
  storage = window.localStorage,
  defaults = createInitialSyncStatus(),
) {
  const stored = safeParse(storage.getItem(HEADBANG_SYNC_STATE_KEY), {});
  return {
    ...defaults,
    pendingSync: Boolean(stored.pendingSync),
    firstSyncComplete: Boolean(stored.firstSyncComplete),
    lastSyncAt: stored.lastSyncAt ?? null,
    localRevision: stored.localRevision ?? null,
    cloudRevision: Number(stored.cloudRevision) || 0,
  };
}

export function persistSyncState(storage, status) {
  storage.setItem(
    HEADBANG_SYNC_STATE_KEY,
    JSON.stringify({
      pendingSync: Boolean(status.pendingSync),
      firstSyncComplete: Boolean(status.firstSyncComplete),
      lastSyncAt: status.lastSyncAt ?? null,
      localRevision: status.localRevision ?? null,
      cloudRevision: Number(status.cloudRevision) || 0,
    }),
  );
}

export function createSyncHistory() {
  const history = [];
  return {
    add(entry) {
      history.unshift({
        at: new Date().toISOString(),
        action: entry.action,
        success: Boolean(entry.success),
        revision: entry.revision ?? null,
        errorCode: entry.errorCode ?? null,
      });
      history.splice(MAX_HISTORY);
    },
    get() {
      return history.map((entry) => ({ ...entry }));
    },
    clear() {
      history.splice(0);
    },
  };
}

export function publicSyncStatus(status) {
  return {
    phase: status.phase,
    authenticated: Boolean(status.authenticated),
    online: Boolean(status.online),
    adapterId: status.adapterId,
    localSaveDetected: Boolean(status.localSaveDetected),
    cloudSaveDetected: Boolean(status.cloudSaveDetected),
    pendingSync: Boolean(status.pendingSync),
    lastSyncAt: status.lastSyncAt,
    localRevision: status.localRevision,
    cloudRevision: Number(status.cloudRevision) || 0,
    conflict: Boolean(status.conflict),
    error: status.error,
    enabled: Boolean(status.enabled),
    firstSyncComplete: Boolean(status.firstSyncComplete),
  };
}
