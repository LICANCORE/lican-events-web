import {
  INITIAL_CHARACTER_IDS,
  RANK_PRIORITY,
  createEmptyCloudSave,
} from './cloudSaveSchema.js';
import { normalizeCloudSave } from './cloudSaveValidator.js';

function union(left = [], right = []) {
  const values = [];
  const seen = new Set();
  for (const value of [...left, ...right]) {
    const key = `${typeof value}:${String(value)}`;
    if (!seen.has(key)) {
      seen.add(key);
      values.push(value);
    }
  }
  return values.sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    return `${typeof a}:${String(a)}`.localeCompare(
      `${typeof b}:${String(b)}`,
      'en',
    );
  });
}

function maximumMap(left = {}, right = {}) {
  const result = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const values = [Number(left[key]), Number(right[key])].filter(Number.isFinite);
    if (values.length > 0) {
      result[key] = Math.max(...values);
    }
  }
  return result;
}

function rankMap(left = {}, right = {}, rankPriority = RANK_PRIORITY) {
  const result = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const candidates = [left[key], right[key]].filter(
      (rank) => typeof rank === 'string',
    );
    result[key] =
      candidates.sort(
        (a, b) => (rankPriority[b] ?? -1) - (rankPriority[a] ?? -1),
      )[0] ?? null;
  }
  return Object.fromEntries(
    Object.entries(result).filter(([, value]) => value !== null),
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeObjects(left, right, prefer = 'right') {
  const result = {};
  for (const key of new Set([
    ...Object.keys(isPlainObject(left) ? left : {}),
    ...Object.keys(isPlainObject(right) ? right : {}),
  ])) {
    const leftValue = left?.[key];
    const rightValue = right?.[key];
    if (isPlainObject(leftValue) && isPlainObject(rightValue)) {
      result[key] = mergeObjects(leftValue, rightValue, prefer);
    } else if (leftValue === undefined) {
      result[key] = structuredClone(rightValue);
    } else if (rightValue === undefined) {
      result[key] = structuredClone(leftValue);
    } else {
      result[key] = structuredClone(prefer === 'right' ? rightValue : leftValue);
    }
  }
  return result;
}

function latestIso(left, right) {
  const values = [left, right].filter(
    (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)),
  );
  return values.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function latestFieldValue(path, local, cloud, fallback = 'local') {
  const localTime = local.extensions?.fieldUpdatedAt?.[path];
  const cloudTime = cloud.extensions?.fieldUpdatedAt?.[path];
  if (localTime && cloudTime && Date.parse(localTime) !== Date.parse(cloudTime)) {
    return Date.parse(localTime) > Date.parse(cloudTime) ? 'local' : 'cloud';
  }
  if (localTime && !cloudTime) {
    return 'local';
  }
  if (cloudTime && !localTime) {
    return 'cloud';
  }
  return fallback;
}

function validSelectedCharacter(candidate, unlockedCharacters) {
  if (
    typeof candidate === 'string' &&
    unlockedCharacters.includes(candidate)
  ) {
    return candidate;
  }
  return (
    INITIAL_CHARACTER_IDS.find((id) => unlockedCharacters.includes(id)) ??
    unlockedCharacters[0] ??
    'treze'
  );
}

function validSelectedLevel(candidate, unlockedLevels, highestUnlockedLevel) {
  if (
    typeof candidate === 'string' &&
    unlockedLevels.includes(candidate)
  ) {
    return candidate;
  }
  if (
    Number.isFinite(Number(candidate)) &&
    Number(candidate) >= 1 &&
    Number(candidate) <= highestUnlockedLevel
  ) {
    return candidate;
  }
  return unlockedLevels[0] ?? null;
}

function mergeSettings(local, cloud) {
  const result = mergeObjects(cloud.settings, local.settings, 'right');
  const keys = new Set([
    ...Object.keys(local.settings ?? {}),
    ...Object.keys(cloud.settings ?? {}),
  ]);
  for (const key of keys) {
    const winner = latestFieldValue(`settings.${key}`, local, cloud);
    const value =
      winner === 'cloud' ? cloud.settings?.[key] : local.settings?.[key];
    if (value !== undefined) {
      result[key] = structuredClone(value);
    }
  }
  return result;
}

function hasEconomyData(economy) {
  if (!isPlainObject(economy)) {
    return false;
  }
  return Object.entries(economy).some(([key, value]) => {
    if (key === 'points') {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (isPlainObject(value)) {
      return Object.keys(value).length > 0;
    }
    return value !== null && value !== undefined;
  });
}

function earliestIso(left, right) {
  const values = [left, right].filter(
    (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)),
  );
  return values.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
}

function mergeAchievements(local, cloud, achievementTargets = {}) {
  const result = {};
  const ids = new Set([
    ...Object.keys(local.achievements ?? {}),
    ...Object.keys(cloud.achievements ?? {}),
  ]);

  for (const id of ids) {
    const localAchievement = local.achievements?.[id] ?? {};
    const cloudAchievement = cloud.achievements?.[id] ?? {};
    const merged = mergeObjects(
      cloudAchievement,
      localAchievement,
      'right',
    );
    merged.unlocked =
      Boolean(localAchievement.unlocked) ||
      Boolean(cloudAchievement.unlocked);
    merged.progress = Math.max(
      0,
      Number(localAchievement.progress) || 0,
      Number(cloudAchievement.progress) || 0,
    );

    const configuredTarget = Number(achievementTargets[id]);
    if (Number.isFinite(configuredTarget) && configuredTarget > 0) {
      merged.target = configuredTarget;
    } else {
      // Unknown future achievements are preserved. A target is never derived
      // from progress: known targets must be supplied by game configuration.
      const preservedTarget = [
        Number(cloudAchievement.target),
        Number(localAchievement.target),
      ].find((target) => Number.isFinite(target) && target > 0);
      if (preservedTarget !== undefined) {
        merged.target = preservedTarget;
      } else {
        delete merged.target;
      }
    }

    const unlockedAt = earliestIso(
      localAchievement.unlockedAt,
      cloudAchievement.unlockedAt,
    );
    if (merged.unlocked && unlockedAt) {
      merged.unlockedAt = unlockedAt;
    } else if (!unlockedAt) {
      delete merged.unlockedAt;
    }
    result[id] = merged;
  }
  return result;
}

export function mergeCloudSaves(
  localInput,
  cloudInput,
  { rankPriority = RANK_PRIORITY, achievementTargets = {} } = {},
) {
  const local = normalizeCloudSave(localInput ?? createEmptyCloudSave());
  const cloud = normalizeCloudSave(cloudInput ?? createEmptyCloudSave());
  const merged = createEmptyCloudSave();

  merged.identity = {
    saveId: cloud.identity.saveId || local.identity.saveId,
    userId: cloud.identity.userId || local.identity.userId,
    createdAt:
      [cloud.identity.createdAt, local.identity.createdAt]
        .filter(Boolean)
        .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null,
    updatedAt: latestIso(local.identity.updatedAt, cloud.identity.updatedAt),
  };
  merged.source = {
    adapterId: local.source.adapterId ?? cloud.source.adapterId,
    gameBuildVersion:
      local.source.gameBuildVersion ?? cloud.source.gameBuildVersion,
    localSaveFormat:
      local.source.localSaveFormat ?? cloud.source.localSaveFormat,
  };
  merged.progression = {
    tutorialCompleted:
      local.progression.tutorialCompleted ||
      cloud.progression.tutorialCompleted,
    highestUnlockedLevel: Math.max(
      local.progression.highestUnlockedLevel,
      cloud.progression.highestUnlockedLevel,
    ),
    unlockedLevels: union(
      local.progression.unlockedLevels,
      cloud.progression.unlockedLevels,
    ),
    completedLevels: union(
      local.progression.completedLevels,
      cloud.progression.completedLevels,
    ),
    destroyedTotems: union(
      local.progression.destroyedTotems,
      cloud.progression.destroyedTotems,
    ),
    campaignCompleted:
      local.progression.campaignCompleted ||
      cloud.progression.campaignCompleted,
  };
  const viewed = union(
    local.collection.characterUnlockSequenceViewed,
    cloud.collection.characterUnlockSequenceViewed,
  );
  merged.collection = {
    collectedUsb: union(
      local.collection.collectedUsb,
      cloud.collection.collectedUsb,
    ),
    collectedObjects: union(
      local.collection.collectedObjects,
      cloud.collection.collectedObjects,
    ),
    unlockedCharacters: union(
      local.collection.unlockedCharacters,
      cloud.collection.unlockedCharacters,
    ),
    characterUnlockSequenceViewed: viewed,
    newUnlockPending: union(
      local.collection.newUnlockPending,
      cloud.collection.newUnlockPending,
    ).filter((item) => !viewed.includes(item)),
  };
  merged.performance = {
    bestScoreByLevel: maximumMap(
      local.performance.bestScoreByLevel,
      cloud.performance.bestScoreByLevel,
    ),
    bestAccuracyByLevel: maximumMap(
      local.performance.bestAccuracyByLevel,
      cloud.performance.bestAccuracyByLevel,
    ),
    bestComboByLevel: maximumMap(
      local.performance.bestComboByLevel,
      cloud.performance.bestComboByLevel,
    ),
    bestRankByLevel: rankMap(
      local.performance.bestRankByLevel,
      cloud.performance.bestRankByLevel,
      rankPriority,
    ),
    // Attempts are monotonic per level. Taking the maximum avoids double
    // counting the same run when two devices repeatedly exchange the save.
    attemptsByLevel: maximumMap(
      local.performance.attemptsByLevel,
      cloud.performance.attemptsByLevel,
    ),
  };

  const selectedCharacterWinner = latestFieldValue(
    'player.selectedCharacter',
    local,
    cloud,
  );
  const selectedLevelWinner = latestFieldValue(
    'player.selectedLevel',
    local,
    cloud,
  );
  merged.player = {
    selectedCharacter: validSelectedCharacter(
      selectedCharacterWinner === 'cloud'
        ? cloud.player.selectedCharacter
        : local.player.selectedCharacter,
      merged.collection.unlockedCharacters,
    ),
    selectedLevel: validSelectedLevel(
      selectedLevelWinner === 'cloud'
        ? cloud.player.selectedLevel
        : local.player.selectedLevel,
      merged.progression.unlockedLevels,
      merged.progression.highestUnlockedLevel,
    ),
  };
  merged.settings = mergeSettings(local, cloud);
  // Commercial economy remains opaque. Points temporarily use a monotonic
  // maximum and are never summed between devices.
  merged.economy = hasEconomyData(cloud.economy)
    ? structuredClone(cloud.economy)
    : structuredClone(local.economy);
  merged.economy.points = {
    total: Math.max(
      0,
      Math.min(
        Number.MAX_SAFE_INTEGER,
        Number(local.economy?.points?.total) || 0,
      ),
      Math.min(
        Number.MAX_SAFE_INTEGER,
        Number(cloud.economy?.points?.total) || 0,
      ),
    ),
    earnedByLevel: maximumMap(
      local.economy?.points?.earnedByLevel,
      cloud.economy?.points?.earnedByLevel,
    ),
  };
  merged.achievements = mergeAchievements(
    local,
    cloud,
    achievementTargets,
  );
  merged.events = mergeObjects(cloud.events, local.events, 'right');
  merged.extensions = mergeObjects(
    cloud.extensions,
    local.extensions,
    'right',
  );
  merged.extensions.fieldUpdatedAt = mergeObjects(
    cloud.extensions?.fieldUpdatedAt,
    local.extensions?.fieldUpdatedAt,
    'right',
  );
  merged.unknownLocalData = mergeObjects(
    cloud.unknownLocalData,
    local.unknownLocalData,
    'right',
  );

  return normalizeCloudSave(merged);
}

export function summarizeCloudSave(save) {
  const normalized = normalizeCloudSave(save);
  return {
    highestUnlockedLevel: normalized.progression.highestUnlockedLevel,
    completedLevels: normalized.progression.completedLevels.length,
    unlockedCharacters: normalized.collection.unlockedCharacters.length,
    collectedUsb: normalized.collection.collectedUsb.length,
    campaignCompleted: normalized.progression.campaignCompleted,
  };
}
