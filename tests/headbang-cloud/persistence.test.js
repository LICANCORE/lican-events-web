import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HEADBANG_CLOUD_SAVE_MAX_BYTES,
  createEmptyCloudSave,
} from '../../src/headbang-game/persistence/cloudSaveSchema.js';
import {
  normalizeCloudSave,
  validateCloudSave,
} from '../../src/headbang-game/persistence/cloudSaveValidator.js';
import {
  mergeCloudSaves,
} from '../../src/headbang-game/persistence/cloudSaveMerge.js';
import {
  detectActiveSaveAdapter,
} from '../../src/headbang-game/persistence/localSaveDetector.js';
import {
  applyCanonicalSave,
  listLocalBackups,
} from '../../src/headbang-game/persistence/localSaveWriter.js';
import {
  v017SaveAdapter,
  V017_SAVE_KEY,
} from '../../src/headbang-game/persistence/adapters/v017SaveAdapter.js';
import {
  v019SaveAdapter,
  V019_SAVE_KEY,
} from '../../src/headbang-game/persistence/adapters/v019SaveAdapter.js';
import {
  registerSaveAdapter,
} from '../../src/headbang-game/persistence/adapters/saveAdapterRegistry.js';
import {
  createSyncCoordinator,
} from '../../src/headbang-game/persistence/syncCoordinator.js';

const fixtureDirectory = new URL('./fixtures/', import.meta.url);

function fixture(name) {
  return JSON.parse(
    readFileSync(new URL(name, fixtureDirectory), 'utf8'),
  );
}

class MemoryStorage {
  #values = new Map();

  get length() {
    return this.#values.size;
  }

  key(index) {
    return [...this.#values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(String(key), String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  clear() {
    this.#values.clear();
  }
}

function storageWith(key, value) {
  const storage = new MemoryStorage();
  storage.setItem(key, JSON.stringify(value));
  return storage;
}

function fakeSupabase(row = null) {
  const rpcCalls = [];
  return {
    rpcCalls,
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: row, error: null };
        },
      };
    },
    async rpc(name, payload) {
      rpcCalls.push({ name, payload });
      return {
        data: {
          sync_revision: payload.p_expected_revision + 1,
          last_synced_at: '2026-07-29T12:00:00.000Z',
        },
        error: null,
      };
    },
  };
}

for (const version of ['010', '012', '016']) {
  test(`detecta save V${version} mediante el adaptador heredado`, () => {
    const storage = storageWith(
      `hd_bt_campaign_save_v${version}`,
      fixture(`save-v${version}.json`),
    );
    const detection = detectActiveSaveAdapter(storage);
    assert.equal(detection.adapterId, 'generic-legacy');
    assert.equal(
      detection.localStorageKey,
      `hd_bt_campaign_save_v${version}`,
    );
    assert.equal(detection.validation.valid, true);
  });
}

test('detecta V017 y prioriza la versión reconocida más reciente', () => {
  const storage = storageWith(V017_SAVE_KEY, fixture('save-v017-new.json'));
  storage.setItem(
    'hd_bt_campaign_save_v016',
    JSON.stringify(fixture('save-v016.json')),
  );
  const detection = detectActiveSaveAdapter(storage);
  assert.equal(detection.adapterId, 'v017');
  assert.equal(detection.localStorageKey, V017_SAVE_KEY);
});

test('ignora JSON corrupto y conserva un candidato válido anterior', () => {
  const storage = storageWith(
    'hd_bt_campaign_save_v016',
    fixture('save-v016.json'),
  );
  storage.setItem(V017_SAVE_KEY, '{"corrupt":');
  assert.equal(detectActiveSaveAdapter(storage).adapterId, 'generic-legacy');
});

test('local vacío no selecciona adaptador', () => {
  assert.equal(detectActiveSaveAdapter(new MemoryStorage()), null);
});

test('V017 convierte a canónico y vuelve sin perder campos desconocidos', () => {
  const local = fixture('save-v017-advanced.json');
  const canonical = v017SaveAdapter.toCanonical(local);
  const restored = v017SaveAdapter.fromCanonical(canonical, local);
  assert.deepEqual(restored.futureMechanic, local.futureMechanic);
  assert.equal(restored.highestUnlockedLevel, 5);
  assert.equal(restored.selectedCharacter, 'eddy-clash');
});

test('detecta V019 antes que saves anteriores', () => {
  const storage = storageWith(
    V019_SAVE_KEY,
    fixture('save-v019-advanced.json'),
  );
  storage.setItem(
    V017_SAVE_KEY,
    JSON.stringify(fixture('save-v017-advanced.json')),
  );

  const detection = detectActiveSaveAdapter(storage);
  assert.equal(detection.adapterId, 'v019');
  assert.equal(detection.localStorageKey, V019_SAVE_KEY);
  assert.equal(detection.gameBuildVersion, 'V019');
});

