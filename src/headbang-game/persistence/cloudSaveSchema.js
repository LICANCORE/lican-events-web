export const HEADBANG_CLOUD_SAVE_ID = 'HEADBANG_CLOUD_SAVE';
export const HEADBANG_CLOUD_SCHEMA_VERSION = 1;
export const HEADBANG_CLOUD_SAVE_MAX_BYTES = 64 * 1024;
export const HEADBANG_DEVICE_ID_KEY = 'headbang_cloud_device_id';
export const HEADBANG_SYNC_STATE_KEY = 'headbang_cloud_sync_state';
export const HEADBANG_RELOAD_PENDING_KEY = 'headbang_cloud_reload_pending';
export const HEADBANG_BACKUP_PREFIX = 'hd_bt_campaign_backup_';
export const HEADBANG_MAX_LOCAL_BACKUPS = 5;

export const INITIAL_CHARACTER_IDS = Object.freeze([
  'treze',
  'henry',
  'hydraxxx',
]);

export const RANK_PRIORITY = Object.freeze({
  BEDROOM_BANGER: 1,
  WARM_UP_DEALER: 2,
  HEAVY_HITTER: 3,
  BASS_DEALER: 4,
  CERTIFIED_HEADBANGER: 5,
  RIDDIM_CRIMINAL: 6,
  BASS_TRAFFICKER: 7,
  VERTEBRAE_DELETED: 8,
});

export const ACCUMULATIVE_ARRAY_PATHS = Object.freeze([
  'progression.unlockedLevels',
  'progression.completedLevels',
  'progression.destroyedTotems',
  'collection.collectedUsb',
  'collection.collectedObjects',
  'collection.unlockedCharacters',
  'collection.characterUnlockSequenceViewed',
]);

export function createEmptyCloudSave({
  saveId = '',
  userId = '',
  now = null,
  source = {},
} = {}) {
  return {
    cloudSchemaVersion: HEADBANG_CLOUD_SCHEMA_VERSION,
    identity: {
      saveId,
      userId,
      createdAt: now,
      updatedAt: now,
    },
    source: {
      adapterId: source.adapterId ?? null,
      gameBuildVersion: source.gameBuildVersion ?? null,
      localSaveFormat: source.localSaveFormat ?? null,
    },
    progression: {
      tutorialCompleted: false,
      highestUnlockedLevel: 1,
      unlockedLevels: [],
      completedLevels: [],
      destroyedTotems: [],
      campaignCompleted: false,
    },
    collection: {
      collectedUsb: [],
      collectedObjects: [],
      unlockedCharacters: [],
      characterUnlockSequenceViewed: [],
      newUnlockPending: [],
    },
    performance: {
      bestScoreByLevel: {},
      bestAccuracyByLevel: {},
      bestComboByLevel: {},
      bestRankByLevel: {},
      attemptsByLevel: {},
    },
    player: {
      selectedCharacter: null,
      selectedLevel: null,
    },
    settings: {},
    economy: {
      points: {
        total: 0,
        earnedByLevel: {},
      },
      currencies: {},
      balances: {},
      inventory: {},
      purchasedItems: [],
      redeemedRewards: [],
    },
    achievements: {},
    events: {},
    extensions: {
      fieldUpdatedAt: {},
    },
    unknownLocalData: {},
  };
}

export function isMeaningfulCloudSave(save) {
  if (!save || typeof save !== 'object' || Array.isArray(save)) {
    return false;
  }

  return (
    save.cloudSchemaVersion === HEADBANG_CLOUD_SCHEMA_VERSION ||
    Object.keys(save).length > 0
  );
}
