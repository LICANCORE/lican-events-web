const BASE = "/headbangdealers_the_game/assets/story-levels";
const BEATMAPS_URL = `${BASE}/beatmaps.json`;

const LEVELS = Object.freeze({
  "story-henry-phase-1": { level: 2, artistId: "henryRituals", artistName: "HENRY RITUALS", trackTitle: "HENRY_LVL_1", audio: "track.wav", noTotem: true, noBeatmap: true, completeOnTrackEnd: true, backgroundSwapMs: 30000, actors: "door-bats" },
  "story-hydraxxx-phase-1": { level: 5, artistId: "hydraxxx", artistName: "HYDRAXXX", trackTitle: "HYDRAXXX_LVL_1", audio: "track.wav", actors: "arctic-fox", totemGroundOffset: 18 },
  "story-beutnoise-phase-1": { level: 6, artistId: "beutnoise", artistName: "BEUTNOISE", trackTitle: "BEUTNOISE_LVL_1", audio: "track.mp3" },
  "story-henry-phase-2": { level: 7, artistId: "henryRituals", artistName: "HENRY RITUALS", trackTitle: "HENRY_LVL_2", audio: "track.mp3", actors: "skeletons" },
  "story-hydraxxx-phase-2": { level: 10, artistId: "hydraxxx", artistName: "HYDRAXXX", trackTitle: "HYDRAXXX_LVL_2", audio: "track.wav" },
  "story-magic-bite": { level: 12, artistId: "magicBite", artistName: "MAGIC BITE", trackTitle: "WARRIOR", audio: "track.mp3" },
  "story-treze": { level: 13, artistId: "treze", artistName: "TREZE", trackTitle: "BASSQUAKE", audio: "track.wav" },
  "story-henry-phase-3": { level: 14, artistId: "henryRituals", artistName: "HENRY RITUALS", trackTitle: "HENRY_LVL_3", audio: "track.mp3", actors: "hurt-bats", screen404: true },
});

let scene = null;
let beatmaps = null;
let activeDefinition = null;
let loading = null;
let actors = [];
let timedSpawns = new Set();
let levelFlags = {};
let screen404 = null;

const actorUrl = (name) => `${BASE}/actors/${name}.webp`;
const levelUrl = (level, name) => `${BASE}/level-${level}/${name}`;
const textureKey = (level, kind) => `story-level-${level}-${kind}`;

function addAsset(loader, type, key, url) {
  if (type === "audio") {
    if (!scene.cache.audio.exists(key)) loader.audio(key, [url]);
  } else if (!scene.textures.exists(key)) loader.image(key, url);
}

async function loadAssets(definition) {
  const level = definition.level;
  const requests = [];
  if (!scene.textures.exists(textureKey(level, "background-desktop"))) {
    requests.push(["image", textureKey(level, "background-desktop"), levelUrl(level, "background.webp")]);
    requests.push(["image", textureKey(level, "background-mobile"), levelUrl(level, "background.webp")]);
  }
  if (level === 2 && !scene.textures.exists(textureKey(level, "background-open"))) {
    requests.push(["image", textureKey(level, "background-open"), levelUrl(level, "background-2.webp")]);
  }
  if (!definition.noTotem) {
    for (const damage of [0, 25, 50, 75, 100]) {
      requests.push(["image", textureKey(level, `totem-${damage}`), levelUrl(level, `totem-${damage}.webp`)]);
    }
  }
  requests.push(["audio", `track-story-level-${level}`, levelUrl(level, definition.audio)]);
  for (let index = 1; index <= 4; index += 1) {
    requests.push(["image", `story-bat-${index}`, actorUrl(`bat-${index}`)]);
    requests.push(["image", `story-skeleton-${index}`, actorUrl(`skeleton-${index}`)]);
  }
  requests.push(["image", "story-arctic-fox", actorUrl("arctic-fox")]);
  for (let index = 1; index <= 4; index += 1) {
    requests.push(["image", `story-fox-groom-${index}`, actorUrl(`arctic-fox-groom-${index}`)]);
    requests.push(["image", `story-riot-charge-${index}`, actorUrl(`riot-charge-${index}`)]);
  }
  requests.push(["image", "story-bone-pile", actorUrl("bone-pile")]);
  requests.push(["image", "story-fallen-bat", actorUrl("fallen-bat")]);
  requests.push(["image", "story-riot-defeated", actorUrl("riot-defeated")]);
  requests.push(["image", "story-razor-wire", actorUrl("razor-wire")]);
  const missing = requests.filter(([type, key]) => type === "audio" ? !scene.cache.audio.exists(key) : !scene.textures.exists(key));
  if (!missing.length) return;
  await new Promise((resolve, reject) => {
    const failed = [];
    const onError = (file) => failed.push(file?.key ?? "unknown");
    scene.load.on("loaderror", onError);
    scene.load.once("complete", () => {
      scene.load.off("loaderror", onError);
      if (failed.length) reject(new Error(`Assets no cargados: ${failed.join(", ")}`));
      else resolve();
    });
    for (const request of missing) addAsset(scene.load, ...request);
    if (!scene.load.isLoading()) scene.load.start();
  });
}