test('V019 conserva niveles, personajes y campos futuros en el round-trip', () => {
  const local = fixture('save-v019-advanced.json');
  const canonical = v019SaveAdapter.toCanonical(local);
  const restored = v019SaveAdapter.fromCanonical(canonical, local);

  assert.equal(canonical.source.adapterId, 'v019');
  assert.equal(canonical.source.gameBuildVersion, 'V019');
  assert.equal(canonical.source.localSaveFormat, V019_SAVE_KEY);
  assert.equal(restored.version, 19);
  assert.ok(restored.unlockedLevels.includes('level-10-david-neon'));
  assert.ok(restored.unlockedCharacters.includes('davidNeon'));
  assert.deepEqual(restored.v019FutureField, { keep: true });
});

test('normaliza arrays duplicados y valores de rendimiento', () => {
  const save = fixture('cloud-save-advanced.json');
  save.collection.collectedUsb.push('usb-future', 'usb-future');
  save.performance.bestAccuracyByLevel.invalid = 150;
  const normalized = normalizeCloudSave(save);
  assert.equal(
    normalized.collection.collectedUsb.filter((id) => id === 'usb-future')
      .length,
    1,
  );
  assert.equal(normalized.performance.bestAccuracyByLevel.invalid, undefined);
});

test('fusiona progreso dividido sin reducirlo', () => {
  const local = v017SaveAdapter.toCanonical(
    fixture('save-v017-advanced.json'),
  );
  const cloud = fixture('cloud-save-advanced.json');
  const merged = mergeCloudSaves(local, cloud);
  assert.equal(merged.progression.highestUnlockedLevel, 6);
  assert.ok(merged.collection.unlockedCharacters.includes('eddy-clash'));
  assert.ok(merged.collection.unlockedCharacters.includes('faye'));
  assert.equal(merged.performance.bestScoreByLevel.tutorial, 120000);
  assert.equal(merged.performance.bestComboByLevel['level-2-viko'], 51);
});

test('los rangos usan la prioridad real y no orden alfabético', () => {
  const left = createEmptyCloudSave();
  const right = createEmptyCloudSave();
  left.performance.bestRankByLevel.tutorial = 'VERTEBRAE_DELETED';
  right.performance.bestRankByLevel.tutorial = 'BASS_TRAFFICKER';
  assert.equal(
    mergeCloudSaves(left, right).performance.bestRankByLevel.tutorial,
    'VERTEBRAE_DELETED',
  );
});

test('attemptsByLevel conserva el máximo y no duplica intentos', () => {
  const left = createEmptyCloudSave();
  const right = createEmptyCloudSave();
  left.performance.attemptsByLevel.tutorial = 8;
  right.performance.attemptsByLevel.tutorial = 5;
  assert.equal(
    mergeCloudSaves(left, right).performance.attemptsByLevel.tutorial,
    8,
  );
});

test('newUnlockPending elimina secuencias ya vistas', () => {
  const left = createEmptyCloudSave();
  const right = createEmptyCloudSave();
  left.collection.newUnlockPending = ['faye', 'viko'];
  right.collection.characterUnlockSequenceViewed = ['faye'];
  assert.deepEqual(
    mergeCloudSaves(left, right).collection.newUnlockPending,
    ['viko'],
  );
});

test('personaje seleccionado inválido usa un inicial desbloqueado', () => {
  const local = createEmptyCloudSave();
  const cloud = createEmptyCloudSave();
  local.collection.unlockedCharacters = ['treze', 'henry'];
  local.player.selectedCharacter = 'missing-character';
  assert.equal(mergeCloudSaves(local, cloud).player.selectedCharacter, 'treze');
});

test('campos futuros sobreviven a la fusión', () => {
  const future = fixture('cloud-save-future-fields.json');
  const merged = mergeCloudSaves(createEmptyCloudSave(), future);
  assert.equal(merged.extensions.futureModule.signal, 'preserve-me');
  assert.deepEqual(merged.unknownLocalData.futureLocalField.nested, [
    'keep',
    'this',
  ]);
});

test('economy se conserva como dominio opaco y nunca se suma', () => {
  const local = createEmptyCloudSave();
  const cloud = createEmptyCloudSave();
  local.economy.balances = { protectedCurrency: 10 };
  assert.deepEqual(
    mergeCloudSaves(local, cloud).economy.balances,
    { protectedCurrency: 10 },
  );
  cloud.economy.balances = { protectedCurrency: 3 };
  assert.deepEqual(
    mergeCloudSaves(local, cloud).economy.balances,
    { protectedCurrency: 3 },
  );
});

