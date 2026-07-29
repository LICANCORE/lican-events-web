import {
  HEADBANG_CLOUD_SAVE_MAX_BYTES,
  HEADBANG_CLOUD_SCHEMA_VERSION,
  createEmptyCloudSave,
} from './cloudSaveSchema.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SENSITIVE_KEY_PATTERN =
  /(^|_)(access_?token|refresh_?token|password|email|service_?role|secret)($|_)/iu;
const MAX_DEPTH = 12;
const MAX_ARRAY_LENGTH = 1000;
const MAX_OBJECT_KEYS = 256;
const MAX_STRING_LENGTH = 2048;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function inspectJson(value, path = 'cloudSave', depth = 0, seen = new Set()) {
  if (depth > MAX_DEPTH) {
    return `${path} supera la profundidad permitida.`;
  }

  if (value === null || typeof value === 'boolean') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? null : `${path} contiene un número no finito.`;
  }

  if (typeof value === 'string') {
    return value.length <= MAX_STRING_LENGTH
      ? null
      : `${path} contiene un texto demasiado largo.`;
  }

  if (typeof value !== 'object') {
    return `${path} contiene un tipo no permitido.`;
  }

  if (seen.has(value)) {
    return `${path} contiene una referencia circular.`;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      return `${path} contiene demasiados elementos.`;
    }
    for (let index = 0; index < value.length; index += 1) {
      const issue = inspectJson(value[index], `${path}[${index}]`, depth + 1, seen);
      if (issue) {
        return issue;
      }
    }
    seen.delete(value);
    return null;
  }

  if (!isPlainObject(value)) {
    return `${path} debe contener únicamente objetos JSON.`;
  }

  const keys = Object.keys(value);
  if (keys.length > MAX_OBJECT_KEYS) {
    return `${path} contiene demasiadas propiedades.`;
  }

  for (const key of keys) {
    if (DANGEROUS_KEYS.has(key)) {
      return `${path} contiene una clave no permitida.`;
    }
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return `${path} contiene datos sensibles no permitidos.`;
    }
    const issue = inspectJson(value[key], `${path}.${key}`, depth + 1, seen);
    if (issue) {
      return issue;
    }
  }

  seen.delete(value);
  return null;
}

function uniqueScalars(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];
  for (const item of value) {
    if (
      (typeof item !== 'string' && typeof item !== 'number') ||
      (typeof item === 'number' && !Number.isFinite(item))
    ) {
      continue;
    }
    const key = `${typeof item}:${String(item)}`;
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(item);
    }
  }
  return normalized;
}

function finiteMap(value, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, entry]) =>
          key.length <= 128 &&
          Number.isFinite(Number(entry)) &&
          Number(entry) >= minimum &&
          Number(entry) <= maximum,
      )
      .map(([key, entry]) => [key, Number(entry)]),
  );
}

function safeObject(value) {
  return isPlainObject(value) ? structuredClone(value) : {};
}

function normalizeAchievements(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  const achievements = {};
  for (const [achievementId, achievement] of Object.entries(value)) {
    if (
      achievementId.length > 128 ||
      !isPlainObject(achievement)
    ) {
      continue;
    }
    const progress = Number(achievement.progress);
    const target = Number(achievement.target);
    const unlockedAt =
      typeof achievement.unlockedAt === 'string' &&
      Number.isFinite(Date.parse(achievement.unlockedAt))
        ? new Date(achievement.unlockedAt).toISOString()
        : null;
    achievements[achievementId] = {
      ...structuredClone(achievement),
      unlocked: Boolean(achievement.unlocked),
      progress: Number.isFinite(progress) && progress >= 0 ? progress : 0,
      ...(Number.isFinite(target) && target > 0 ? { target } : {}),
      ...(unlockedAt ? { unlockedAt } : {}),
    };
    if (!unlockedAt) {
      delete achievements[achievementId].unlockedAt;
    }
    if (!Number.isFinite(target) || target <= 0) {
      delete achievements[achievementId].target;
    }
  }
  return achievements;
}

