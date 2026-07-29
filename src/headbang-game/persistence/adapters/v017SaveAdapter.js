import { createEmptyCloudSave } from '../cloudSaveSchema.js';

export const V017_SAVE_KEY = 'hd_bt_campaign_save_v017';
export const V017_SELECTED_LEVEL_KEY = 'hd_bt_selected_level_v013';
export const V017_SELECTED_CHARACTER_KEY = 'hd_bt_selected_character_v005';

const KNOWN_LOCAL_FIELDS = new Set([
  'version',
  'introSeen',
  'introMasterUsbCollected',
  'masterUsbCount',
  'tutorialCompleted',
  'highestUnlockedLevel',
  'unlockedLevels',
  'completedLevels',
  'destroyedTotems',
  'collectedUsb',
  'collectedObjects',
  'unlockedCharacters',
  'characterUnlockSequenceViewed',
  'newUnlockPending',
  'selectedCharacter',
  'selectedLevel',
  'bestScoreByLevel',
  'bestAccuracyByLevel',
  'bestComboByLevel',
  'bestRankByLevel',
  'attemptsByLevel',
  'campaignCompleted',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJson(storage, key) {
  const serialized = storage.getItem(key);
  if (serialized === null) {
    return null;
  }
  const value = JSON.parse(serialized);
  return isObject(value) ? value : null;
}

function cloneObject(value) {
  return isObject(value) ? structuredClone(value) : {};
}

function unknownFields(save) {
  return Object.fromEntries(
    Object.entries(save).filter(([key]) => !KNOWN_LOCAL_FIELDS.has(key)),
  );
}

function mergeUnknown(target, unknown) {
  for (const [key, value] of Object.entries(cloneObject(unknown))) {
    if (!(key in target) && !['__proto__', 'constructor', 'prototype'].includes(key)) {
      target[key] = value;
    }
  }
}

export const v017SaveAdapter = Object.freeze({
  id: 'v017',
  localStorageKeys: [V017_SAVE_KEY],
  priority: 170,

  canRead(storage) {
    try {
      return this.localStorageKeys.some((key) => readJson(storage, key));
    } catch {
      return false;
    }
  },

  read(storage) {
    const save = readJson(storage, V017_SAVE_KEY);
    if (!save) {
      return null;
    }

    const selectedLevel = storage.getItem(V017_SELECTED_LEVEL_KEY);
    const selectedCharacter = storage.getItem(V017_SELECTED_CHARACTER_KEY);

    return {
      ...structuredClone(save),
      ...(selectedLevel && !save.selectedLevel ? { selectedLevel } : {}),
      ...(selectedCharacter && !save.selectedCharacter
        ? { selectedCharacter }
        : {}),
    };
  },

  toCanonical(localSave) {
    const save = cloneObject(localSave);
    const canonical = createEmptyCloudSave({
      source: {
        adapterId: this.id,
        gameBuildVersion: 'V017',
        localSaveFormat: V017_SAVE_KEY,
      },
    });

    canonical.progression = {
      tutorialCompleted: Boolean(save.tutorialCompleted),
      highestUnlockedLevel: Math.max(
        1,
        Math.floor(Number(save.highestUnlockedLevel) || 1),
      ),
      unlockedLevels: Array.isArray(save.unlockedLevels)
        ? save.unlockedLevels
        : [],
      completedLevels: Array.isArray(save.completedLevels)
        ? save.completedLevels
        : [],
      destroyedTotems: Array.isArray(save.destroyedTotems)
        ? save.destroyedTotems
        : [],
      campaignCompleted: Boolean(save.campaignCompleted),
    };
    canonical.collection = {
      collectedUsb: Array.isArray(save.collectedUsb) ? save.collectedUsb : [],
      collectedObjects: Array.isArray(save.collectedObjects)
        ? save.collectedObjects
        : [],
      unlockedCharacters: Array.isArray(save.unlockedCharacters)
        ? save.unlockedCharacters
        : [],
      characterUnlockSequenceViewed: Array.isArray(
        save.characterUnlockSequenceViewed,
      )
        ? save.characterUnlockSequenceViewed
        : [],
      newUnlockPending: Array.isArray(save.newUnlockPending)
        ? save.newUnlockPending
        : [],
    };
    canonical.performance = {
      bestScoreByLevel: cloneObject(save.bestScoreByLevel),
      bestAccuracyByLevel: cloneObject(save.bestAccuracyByLevel),
      bestComboByLevel: cloneObject(save.bestComboByLevel),
      bestRankByLevel: cloneObject(save.bestRankByLevel),
      attemptsByLevel: cloneObject(save.attemptsByLevel),
    };
    canonical.player = {
      selectedCharacter:
        typeof save.selectedCharacter === 'string'
          ? save.selectedCharacter
          : null,
      selectedLevel:
        typeof save.selectedLevel === 'string' ||
        Number.isFinite(save.selectedLevel)
          ? save.selectedLevel
          : null,
    };
    canonical.extensions.v017 = {
      introSeen: Boolean(save.introSeen),
      introMasterUsbCollected: Boolean(save.introMasterUsbCollected),
      masterUsbCount: Math.max(0, Math.floor(Number(save.masterUsbCount) || 0)),
      localVersion: save.version ?? 'V017',
    };
    canonical.unknownLocalData = unknownFields(save);

    return canonical;
  },

  fromCanonical(cloudSave, currentLocalSave = {}) {
    const current = cloneObject(currentLocalSave);
    const result = structuredClone(current);
    mergeUnknown(result, cloudSave.unknownLocalData);

    result.version =
      current.version ?? cloudSave.extensions?.v017?.localVersion ?? 'V017';
    result.introSeen =
      cloudSave.extensions?.v017?.introSeen ?? Boolean(current.introSeen);
    result.introMasterUsbCollected =
      cloudSave.extensions?.v017?.introMasterUsbCollected ??
      Boolean(current.introMasterUsbCollected);
    result.masterUsbCount = Math.max(
      Number(current.masterUsbCount) || 0,
      Number(cloudSave.extensions?.v017?.masterUsbCount) || 0,
    );
    result.tutorialCompleted = Boolean(
      cloudSave.progression?.tutorialCompleted,
    );
    result.highestUnlockedLevel = Math.max(
      1,
      Math.floor(Number(cloudSave.progression?.highestUnlockedLevel) || 1),
    );
    result.unlockedLevels = [...(cloudSave.progression?.unlockedLevels ?? [])];
    result.completedLevels = [...(cloudSave.progression?.completedLevels ?? [])];
    result.destroyedTotems = [...(cloudSave.progression?.destroyedTotems ?? [])];
    result.campaignCompleted = Boolean(
      cloudSave.progression?.campaignCompleted,
    );
    result.collectedUsb = [...(cloudSave.collection?.collectedUsb ?? [])];
    result.collectedObjects = [
      ...(cloudSave.collection?.collectedObjects ?? []),
    ];
    result.unlockedCharacters = [
      ...(cloudSave.collection?.unlockedCharacters ?? []),
    ];
    result.characterUnlockSequenceViewed = [
      ...(cloudSave.collection?.characterUnlockSequenceViewed ?? []),
    ];
    result.newUnlockPending = [
      ...(cloudSave.collection?.newUnlockPending ?? []),
    ];
    result.bestScoreByLevel = cloneObject(
      cloudSave.performance?.bestScoreByLevel,
    );
    result.bestAccuracyByLevel = cloneObject(
      cloudSave.performance?.bestAccuracyByLevel,
    );
    result.bestComboByLevel = cloneObject(
      cloudSave.performance?.bestComboByLevel,
    );
    result.bestRankByLevel = cloneObject(
      cloudSave.performance?.bestRankByLevel,
    );
    result.attemptsByLevel = cloneObject(
      cloudSave.performance?.attemptsByLevel,
    );
    result.selectedCharacter =
      cloudSave.player?.selectedCharacter ?? current.selectedCharacter ?? 'treze';
    if (cloudSave.player?.selectedLevel !== null) {
      result.selectedLevel = cloudSave.player.selectedLevel;
    }

    return result;
  },

  validateLocal(save) {
    if (!isObject(save)) {
      return { valid: false, message: 'El save V017 no es un objeto JSON.' };
    }
    if (
      save.highestUnlockedLevel !== undefined &&
      (!Number.isFinite(Number(save.highestUnlockedLevel)) ||
        Number(save.highestUnlockedLevel) < 1)
    ) {
      return {
        valid: false,
        message: 'highestUnlockedLevel no es válido.',
      };
    }
    for (const key of [
      'unlockedLevels',
      'completedLevels',
      'unlockedCharacters',
      'collectedUsb',
    ]) {
      if (save[key] !== undefined && !Array.isArray(save[key])) {
        return { valid: false, message: `${key} debe ser un array.` };
      }
    }
    return { valid: true, message: null };
  },

  writeAuxiliary(storage, localSave) {
    if (localSave.selectedLevel !== undefined && localSave.selectedLevel !== null) {
      storage.setItem(V017_SELECTED_LEVEL_KEY, String(localSave.selectedLevel));
    }
    if (localSave.selectedCharacter) {
      storage.setItem(
        V017_SELECTED_CHARACTER_KEY,
        String(localSave.selectedCharacter),
      );
    }
  },
});