async function loadFeatureAssets() {
  const requests = [];
  for (let index = 1; index <= 4; index += 1) {
    requests.push(["image", `story-riot-charge-${index}`, actorUrl(`riot-charge-${index}`)]);
  }
  requests.push(["image", "story-riot-defeated", actorUrl("riot-defeated")]);
  requests.push(["image", "story-razor-wire", actorUrl("razor-wire")]);
  const missing = requests.filter(([, key]) => !scene.textures.exists(key));
  if (!missing.length) return;
  await new Promise((resolve, reject) => {
    const failed = [];
    const onError = (file) => failed.push(file?.key ?? "unknown");
    scene.load.on("loaderror", onError);
    scene.load.once("complete", () => {
      scene.load.off("loaderror", onError);
      if (failed.length) reject(new Error(`Assets no cargados: ${failed.join(", ")}`));
      else resolve();
    });
    for (const request of missing) addAsset(scene.load, ...request);
    if (!scene.load.isLoading()) scene.load.start();
  });
}

function destroyActor(actor) {
  if (!actor) return;
  actor.sprite?.destroy();
  actors = actors.filter((candidate) => candidate !== actor);
}

function clearRuntimeActors() {
  for (const actor of actors) actor.sprite?.destroy();
  actors = [];
  timedSpawns = new Set();
  levelFlags = {};
  screen404?.destroy();
  screen404 = null;
}

function fitSprite(sprite, height) {
  const source = sprite.texture.getSourceImage();
  const ratio = source.width / source.height;
  sprite.setDisplaySize(height * ratio, height);
  return sprite;
}

function floorY() {
  return scene.characterBaseY ?? scene.layout?.character?.y ?? 620;
}

function spawnBat({ x, y, vx, vy, harmful = false, damage = 0, scale = 1 }) {
  const sprite = fitSprite(scene.add.image(x, y, "story-bat-1").setDepth(5.2), (scene.layout?.height ?? 720) * .105 * scale);
  sprite.setFlipX(vx > 0);
  const actor = { kind: "bat", sprite, vx, vy, harmful, damage, alive: true, frame: 0, animationMs: 0 };
  actors.push(actor);
  return actor;
}

function spawnSkeleton(index) {
  const width = scene.layout.width;
  const direction = index % 3 === 2 ? 1 : -1;
  const sprite = fitSprite(scene.add.image(direction < 0 ? width + 70 : -70, floorY(), "story-skeleton-1")
    .setOrigin(.5, .94).setDepth(3.7).setFlipX(direction < 0), scene.layout.height * .27);
  actors.push({ kind: "skeleton", sprite, vx: direction * (42 + index % 3 * 7), vy: 0, harmful: true, damage: 15, alive: true, frame: 0, animationMs: 0 });
}

function spawnFox() {
  const sprite = fitSprite(scene.add.image(scene.layout.width * .84, floorY() + 4, "story-fox-groom-1")
    .setOrigin(.5, .97).setDepth(2.8).setFlipX(false), scene.layout.height * .155);
  actors.push({ kind: "fox", sprite, vx: 0, vy: 0, harmful: false, alive: true, frame: 0, animationMs: 0 });
}

function spawnRazorWire(index) {
  const fromLeft = index % 2 === 0;
  const sprite = fitSprite(scene.add.image(fromLeft ? -80 : scene.layout.width + 80, floorY() + 6, "story-razor-wire")
    .setOrigin(.5, 1).setDepth(3.5), scene.layout.height * .14);
  actors.push({ kind: "razor", sprite, vx: fromLeft ? 88 : -88, vy: 0, harmful: true, damage: 15, alive: true, frame: 0, animationMs: 0 });
}