export function normalizeCloudSave(input) {
  const source = isPlainObject(input) ? input : {};
  const normalized = createEmptyCloudSave();

  normalized.cloudSchemaVersion = HEADBANG_CLOUD_SCHEMA_VERSION;
  normalized.identity = {
    saveId: String(source.identity?.saveId ?? '').slice(0, 128),
    userId: String(source.identity?.userId ?? '').slice(0, 128),
    createdAt: source.identity?.createdAt ?? null,
    updatedAt: source.identity?.updatedAt ?? null,
  };
  normalized.source = {
    adapterId: source.source?.adapterId ?? null,
    gameBuildVersion: source.source?.gameBuildVersion ?? null,
    localSaveFormat: source.source?.localSaveFormat ?? null,
  };
  normalized.progression = {
    tutorialCompleted: Boolean(source.progression?.tutorialCompleted),
    highestUnlockedLevel: Math.max(
      1,
      Math.floor(Number(source.progression?.highestUnlockedLevel) || 1),
    ),
    unlockedLevels: uniqueScalars(source.progression?.unlockedLevels),
    completedLevels: uniqueScalars(source.progression?.completedLevels),
    destroyedTotems: uniqueScalars(source.progression?.destroyedTotems),
    campaignCompleted: Boolean(source.progression?.campaignCompleted),
  };
  normalized.collection = {
    collectedUsb: uniqueScalars(source.collection?.collectedUsb),
    collectedObjects: uniqueScalars(source.collection?.collectedObjects),
    unlockedCharacters: uniqueScalars(source.collection?.unlockedCharacters),
    characterUnlockSequenceViewed: uniqueScalars(
      source.collection?.characterUnlockSequenceViewed,
    ),
    newUnlockPending: uniqueScalars(source.collection?.newUnlockPending),
  };
  normalized.performance = {
    bestScoreByLevel: finiteMap(source.performance?.bestScoreByLevel),
    bestAccuracyByLevel: finiteMap(source.performance?.bestAccuracyByLevel, {
      maximum: 100,
    }),
    bestComboByLevel: finiteMap(source.performance?.bestComboByLevel),
    bestRankByLevel: safeObject(source.performance?.bestRankByLevel),
    attemptsByLevel: finiteMap(source.performance?.attemptsByLevel),
  };
  normalized.player = {
    selectedCharacter:
      typeof source.player?.selectedCharacter === 'string'
        ? source.player.selectedCharacter.slice(0, 128)
        : null,
    selectedLevel:
      typeof source.player?.selectedLevel === 'string' ||
      Number.isFinite(source.player?.selectedLevel)
        ? source.player.selectedLevel
        : null,
  };
  normalized.settings = safeObject(source.settings);
  normalized.economy = {
    ...normalized.economy,
    ...safeObject(source.economy),
    points: {
      total: Math.max(
        0,
        Math.min(
          Number.MAX_SAFE_INTEGER,
          Math.floor(Number(source.economy?.points?.total) || 0),
        ),
      ),
      earnedByLevel: finiteMap(source.economy?.points?.earnedByLevel),
    },
  };
  normalized.achievements = normalizeAchievements(source.achievements);
  normalized.events = safeObject(source.events);
  normalized.extensions = safeObject(source.extensions);
  normalized.extensions.fieldUpdatedAt = safeObject(
    source.extensions?.fieldUpdatedAt,
  );
  normalized.unknownLocalData = safeObject(source.unknownLocalData);

  return normalized;
}

export function validateCloudSave(input) {
  let bytes;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  } catch {
    return {
      valid: false,
      errorCode: 'invalid_cloud_save',
      message: 'La partida cloud no contiene JSON válido.',
    };
  }

  if (bytes > HEADBANG_CLOUD_SAVE_MAX_BYTES) {
    return {
      valid: false,
      errorCode: 'cloud_save_too_large',
      message: `La partida cloud supera el límite de ${HEADBANG_CLOUD_SAVE_MAX_BYTES / 1024} KB.`,
      bytes,
    };
  }

  const structuralError = inspectJson(input);
  if (structuralError) {
    return { valid: false, errorCode: 'unsafe_cloud_save', message: structuralError };
  }

  if (
    input?.cloudSchemaVersion !== undefined &&
    input.cloudSchemaVersion !== HEADBANG_CLOUD_SCHEMA_VERSION
  ) {
    return {
      valid: false,
      errorCode: 'unsupported_cloud_schema',
      message: 'La versión del guardado cloud todavía no es compatible.',
    };
  }

  return {
    valid: true,
    errorCode: null,
    message: null,
    bytes,
    value: normalizeCloudSave(input),
  };
}

export function assertValidCloudSave(input) {
  const result = validateCloudSave(input);
  if (!result.valid) {
    const error = new Error(result.message);
    error.code = result.errorCode;
    throw error;
  }
  return result.value;
}
