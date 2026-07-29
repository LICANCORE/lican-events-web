export const HEADBANG_GAME_SAVE_KEY = 'hd_bt_campaign_save_v019';
export const HEADBANG_LEGACY_GAME_SAVE_KEYS = Object.freeze([
  'hd_bt_campaign_save_v017',
]);

/**
 * HEADBANG DEALERS campaign save V019, with a read-only V017 fallback before
 * the game performs its own local migration.
 *
 * The current bundle may store the following fields:
 * - version
 * - introSeen
 * - introMasterUsbCollected
 * - masterUsbCount
 * - tutorialCompleted
 * - highestUnlockedLevel
 * - unlockedLevels
 * - completedLevels
 * - destroyedTotems
 * - collectedUsb
 * - collectedObjects
 * - unlockedCharacters
 * - characterUnlockSequenceViewed
 * - newUnlockPending
 * - selectedCharacter
 * - bestScoreByLevel
 * - bestAccuracyByLevel
 * - bestComboByLevel
 * - bestRankByLevel
 * - attemptsByLevel
 * - campaignCompleted
 *
 * This reader intentionally performs no migration, normalization, deletion,
 * or write. It returns the complete stored object unchanged.
 */
export function readLocalGameSave(storage = window.localStorage) {
  try {
    const serializedSave = [
      HEADBANG_GAME_SAVE_KEY,
      ...HEADBANG_LEGACY_GAME_SAVE_KEYS,
    ]
      .map((key) => storage.getItem(key))
      .find((value) => value !== null);

    if (serializedSave === null) {
      return null;
    }

    const save = JSON.parse(serializedSave);
    return save && typeof save === 'object' && !Array.isArray(save) ? save : null;
  } catch {
    return null;
  }
}
