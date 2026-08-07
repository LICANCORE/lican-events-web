import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const campaignUrl = new URL(
  '../../public/headbangdealers_the_game/assets/data/story-campaign-v2.json',
  import.meta.url,
);

test('Modo Historia contiene exactamente 15 niveles consecutivos', async () => {
  const campaign = JSON.parse(await readFile(campaignUrl, 'utf8'));
  assert.equal(campaign.totalLevels, 15);
  assert.equal(campaign.levels.length, 15);
  assert.deepEqual(
    campaign.levels.map((level) => level.storyOrder),
    Array.from({ length: 15 }, (_, index) => index + 1),
  );
});

test('QVEENS solo ocupa el nivel 11 y los niveles finales están desplazados', async () => {
  const { levels } = JSON.parse(await readFile(campaignUrl, 'utf8'));
  assert.deepEqual(
    levels.filter((level) => level.title === 'QVEENS').map((level) => level.storyOrder),
    [11],
  );
  assert.equal(levels[13].title, 'HENRY RITUALS');
  assert.equal(levels[13].phase, 3);
  assert.equal(levels[14].title, 'DAVID NEON');
});

test('THE SIBERIAN no es personaje y HYDRAXXX usa ya su escenario definitivo', async () => {
  const { levels } = JSON.parse(await readFile(campaignUrl, 'utf8'));
  assert.equal(levels.some((level) => level.artistId === 'theSiberian'), false);
  const hydraPhaseOne = levels.find(
    (level) => level.artistId === 'hydraxxx' && level.phase === 1,
  );
  assert.equal(hydraPhaseOne.storyOrder, 5);
  assert.equal(hydraPhaseOne.engineLevelId, 'story-hydraxxx-phase-1');
  assert.match(hydraPhaseOne.preview, /story-levels\/level-5\/background\.webp$/);
});

test('cada recompensa USB usa un asset personalizado y existente', async () => {
  const { levels } = JSON.parse(await readFile(campaignUrl, 'utf8'));
  const usbRewards = levels
    .filter((level) => level.reward.type === 'character-usb')
    .map((level) => level.reward);

  assert.equal(usbRewards.length, 11);
  assert.equal(new Set(usbRewards.map((reward) => reward.asset)).size, 11);
  for (const reward of usbRewards) {
    assert.match(reward.asset, /\/assets\/items\/usb\/story\/HD_BT_USB_STORY_.+_v001\.png$/);
    const diskPath = new URL(`../../public${reward.asset}`, import.meta.url);
    await access(diskPath);
    const png = await readFile(diskPath);
    assert.equal(png.readUInt32BE(16), 1536);
    assert.equal(png.readUInt32BE(20), 1024);
    assert.equal(png[25], 6, 'el PNG debe usar color RGBA con canal alfa');
  }
});

test('los nombres, enlaces y desbloqueos revisados quedan vinculados al nivel correcto', async () => {
  const { levels } = JSON.parse(await readFile(campaignUrl, 'utf8'));
  assert.deepEqual(levels.map((level) => level.levelName), [
    'El Último Altavoz', 'El Santuario', 'Carrera sin fin', 'Cómprate una Personalidad',
    'El Protector de EL ALGORITMO', 'Todas las Conspiraciones Eran Ciertas',
    'La Cripta de los Arquitectos', 'Nadie Cruza Entero', 'El Pueblo Sube el Volumen',
    'Así nos Mienten', 'Realmente nada nuevo', 'Pass Next Soul', 'Estaba Escrito',
    'La Muerte del Ego', 'The Last Drop?',
  ]);
  assert.equal(levels.slice(0, 14).every((level) => /^https:\/\//.test(level.listenUrl)), true);
  assert.equal(levels[13].reward.characterId, 'henryRituals');
});

test('los siete niveles nuevos tienen beatmap, cortes y estados de tótem válidos', async () => {
  const beatmapsUrl = new URL(
    '../../public/headbangdealers_the_game/assets/story-levels/beatmaps.json',
    import.meta.url,
  );
  const beatmaps = JSON.parse(await readFile(beatmapsUrl, 'utf8')).levels;
  const expectedCuts = {
    2: [0, 61], 6: [24, 114], 7: [26, 144], 10: [97, 181], 12: [25, 143], 13: [85, 165], 14: [70, 161],
  };
  for (const level of [1, 2, 5, 6, 7, 10, 12, 13, 14]) {
    const map = beatmaps[level];
    assert.ok(map.bpm > 0);
    assert.ok(map.events.length >= 45 && map.events.length <= 80);
    assert.ok(map.sourceEndSec - map.sourceStartSec > (level === 1 ? 55 : level === 2 ? 60 : 79));
    if (expectedCuts[level]) assert.deepEqual([map.sourceStartSec, map.sourceEndSec], expectedCuts[level]);
    if (![1, 2].includes(level)) {
      for (const damage of [0, 25, 50, 75, 100]) {
        await access(new URL(
          `../../public/headbangdealers_the_game/assets/story-levels/level-${level}/totem-${damage}.webp`,
          import.meta.url,
        ));
      }
    }
  }
});