function spawnRiot(index) {
  const sprite = fitSprite(scene.add.image(scene.layout.width + 90, floorY() + 4, "story-riot-charge-1")
    .setOrigin(.5, .98).setDepth(3.7).setFlipX(false), scene.layout.height * .255);
  actors.push({ kind: "riot", sprite, vx: -(50 + index % 3 * 8), vy: 0, harmful: true, damage: 20, alive: true, frame: 0, animationMs: 0 });
}

function fallActor(actor) {
  actor.alive = false;
  actor.harmful = false;
  actor.vx = 0;
  actor.vy = 0;
  actor.sprite.setTexture(actor.kind === "skeleton" ? "story-bone-pile" : actor.kind === "riot" ? "story-riot-defeated" : "story-fallen-bat");
  fitSprite(actor.sprite, scene.layout.height * (actor.kind === "skeleton" ? .0525 : actor.kind === "riot" ? .11 : .045));
  actor.sprite.setOrigin(.5, 1).setPosition(actor.sprite.x, floorY() + 4).setDepth(3.1).setFlipX(false);
  scene.spawnPixelBurst?.(actor.sprite.x, actor.sprite.y - 25, 0x55ff00, 8);
  scene.playSfx?.("sfx-heavy", .3);
}

function handleAttack() {
  if (!activeDefinition || scene?.mode !== "playing") return;
  const target = actors
    .filter((actor) => actor.alive && (actor.kind === "skeleton" || actor.kind === "riot" || (actor.kind === "bat" && actor.harmful)))
    .filter((actor) => Math.abs(actor.sprite.x - scene.character.x) <= Math.max(120, scene.layout.width * .105))
    .sort((a, b) => Math.abs(a.sprite.x - scene.character.x) - Math.abs(b.sprite.x - scene.character.x))[0];
  if (target) fallActor(target);
}

function hurtPlayer(actor) {
  actor.harmful = false;
  scene.run.neck = Math.min(100, scene.run.neck + actor.damage);
  scene.showFeedback?.(`HURT +${actor.damage}%`);
  scene.playSfx?.("sfx-miss", .55);
  scene.spawnPixelBurst?.(scene.character.x, scene.character.y - 55, 0xff3b30, 10);
  destroyActor(actor);
  if (scene.run.neck >= 100) scene.triggerVertebraeFailure?.();
}

function spawnScheduledActors(songMs) {
  const level = activeDefinition.level;
  if (level === 2 && songMs >= 30000 && !levelFlags.doorOpened) {
    levelFlags.doorOpened = true;
    scene.background?.setTexture(textureKey(2, "background-open"));
    scene.applyLevelWorldTextures?.();
    scene.background?.setTexture(textureKey(2, "background-open"));
    const cx = scene.layout.width * .5;
    const cy = scene.layout.height * .42;
    for (let index = 0; index < 28; index += 1) {
      const angle = (Math.PI * 2 * index / 28) + (index % 4) * .07;
      const speed = 90 + (index % 6) * 18;
      spawnBat({ x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, scale: .65 + index % 3 * .12 });
    }
  }
  if (level === 5 && !actors.some((actor) => actor.kind === "fox" && actor.sprite.x > -120)) spawnFox();
  if (level === 7) {
    const skeletonTimes = [8500, 19000, 30500, 42500, 55500, 68500, 81500, 95500, 108000];
    skeletonTimes.forEach((time, index) => {
      const id = `skeleton-${index}`;
      if (songMs >= time && !timedSpawns.has(id)) { timedSpawns.add(id); spawnSkeleton(index); }
    });
    [15000, 37000, 61000, 89000, 103000].forEach((time, index) => {
      const id = `ambient-bat-${index}`;
      if (songMs >= time && !timedSpawns.has(id)) {
        timedSpawns.add(id);
        const fromLeft = index % 2 === 0;
        spawnBat({ x: fromLeft ? -60 : scene.layout.width + 60, y: scene.layout.height * (.22 + index % 3 * .11), vx: fromLeft ? 105 : -105, vy: index % 2 ? 12 : -8, scale: .72 });
      }
    });
  }
  if (level === 8) {
    [9000, 22000, 36000, 51000, 67000, 82000].forEach((time, index) => {
      const id = `razor-${index}`;
      if (songMs >= time && !timedSpawns.has(id)) { timedSpawns.add(id); spawnRazorWire(index); }
    });
  }
  if (level === 9) {
    [8000, 23500, 39000, 54500, 70000, 84500].forEach((time, index) => {
      const id = `riot-${index}`;
      if (songMs >= time && !timedSpawns.has(id)) { timedSpawns.add(id); spawnRiot(index); }
    });
  }
  if (level === 14) {
    for (let index = 0; index < 14; index += 1) {
      const time = 5200 + index * 5850;
      const id = `hurt-bat-${index}`;
      if (songMs >= time && !timedSpawns.has(id)) {
        timedSpawns.add(id);
        const side = index % 4;
        const x = side === 0 ? -55 : side === 1 ? scene.layout.width + 55 : scene.layout.width * (.18 + index % 5 * .16);
        const y = side === 2 ? -45 : side === 3 ? scene.layout.height + 45 : scene.layout.height * (.18 + index % 4 * .12);
        const targetX = scene.character.x + (index % 3 - 1) * 35;
        const targetY = scene.character.y - 45;
        const distance = Math.hypot(targetX - x, targetY - y) || 1;
        const speed = 105 + index % 4 * 12;
        spawnBat({ x, y, vx: (targetX - x) / distance * speed, vy: (targetY - y) / distance * speed, harmful: true, damage: 10, scale: .78 });
      }
    }
  }
}