test('los puntos se normalizan a valores no negativos', () => {
  const save = createEmptyCloudSave();
  save.economy.points = {
    total: -500,
    earnedByLevel: {
      tutorial: -20,
      'level-2-viko': 300,
    },
  };
  const normalized = normalizeCloudSave(save);
  assert.equal(normalized.economy.points.total, 0);
  assert.equal(
    normalized.economy.points.earnedByLevel.tutorial,
    undefined,
  );
  assert.equal(
    normalized.economy.points.earnedByLevel['level-2-viko'],
    300,
  );
});

test('los puntos usan máximo temporal y nunca se suman entre dispositivos', () => {
  const local = createEmptyCloudSave();
  const cloud = createEmptyCloudSave();
  local.economy.points = {
    total: 5000,
    earnedByLevel: { tutorial: 3000, 'level-2-viko': 2000 },
  };
  cloud.economy.points = {
    total: 4200,
    earnedByLevel: { tutorial: 3500, 'level-3-eddy-clash': 700 },
  };
  const merged = mergeCloudSaves(local, cloud);
  assert.equal(merged.economy.points.total, 5000);
  assert.deepEqual(merged.economy.points.earnedByLevel, {
    tutorial: 3500,
    'level-2-viko': 2000,
    'level-3-eddy-clash': 700,
  });
});

test('los logros se fusionan por ID con progreso máximo y primera fecha', () => {
  const local = createEmptyCloudSave();
  const cloud = createEmptyCloudSave();
  local.achievements = {
    'bass-initiate': {
      unlocked: false,
      progress: 4,
      target: 99,
      localNote: 'keep-local',
    },
  };
  cloud.achievements = {
    'bass-initiate': {
      unlocked: true,
      progress: 3,
      target: 50,
      unlockedAt: '2026-03-02T10:00:00.000Z',
      futureBadge: 'keep-cloud',
    },
    'future-achievement': {
      unlocked: true,
      progress: 8,
      target: 10,
      unlockedAt: '2026-02-01T10:00:00.000Z',
      futureField: { preserved: true },
    },
  };
  local.achievements['bass-initiate'].unlockedAt =
    '2026-03-01T10:00:00.000Z';

  const merged = mergeCloudSaves(local, cloud, {
    achievementTargets: { 'bass-initiate': 12 },
  });
  assert.deepEqual(
    {
      unlocked: merged.achievements['bass-initiate'].unlocked,
      progress: merged.achievements['bass-initiate'].progress,
      target: merged.achievements['bass-initiate'].target,
      unlockedAt: merged.achievements['bass-initiate'].unlockedAt,
    },
    {
      unlocked: true,
      progress: 4,
      target: 12,
      unlockedAt: '2026-03-01T10:00:00.000Z',
    },
  );
  assert.equal(
    merged.achievements['bass-initiate'].futureBadge,
    'keep-cloud',
  );
  assert.equal(
    merged.achievements['future-achievement'].target,
    10,
  );
  assert.deepEqual(
    merged.achievements['future-achievement'].futureField,
    { preserved: true },
  );
});

test('la fusión acumulativa es conmutativa', () => {
  const left = v017SaveAdapter.toCanonical(
    fixture('save-v017-advanced.json'),
  );
  const right = fixture('cloud-save-advanced.json');
  const ab = mergeCloudSaves(left, right);
  const ba = mergeCloudSaves(right, left);
  assert.deepEqual(ab.progression, ba.progression);
  assert.deepEqual(ab.collection, ba.collection);
  assert.deepEqual(ab.performance, ba.performance);
});

test('la fusión repetida es idempotente', () => {
  const left = v017SaveAdapter.toCanonical(
    fixture('save-v017-advanced.json'),
  );
  const right = fixture('cloud-save-advanced.json');
  const once = mergeCloudSaves(left, right);
  const twice = mergeCloudSaves(once, right);
  assert.deepEqual(twice.progression, once.progression);
  assert.deepEqual(twice.collection, once.collection);
  assert.deepEqual(twice.performance, once.performance);
});

test('rechaza saves superiores a 64 KB', () => {
  const save = createEmptyCloudSave();
  save.extensions.large = 'x'.repeat(HEADBANG_CLOUD_SAVE_MAX_BYTES);
  const validation = validateCloudSave(save);
  assert.equal(validation.valid, false);
  assert.equal(validation.errorCode, 'cloud_save_too_large');
});

