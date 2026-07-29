import { v017SaveAdapter } from './v017SaveAdapter.js';

export const LEGACY_SAVE_KEYS = Object.freeze([
  'hd_bt_campaign_save_v016',
  'hd_bt_campaign_save_v012',
  'hd_bt_campaign_save_v010',
]);

function readCandidate(storage, key) {
  const serialized = storage.getItem(key);
  if (serialized === null) {
    return null;
  }
  const parsed = JSON.parse(serialized);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed
    : null;
}

function detectedKey(storage) {
  for (const key of LEGACY_SAVE_KEYS) {
    try {
      if (readCandidate(storage, key)) {
        return key;
      }
    } catch {
      // Continue with the next known legacy key.
    }
  }
  return null;
}

export const genericSaveAdapter = Object.freeze({
  id: 'generic-legacy',
  localStorageKeys: [...LEGACY_SAVE_KEYS],
  priority: 100,

  canRead(storage) {
    return detectedKey(storage) !== null;
  },

  read(storage) {
    const key = detectedKey(storage);
    if (!key) {
      return null;
    }
    return {
      ...structuredClone(readCandidate(storage, key)),
      __headbangDetectedLegacyKey: key,
    };
  },

  toCanonical(localSave) {
    const key =
      localSave.__headbangDetectedLegacyKey ?? 'hd_bt_campaign_save_legacy';
    const clean = { ...localSave };
    delete clean.__headbangDetectedLegacyKey;
    const canonical = v017SaveAdapter.toCanonical(clean);
    const version = key.match(/v(\d+)$/u)?.[1] ?? null;
    canonical.source = {
      adapterId: this.id,
      gameBuildVersion: version ? `V${version}` : null,
      localSaveFormat: key,
    };
    return canonical;
  },

  fromCanonical(cloudSave, currentLocalSave = {}) {
    const clean = { ...currentLocalSave };
    delete clean.__headbangDetectedLegacyKey;
    return v017SaveAdapter.fromCanonical(cloudSave, clean);
  },

  validateLocal(save) {
    if (!save || typeof save !== 'object' || Array.isArray(save)) {
      return { valid: false, message: 'El save heredado no es JSON válido.' };
    }
    const clean = { ...save };
    delete clean.__headbangDetectedLegacyKey;
    return v017SaveAdapter.validateLocal(clean);
  },
});