function updateActors(_time, delta = 16) {
  if (!activeDefinition || scene.mode !== "playing" || !scene.run) return;
  const songMs = Math.max(0, scene.getSongMs?.() ?? 0);
  spawnScheduledActors(songMs);
  const seconds = Math.min(delta, 50) / 1000;
  for (const actor of [...actors]) {
    if (!actor.sprite?.active || !actor.alive) continue;
    actor.sprite.x += actor.vx * seconds;
    actor.sprite.y += actor.vy * seconds;
    actor.animationMs += delta;
    if (actor.animationMs > 115) {
      actor.animationMs = 0;
      actor.frame = (actor.frame + 1) % 4;
      if (actor.kind === "bat") actor.sprite.setTexture(`story-bat-${actor.frame + 1}`);
      if (actor.kind === "skeleton") actor.sprite.setTexture(`story-skeleton-${actor.frame + 1}`);
      if (actor.kind === "fox") actor.sprite.setTexture(`story-fox-groom-${actor.frame + 1}`);
      if (actor.kind === "riot") actor.sprite.setTexture(`story-riot-charge-${actor.frame + 1}`);
    }
    if (actor.kind === "bat") actor.sprite.setAngle(Math.sin(songMs / 160 + actor.frame) * 4);
    if (actor.kind === "razor") actor.sprite.setAngle(actor.sprite.angle + delta * .08);
    if (actor.harmful && Math.abs(actor.sprite.x - scene.character.x) < 58 && Math.abs(actor.sprite.y - (scene.character.y - 45)) < 82) hurtPlayer(actor);
    if (actor.sprite.x < -180 || actor.sprite.x > scene.layout.width + 180 || actor.sprite.y < -160 || actor.sprite.y > scene.layout.height + 160) destroyActor(actor);
  }
  if (screen404) {
    screen404.setPosition(scene.layout.width * .43, scene.layout.height * .315)
      .setFontSize(Math.max(14, Math.round(scene.layout.height * .035)))
      .setAlpha(Math.floor(songMs / 330) % 3 === 0 ? .18 : .94)
      .setVisible(scene.mode === "playing");
  }
}