test('rechaza claves peligrosas', () => {
  const save = JSON.parse(
    '{"cloudSchemaVersion":1,"extensions":{"__proto__":{"polluted":true}}}',
  );
  const validation = validateCloudSave(save);
  assert.equal(validation.valid, false);
  assert.equal(validation.errorCode, 'unsafe_cloud_save');
});

test('rechaza datos sensibles dentro del cloud save', () => {
  const save = createEmptyCloudSave();
  save.extensions.password = 'never-store-this';
  const validation = validateCloudSave(save);
  assert.equal(validation.valid, false);
  assert.equal(validation.errorCode, 'unsafe_cloud_save');
});

test('aplica V017 con backup, validación posterior y máximo cinco backups', () => {
  const storage = storageWith(
    V017_SAVE_KEY,
    fixture('save-v017-new.json'),
  );
  const canonical = v017SaveAdapter.toCanonical(
    fixture('save-v017-advanced.json'),
  );
  for (let index = 0; index < 7; index += 1) {
    const result = applyCanonicalSave({
      adapter: v017SaveAdapter,
      cloudSave: canonical,
      currentLocalSave: JSON.parse(storage.getItem(V017_SAVE_KEY)),
      localStorageKey: V017_SAVE_KEY,
      storage,
      requestReload: false,
    });
    assert.equal(result.success, true);
  }
  assert.equal(listLocalBackups(storage).length <= 5, true);
  assert.equal(
    JSON.parse(storage.getItem(V017_SAVE_KEY)).highestUnlockedLevel,
    5,
  );
});

test('previewSync distingue solo local, solo cloud, ambos y ninguno', async () => {
  const user = { id: '11111111-2222-4333-8444-555555555555' };
  const scenarios = [
    {
      local: fixture('save-v017-new.json'),
      cloud: null,
      expected: 'only_local',
    },
    {
      local: null,
      cloud: fixture('cloud-save-advanced.json'),
      expected: 'only_cloud',
    },
    {
      local: fixture('save-v017-new.json'),
      cloud: fixture('cloud-save-advanced.json'),
      expected: 'both',
    },
    { local: null, cloud: null, expected: 'none' },
  ];

  for (const scenario of scenarios) {
    const storage = new MemoryStorage();
    if (scenario.local) {
      storage.setItem(V017_SAVE_KEY, JSON.stringify(scenario.local));
    }
    const supabase = fakeSupabase({
      cloud_save: scenario.cloud ?? {},
      sync_revision: scenario.cloud ? 3 : 0,
      last_synced_at: null,
    });
    const coordinator = createSyncCoordinator({
      supabaseClient: supabase,
      getSession: async () => ({ user }),
      enabled: true,
      storage,
      online: () => true,
    });
    const preview = await coordinator.previewSync();
    assert.equal(preview.syncCase, scenario.expected);
  }
});

test('syncNow usa RPC con revisión esperada y solo la identidad autenticada', async () => {
  const storage = storageWith(
    V017_SAVE_KEY,
    fixture('save-v017-new.json'),
  );
  const supabase = fakeSupabase({
    cloud_save: {},
    sync_revision: 4,
    last_synced_at: null,
  });
  const coordinator = createSyncCoordinator({
    supabaseClient: supabase,
    getSession: async () => ({
      user: { id: '11111111-2222-4333-8444-555555555555' },
    }),
    enabled: true,
    storage,
    online: () => true,
  });
  const sync = await coordinator.syncNow({
    strategy: 'local',
    requestReload: false,
  });
  assert.equal(sync.success, true);
  assert.equal(supabase.rpcCalls.length, 1);
  assert.equal(supabase.rpcCalls[0].name, 'sync_headbang_cloud_save');
  assert.equal(
    supabase.rpcCalls[0].payload.p_expected_revision,
    4,
  );
  assert.equal('user_id' in supabase.rpcCalls[0].payload, false);
});

test('solo cloud puede crear el save local de la build activa', async () => {
  const storage = new MemoryStorage();
  const supabase = fakeSupabase({
    cloud_save: fixture('cloud-save-advanced.json'),
    sync_revision: 3,
    last_synced_at: '2026-07-29T12:00:00.000Z',
  });
  const coordinator = createSyncCoordinator({
    supabaseClient: supabase,
    getSession: async () => ({
      user: { id: '11111111-2222-4333-8444-555555555555' },
    }),
    enabled: true,
    storage,
    online: () => true,
  });
  const sync = await coordinator.syncNow({
    strategy: 'cloud',
    requestReload: false,
  });
  assert.equal(sync.success, true);
  assert.equal(
    JSON.parse(storage.getItem(V019_SAVE_KEY)).highestUnlockedLevel,
    6,
  );
});

