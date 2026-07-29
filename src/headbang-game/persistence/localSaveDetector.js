import { getRegisteredSaveAdapters } from './adapters/saveAdapterRegistry.js';

function calculateProgressScore(save) {
  if (!save || typeof save !== 'object') {
    return -1;
  }

  const arrayFields = [
    'unlockedLevels',
    'completedLevels',
    'destroyedTotems',
    'collectedUsb',
    'collectedObjects',
    'unlockedCharacters',
  ];
  const collectionScore = arrayFields.reduce(
    (total, key) => total + (Array.isArray(save[key]) ? save[key].length : 0),
    0,
  );

  return (
    Math.max(0, Number(save.highestUnlockedLevel) || 0) * 1000 +
    collectionScore * 10 +
    (save.campaignCompleted ? 100_000 : 0)
  );
}

function detectedStorageKey(adapter, save, storage) {
  if (save?.__headbangDetectedLegacyKey) {
    return save.__headbangDetectedLegacyKey;
  }
  return (
    adapter.localStorageKeys.find((key) => storage.getItem(key) !== null) ?? null
  );
}

export function detectActiveSaveAdapter(
  storage = window.localStorage,
  adapters = getRegisteredSaveAdapters(),
) {
  const detectedAt = new Date().toISOString();
  const candidates = [];

  for (const adapter of adapters) {
    try {
      if (!adapter.canRead(storage)) {
        continue;
      }
      const save = adapter.read(storage);
      const validation = adapter.validateLocal(save);
      if (!validation.valid) {
        continue;
      }
      const localStorageKey = detectedStorageKey(adapter, save, storage);
      candidates.push({
        adapter,
        save,
        adapterId: adapter.id,
        localStorageKey,
        gameBuildVersion:
          localStorageKey?.match(/v(\d+)$/u)?.[1]
            ? `V${localStorageKey.match(/v(\d+)$/u)[1]}`
            : null,
        detectedAt,
        validation,
        progressScore: calculateProgressScore(save),
      });
    } catch {
      // Corrupt JSON and broken adapters are never selected automatically.
    }
  }

  candidates.sort(
    (left, right) =>
      right.adapter.priority - left.adapter.priority ||
      right.progressScore - left.progressScore,
  );

  return candidates[0] ?? null;
}

export function summarizeDetectedSave(detection) {
  if (!detection) {
    return {
      adapterId: null,
      localSaveDetected: false,
      localSaveFormat: null,
      gameBuildVersion: null,
      detectedAt: new Date().toISOString(),
      valid: false,
    };
  }

  return {
    adapterId: detection.adapterId,
    localSaveDetected: true,
    localSaveFormat: detection.localStorageKey,
    gameBuildVersion: detection.gameBuildVersion,
    detectedAt: detection.detectedAt,
    valid: detection.validation.valid,
  };
}