function patchScene(candidate) {
  scene = candidate;
  if (scene.__storyLevelsRuntimePatched) return;
  scene.__storyLevelsRuntimePatched = true;
  scene.__storyMasterPenTextureKey ??= scene.activeLevel?.usbKey;
  const originalActiveGroundY = scene.activeGroundY.bind(scene);
  scene.activeGroundY = () => {
    if (activeDefinition?.level === 6 && scene.layout.width < scene.layout.height) {
      return Math.round(scene.layout.height * .685);
    }
    const ground = originalActiveGroundY();
    return activeDefinition?.level === 13 ? ground + 6 : ground;
  };
  const originalResetRun = scene.resetRun.bind(scene);
  scene.resetRun = () => {
    clearRuntimeActors();
    originalResetRun();
    if (activeDefinition?.noTotem) scene.levelDamageScale = 0;
    if (activeDefinition?.screen404) {
      screen404 = scene.add.text(scene.layout.width * .43, scene.layout.height * .315, "404 NOT FOUND", {
        fontFamily: "monospace", fontStyle: "bold", color: "#55ff00", stroke: "#020403", strokeThickness: 4,
      }).setOrigin(.5).setDepth(2.5);
    }
  };
  const originalApplyTextures = scene.applyLevelWorldTextures.bind(scene);
  scene.applyLevelWorldTextures = () => {
    originalApplyTextures();
    if (activeDefinition?.noTotem) scene.totem?.setVisible(false);
    else scene.totem?.setVisible(true);
    if (activeDefinition?.totemGroundOffset && scene.totem) scene.totem.y = floorY() + activeDefinition.totemGroundOffset;
    if (activeDefinition?.level === 2 && levelFlags.doorOpened) scene.background?.setTexture(textureKey(2, "background-open"));
    if (activeDefinition?.level === 6) {
      if (scene.layout.width >= scene.layout.height && scene.background) {
        const source = scene.background.texture.getSourceImage();
        scene.background.y = scene.characterBaseY - source.height * .685 * scene.background.scaleY;
      }
      scene.ambientKind = "level-4-beutnoise";
      if (!scene.ambientRabbitsRevealed) {
        const foliagePositions = [
          [.18, 118], [.28, 90], [.38, 145], [.49, 132], [.60, 104], [.70, 155],
        ];
        scene.ambientEyes?.forEach((eye, index) => {
          const size = scene.layout.width >= scene.layout.height ? 76 : 112;
          const source = eye.texture.getSourceImage();
          eye.setPosition(
            scene.layout.width * foliagePositions[index][0],
            scene.characterBaseY - foliagePositions[index][1] * (scene.layout.width >= scene.layout.height ? 1 : 1.42),
          ).setDisplaySize(size, size * source.height / source.width)
            .setVisible(true).setAlpha(1).setData("phase", index * 1.17).setDepth(2.35);
        });
      }
    }
  };
  const originalPlayHeadbang = scene.playHeadbang.bind(scene);
  scene.playHeadbang = (...args) => {
    handleAttack();
    return originalPlayHeadbang(...args);
  };
  const originalUpdateWorldItems = scene.updateWorldItems?.bind(scene);
  if (originalUpdateWorldItems) scene.updateWorldItems = (...args) => {
    if (activeDefinition?.level === 2) {
      scene.hurtObject?.setVisible(false);
      scene.healthObject?.setVisible(false);
      return;
    }
    return originalUpdateWorldItems(...args);
  };
  const originalBeginResolution = scene.beginResolution.bind(scene);
  scene.beginResolution = () => {
    if (activeDefinition?.completeOnTrackEnd && scene.mode === "playing") {
      scene.mode = "story-track-complete";
      scene.run.destroyed = false;
      scene.run.levelCompleted = true;
      scene.stopMusic?.();
      scene.guide?.clear();
      for (const icon of scene.beatIcons ?? []) icon.setVisible(false);
      window.setTimeout(() => scene.showResults(true), 450);
      return;
    }
    originalBeginResolution();
  };
  const originalDrawBeatGuide = scene.drawBeatGuide?.bind(scene);
  if (originalDrawBeatGuide) scene.drawBeatGuide = (...args) => {
    if (activeDefinition?.noBeatmap) {
      scene.guide?.clear();
      for (const icon of scene.beatIcons ?? []) icon.setVisible(false);
      return;
    }
    return originalDrawBeatGuide(...args);
  };
  const originalReturnToMenu = scene.returnToMenu.bind(scene);
  scene.returnToMenu = (...args) => {
    clearRuntimeActors();
    activeDefinition = null;
    return originalReturnToMenu(...args);
  };
  scene.events.on("update", updateActors);
}

async function activate(engineLevelId) {
  const definition = LEVELS[engineLevelId];
  if (!definition) return false;
  if (!scene) throw new Error("La escena del juego todavía no está preparada");
  if (!beatmaps) beatmaps = await fetch(BEATMAPS_URL, { cache: "no-store" }).then((response) => response.json());
  await loadAssets(definition);
  clearRuntimeActors();
  activeDefinition = definition;
  const level = definition.level;
  const map = structuredClone(beatmaps.levels[String(level)]);
  if (definition.noBeatmap) map.events = [];
  map.events = map.events.map((event) => ({ ...event, id: `STORY_L${level}_${event.id}` }));
  scene.selectedLevelId = engineLevelId;
  scene.selectedSong = `story-level-${level}`;
  scene.beatmap = map;
  scene.configData.session.musicMs = map.audioDurationMs;
  scene.activeLevel = {
    id: engineLevelId,
    index: level,
    artistId: definition.artistId,
    artistName: definition.artistName,
    trackTitle: definition.trackTitle,
    songId: `story-level-${level}`,
    audioKey: `track-story-level-${level}`,
    beatmapKey: `story-level-${level}`,
    backgroundKey: textureKey(level, "background"),
    totemKey: textureKey(level, "totem"),
    usbKey: scene.__storyMasterPenTextureKey ?? scene.activeLevel?.usbKey,
    instagramUrl: null,
    tutorial: false,
    finalLevel: false,
    assetMissing: false,
    musicPending: false,
  };
  scene.updateLevelCopy?.(scene.activeLevel);
  scene.resetRun();
  scene.applyLevelWorldTextures?.();
  scene.updateCampaignUi?.();
  scene.fitAdaptiveText?.();
  const totemPanel = document.getElementById("totem-value")?.closest(".hud-stat, .hud-panel, .hud__stat")
    ?? document.getElementById("totem-value")?.parentElement;
  if (totemPanel) totemPanel.style.visibility = definition.noTotem ? "hidden" : "";
  return true;
}