test('un conflicto de revisión vuelve a leer, fusiona y reintenta de forma limitada', async () => {
  const storage = storageWith(
    V017_SAVE_KEY,
    fixture('save-v017-advanced.json'),
  );
  let reads = 0;
  let writes = 0;
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          reads += 1;
          return {
            data: {
              cloud_save: fixture('cloud-save-advanced.json'),
              sync_revision: reads === 1 ? 1 : 2,
              last_synced_at: null,
            },
            error: null,
          };
        },
      };
    },
    async rpc(_name, payload) {
      writes += 1;
      if (writes === 1) {
        return {
          data: null,
          error: { code: '40001', message: 'revision_conflict' },
        };
      }
      return {
        data: {
          sync_revision: payload.p_expected_revision + 1,
          last_synced_at: '2026-07-29T12:00:00.000Z',
        },
        error: null,
      };
    },
  };
  const coordinator = createSyncCoordinator({
    supabaseClient: supabase,
    getSession: async () => ({
      user: { id: '11111111-2222-4333-8444-555555555555' },
    }),
    enabled: true,
    storage,
    online: () => true,
  });
  const sync = await coordinator.syncNow({
    strategy: 'combine',
    requestReload: false,
  });
  assert.equal(sync.success, true);
  assert.equal(reads, 2);
  assert.equal(writes, 2);
  assert.equal(sync.revision, 3);
});

test('tras la primera sincronización los cambios pendientes se combinan sin volver a preguntar', async () => {
  const storage = storageWith(
    V017_SAVE_KEY,
    fixture('save-v017-advanced.json'),
  );
  storage.setItem(
    'headbang_cloud_sync_state',
    JSON.stringify({
      firstSyncComplete: true,
      pendingSync: true,
      cloudRevision: 3,
    }),
  );
  const supabase = fakeSupabase({
    cloud_save: fixture('cloud-save-advanced.json'),
    sync_revision: 3,
    last_synced_at: null,
  });
  const coordinator = createSyncCoordinator({
    supabaseClient: supabase,
    getSession: async () => ({
      user: { id: '11111111-2222-4333-8444-555555555555' },
    }),
    enabled: true,
    storage,
    online: () => true,
  });
  const sync = await coordinator.syncNow({
    automatic: true,
    requestReload: false,
  });
  assert.equal(sync.success, true);
  assert.equal(sync.strategy, 'combine');
  assert.equal(supabase.rpcCalls.length, 1);
});

test('un adaptador V018 simulado reutiliza el cloud schema sin cambiar Auth', () => {
  const v018Adapter = {
    ...v017SaveAdapter,
    id: 'test-v018',
    localStorageKeys: ['hd_bt_campaign_save_v018'],
    priority: 180,
    read(storage) {
      const serialized = storage.getItem(this.localStorageKeys[0]);
      return serialized ? JSON.parse(serialized) : null;
    },
    toCanonical(localSave) {
      const canonical = v017SaveAdapter.toCanonical(localSave);
      canonical.source = {
        adapterId: this.id,
        gameBuildVersion: 'V018',
        localSaveFormat: this.localStorageKeys[0],
      };
      return canonical;
    },
  };
  registerSaveAdapter(v018Adapter);
  const localV018 = {
    ...fixture('save-v017-new.json'),
    version: 'V018',
    v018OnlyField: { preserved: true },
  };
  const storage = storageWith('hd_bt_campaign_save_v018', localV018);
  const detection = detectActiveSaveAdapter(storage);
  const canonical = detection.adapter.toCanonical(detection.save);
  const restored = detection.adapter.fromCanonical(canonical, detection.save);
  assert.equal(detection.adapterId, 'test-v018');
  assert.equal(canonical.cloudSchemaVersion, 1);
  assert.deepEqual(restored.v018OnlyField, { preserved: true });
});

test('offline conserva local y marca sincronización pendiente', async () => {
  const storage = storageWith(
    V017_SAVE_KEY,
    fixture('save-v017-new.json'),
  );
  const coordinator = createSyncCoordinator({
    supabaseClient: fakeSupabase(),
    getSession: async () => ({
      user: { id: '11111111-2222-4333-8444-555555555555' },
    }),
    enabled: true,
    storage,
    online: () => false,
  });
  const sync = await coordinator.syncNow({
    strategy: 'local',
    requestReload: false,
  });
  assert.equal(sync.success, false);
  assert.equal(sync.errorCode, 'offline');
  assert.equal(coordinator.getSyncStatus().pendingSync, true);
  assert.ok(storage.getItem(V017_SAVE_KEY));
});
