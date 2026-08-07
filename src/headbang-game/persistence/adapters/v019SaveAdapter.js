import { v017SaveAdapter } from './v017SaveAdapter.js';

export const V019_SAVE_KEY = 'hd_bt_campaign_save_v019';
export const V019_SELECTED_LEVEL_KEY = 'hd_bt_selected_level_v013';
export const V019_SELECTED_CHARACTER_KEY = 'hd_bt_selected_character_v005';

function readJson(storage, key) {
  const serialized = storage.getItem(key);
  if (serialized === null) {
    return null;
  }
  const value = JSON.parse(serialized);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

function withoutRemovedCharacter(save) {
  const result = structuredClone(save);
  for (const field of [
    'unlockedCharacters',
    'characterUnlockSequenceViewed',
    'newUnlockPending',
  ]) {
    if (Array.isArray(result[field])) {
      result[field] = result[field].filter((id) => id !== 'theSiberian');
    }
  }
  result.unlockedCharacters = [
    ...new Set(['treze', ...(result.unlockedCharacters ?? [])]),
  ];
  if (result.selectedCharacter === 'theSiberian') {
    result.selectedCharacter = 'treze';
  }
  return result;
}

export const v019SaveAdapter = Object.freeze({
  ...v017SaveAdapter,
  id: 'v019',
  localStorageKeys: [V019_SAVE_KEY],
  priority: 190,

  canRead(storage) {
    try {
      return readJson(storage, V019_SAVE_KEY) !== null;
    } catch {
      return false;
    }
  },

  read(storage) {
    const save = readJson(storage, V019_SAVE_KEY);
    if (!save) {
      return null;
    }

    const selectedLevel = storage.getItem(V019_SELECTED_LEVEL_KEY);
    const selectedCharacter = storage.getItem(V019_SELECTED_CHARACTER_KEY);

    return withoutRemovedCharacter({
      ...structuredClone(save),
      ...(selectedLevel && !save.selectedLevel ? { selectedLevel } : {}),
      ...(selectedCharacter && !save.selectedCharacter
        ? { selectedCharacter }
        : {}),
    });
  },

  toCanonical(localSave) {
    const canonical = v017SaveAdapter.toCanonical(localSave);
    const legacyExtension = canonical.extensions.v017 ?? {};

    canonical.source = {
      adapterId: this.id,
      gameBuildVersion: 'V019',
      localSaveFormat: V019_SAVE_KEY,
    };
    canonical.extensions.v019 = {
      ...legacyExtension,
      localVersion: localSave?.version ?? 19,
    };
    delete canonical.extensions.v017;

    return canonical;
  },

  fromCanonical(cloudSave, currentLocalSave = {}) {
    const compatibleCloudSave = structuredClone(cloudSave);
    compatibleCloudSave.extensions ??= {};
    compatibleCloudSave.extensions.v017 = {
      ...(compatibleCloudSave.extensions.v019 ?? {}),
      localVersion:
        currentLocalSave.version ??
        compatibleCloudSave.extensions.v019?.localVersion ??
        19,
    };

    const result = v017SaveAdapter.fromCanonical(
      compatibleCloudSave,
      currentLocalSave,
    );
    result.version =
      currentLocalSave.version ??
      compatibleCloudSave.extensions.v019?.localVersion ??
      19;
    return withoutRemovedCharacter(result);
  },

  writeAuxiliary(storage, localSave) {
    if (
      localSave.selectedLevel !== undefined &&
      localSave.selectedLevel !== null
    ) {
      storage.setItem(
        V019_SELECTED_LEVEL_KEY,
        String(localSave.selectedLevel),
      );
    }
    if (localSave.selectedCharacter) {
      storage.setItem(
        V019_SELECTED_CHARACTER_KEY,
        String(localSave.selectedCharacter),
      );
    }
  },
});