function deactivate() {
  clearRuntimeActors();
  activeDefinition = null;
  scene?.totem?.setVisible(true);
  const totemPanel = document.getElementById("totem-value")?.closest(".hud-stat, .hud-panel, .hud__stat")
    ?? document.getElementById("totem-value")?.parentElement;
  if (totemPanel) totemPanel.style.visibility = "";
}

async function activateFeatures(level) {
  if (![8, 9].includes(Number(level))) return false;
  await loadFeatureAssets();
  clearRuntimeActors();
  activeDefinition = { level: Number(level), nativeFeatures: true };
  return true;
}

async function applyNativeBeatmap(level) {
  if (Number(level) !== 1 || !scene) return false;
  if (!beatmaps) beatmaps = await fetch(BEATMAPS_URL, { cache: "no-store" }).then((response) => response.json());
  const map = structuredClone(beatmaps.levels["1"]);
  map.events = map.events.map((event) => ({ ...event, id: `STORY_L1_${event.id}` }));
  scene.beatmap = map;
  scene.configData.session.musicMs = map.audioDurationMs;
  scene.resetRun();
  return true;
}

function enhanceNativeLevel(level) {
  if (Number(level) !== 8 || !scene?.beatmap?.events?.length) return false;
  const map = structuredClone(scene.beatmap);
  const duration = Number(map.audioDurationMs ?? scene.configData.session.musicMs);
  const bpm = Number(map.bpm) || 140;
  const beatMs = 60000 / bpm;
  const start = Math.max(0, duration - 10000);
  const previous = [...map.events].reverse().find((event) => event.timeMs < start);
  const anchor = previous?.timeMs ?? map.events[0].timeMs;
  let time = anchor + Math.ceil((start - anchor) / beatMs) * beatMs;
  let added = 0;
  while (time < duration - 220) {
    const hasBeat = map.events.some((event) => Math.abs(event.timeMs - time) < beatMs * .28);
    if (!hasBeat) {
      map.events.push({
        id: `STORY_L8_FINAL_BASS_${String(++added).padStart(2, "0")}`,
        timeMs: Math.round(time),
        hitType: added % 4 === 0 ? "ACCENT" : "SYNCOPATED",
        baseDamageScalar: added % 4 === 0 ? 1.25 : 1.1,
        chargesBassMeter: true,
      });
    }
    time += beatMs;
  }
  map.events.sort((a, b) => a.timeMs - b.timeMs);
  scene.beatmap = map;
  scene.resetRun();
  return added > 0;
}

async function initialize() {
  if (loading) return loading;
  loading = fetch(BEATMAPS_URL, { cache: "no-store" }).then((response) => response.json()).then((data) => { beatmaps = data; });
  await loading;
  const waitForScene = () => {
    const candidate = window.__HEADBANG_GAME__?.scene?.getScenes?.(false)?.find((entry) => entry.initialPreloadComplete && entry.resetRun);
    if (candidate) patchScene(candidate);
    else window.setTimeout(waitForScene, 50);
  };
  waitForScene();
}

window.HeadbangStoryLevels = Object.freeze({
  has: (engineLevelId) => Boolean(LEVELS[engineLevelId]),
  activate,
  deactivate,
  activateFeatures,
  applyNativeBeatmap,
  enhanceNativeLevel,
  getDefinition: (engineLevelId) => structuredClone(LEVELS[engineLevelId] ?? null),
  getActiveDefinition: () => structuredClone(activeDefinition),
  getActorSummary: () => actors.map((actor) => ({ kind: actor.kind, alive: actor.alive, harmful: actor.harmful })),
});

initialize().catch((error) => console.error("[StoryLevels]", error));
