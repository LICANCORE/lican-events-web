const STORY_SAVE_KEY = "hd_bt_story_progress_v2";
const ENGINE_SAVE_KEY = "hd_bt_campaign_save_v019";
const REMOVED_CHARACTER = "theSiberian";
const MASTER_PEN_ASSET = "/headbangdealers_the_game/assets/campaign/master-usb/HD_BT_MASTER_USB_v016.webp";
const CONFIG_URL = "/headbangdealers_the_game/assets/data/story-campaign-v2.json";
const VALID_CHARACTERS = new Set([
  "treze", "hydraxxx", "henryRituals", "frankale", "viko", "eddyClash",
  "beutnoise", "onionstep", "qveens", "faye", "magicBite", "davidNeon",
]);

let config;
let scene;
let currentMode = "story";
let progress;

function unique(values) {
  return [...new Set(Array.isArray(values) ? values.filter(Boolean) : [])];
}

function defaultProgress() {
  return {
    version: 2,
    highestUnlockedLevel: 1,
    completedLevels: [],
    devCompletedLevels: [],
    generatedRewards: [],
    collectedUsbIds: [],
    collectedRewardLevelIds: [],
    unlockedCharacters: ["treze"],
    masterPens: 0,
    freeModeStarterMasterPenGranted: false,
  };
}

function migrateStoryProgress(raw) {
  const next = defaultProgress();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return next;

  const sourceLists = [
    raw.completedLevels,
    raw.devCompletedLevels,
    raw.generatedRewards,
    raw.collectedRewardLevelIds,
  ].flatMap((value) => (Array.isArray(value) ? value : []));
  const oldHighest = Math.max(1, Math.floor(Number(raw.highestUnlockedLevel) || 1));
  const legacySixteenLevelCampaign = Number(raw.version) < 2
    || oldHighest > 15
    || sourceLists.includes("story-level-16");
  const remapLegacyLevel = (id) => {
    if (legacySixteenLevelCampaign && id === "story-level-14") return null;
    if (legacySixteenLevelCampaign && id === "story-level-15") return "story-level-14";
    if (legacySixteenLevelCampaign && id === "story-level-16") return "story-level-15";
    return /^story-level-(0[1-9]|1[0-5])$/.test(id) ? id : null;
  };
  const remapList = (values) => unique(
    (Array.isArray(values) ? values : []).map(remapLegacyLevel).filter(Boolean),
  );
  next.highestUnlockedLevel = Math.min(
    15,
    legacySixteenLevelCampaign && oldHighest >= 15 ? oldHighest - 1 : oldHighest,
  );
  next.completedLevels = remapList(raw.completedLevels ?? []);
  next.devCompletedLevels = remapList(raw.devCompletedLevels ?? []);
  next.generatedRewards = remapList(raw.generatedRewards ?? []);
  next.collectedRewardLevelIds = remapList(raw.collectedRewardLevelIds ?? []);
  next.collectedUsbIds = unique(raw.collectedUsbIds ?? raw.collectedUsb ?? []).filter(
    (id) => !String(id).toLowerCase().includes("siberian"),
  );
  next.unlockedCharacters = unique(["treze", ...(raw.unlockedCharacters ?? [])])
    .filter((id) => VALID_CHARACTERS.has(id));
  next.masterPens = Math.max(0, Math.floor(Number(raw.masterPens) || 0));
  next.freeModeStarterMasterPenGranted = raw.freeModeStarterMasterPenGranted === true;
  return next;
}

function loadProgress() {
  try {
    return migrateStoryProgress(JSON.parse(localStorage.getItem(STORY_SAVE_KEY) || "null"));
  } catch {
    return defaultProgress();
  }
}

function saveProgress() {
  localStorage.setItem(STORY_SAVE_KEY, JSON.stringify(progress));
  syncCharactersToEngine();
  updateCounters();
}

function grantStarterMasterPen() {
  if (!progress.freeModeStarterMasterPenGranted) {
    progress.freeModeStarterMasterPenGranted = true;
    progress.masterPens += 1;
  }
  if (scene?.campaignSave) {
    scene.campaignSave.introMasterUsbCollected = true;
    scene.campaignSave.masterUsbCount = Math.max(1, Number(scene.campaignSave.masterUsbCount) || 0);
    scene.writeCampaignSave?.();
  }
  saveProgress();
}

function sanitizeEngineSave() {
  let save;
  try {
    save = JSON.parse(localStorage.getItem(ENGINE_SAVE_KEY) || "null");
  } catch {
    return;
  }
  if (!save || typeof save !== "object") return;
  for (const field of ["unlockedCharacters", "characterUnlockSequenceViewed", "newUnlockPending"]) {
    save[field] = unique(save[field] ?? []).filter((id) => id !== REMOVED_CHARACTER);
  }
  save.unlockedCharacters = unique(["treze", ...save.unlockedCharacters]);
  if (save.selectedCharacter === REMOVED_CHARACTER) save.selectedCharacter = "treze";
  localStorage.setItem(ENGINE_SAVE_KEY, JSON.stringify(save));
  if (localStorage.getItem("hd_bt_selected_character_v005") === REMOVED_CHARACTER) {
    localStorage.setItem("hd_bt_selected_character_v005", "treze");
  }
}

function syncCharactersToEngine() {
  if (!scene?.campaignSave) return;
  scene.campaignSave.unlockedCharacters = unique([
    "treze",
    ...scene.campaignSave.unlockedCharacters,
    ...progress.unlockedCharacters,
  ]).filter((id) => VALID_CHARACTERS.has(id));
  for (const field of ["characterUnlockSequenceViewed", "newUnlockPending"]) {
    scene.campaignSave[field] = unique(scene.campaignSave[field] ?? [])
      .filter((id) => VALID_CHARACTERS.has(id));
  }
  if (!VALID_CHARACTERS.has(scene.selectedCharacter)) {
    scene.selectedCharacter = "treze";
    scene.campaignSave.selectedCharacter = "treze";
  }
  scene.writeCampaignSave?.();
}

function isStoryUnlocked(level) {
  return level.storyOrder <= progress.highestUnlockedLevel;
}

function levelPhase(level) {
  return level.phase > 1 ? ` · FASE ${level.phase}` : "";
}

function storyUsbTextureKey(level) {
  return `story-usb-${level.reward.itemId}`;
}

function registerStoryUsbAssets() {
  const usbLevels = config.levels.filter(
    (level) => level.reward.type === "character-usb" && level.reward.asset,
  );
  for (const level of usbLevels) {
    const unlockSequence = scene.unlockManifest?.sequences?.[level.reward.characterId];
    if (unlockSequence) unlockSequence.usb = level.reward.asset;
  }
}

function ensureStoryUsbTexture(level) {
  const key = storyUsbTextureKey(level);
  if (!scene.textures.exists(key)) {
    scene.load.image(key, level.reward.asset);
    if (!scene.load.isLoading()) scene.load.start();
  }
}

function cardPreview(level) {
  if (!level.preview) return `<span class="story-placeholder-art">SEÑAL<br>PENDIENTE</span>`;
  return `<img class="level-card__background" src="${level.preview}" alt="" />`;
}

function createLevelCard(level, mode) {
  const story = mode === "story";
  const unlocked = !story || isStoryUnlocked(level);
  const completed = story && progress.completedLevels.includes(level.id);
  const placeholder = !level.playable;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "level-card story-level-card";
  button.dataset.levelId = level.id;
  button.dataset.engineLevelId = level.engineLevelId || "";
  button.classList.toggle("is-locked", !unlocked);
  button.classList.toggle("is-completed", completed);
  button.classList.toggle("is-placeholder", placeholder);
  button.setAttribute("role", "listitem");
  button.setAttribute("aria-disabled", String(!unlocked));

  const reward = level.reward.type === "none"
    ? "SIN RECOMPENSA"
    : level.reward.type === "master-pen" ? "MASTER-PEN" : `USB ${level.title}`;
  const state = placeholder ? "COMING SOON" : !unlocked ? "BLOQUEADO" : completed ? "COMPLETADO" : "JUGAR";
  button.innerHTML = `
    <span class="level-card__preview">${cardPreview(level)}</span>
    ${story ? `<span class="level-card__number">LEVEL ${level.storyOrder}</span>` : ""}
    <strong class="level-card__artist">${level.levelName ?? level.title}</strong>
    <span class="level-card__reward">${reward}</span>
    <span class="level-card__state">${state}</span>
  `;
  button.addEventListener("click", () => selectLevel(level, mode));
  return button;
}

function renderLevels(focusOrder = null) {
  const grid = document.getElementById("levels-grid");
  if (!grid || !config) return;
  grid.replaceChildren();
  const levels = currentMode === "story"
    ? config.levels
    : config.levels.filter((level) => level.playable);
  const seen = new Set();
  for (const level of levels) {
    if (currentMode === "free" && seen.has(level.engineLevelId)) continue;
    seen.add(level.engineLevelId);
    grid.append(createLevelCard(level, currentMode));
  }
  document.getElementById("levels-mode-eyebrow").textContent =
    currentMode === "story" ? "MODO HISTORIA · 15 NIVELES" : "MODO LIBRE · SIN PROGRESIÓN";
  document.getElementById("story-reset-button")?.classList.toggle("is-hidden", currentMode !== "story");
  const visible = Math.max(1, Number(scene.levelCarouselVisibleCount?.() ?? (matchMedia("(max-width: 760px)").matches ? 2 : 5)));
  const target = focusOrder ?? (currentMode === "story" ? progress.highestUnlockedLevel : 1);
  scene.levelCarouselPage = Math.max(0, Math.floor((Math.max(1, target) - 1) / visible));
  requestAnimationFrame(() => scene.updateLevelCarousel?.());
}

function showModes() {
  scene.showOnly(null);
  document.getElementById("game-modes-screen")?.classList.remove("is-hidden");
  scene.mode = "menu";
  updateCounters();
}

function showLevelMode(mode, focusOrder = null) {
  currentMode = mode;
  scene.__headbangGameMode = mode;
  renderLevels(focusOrder);
  scene.showOnly("levels-screen");
}

function firstAvailableStoryLevel() {
  return [...config.levels]
    .reverse()
    .find((level) => level.playable && isStoryUnlocked(level))
    ?? config.levels.find((level) => level.playable);
}

function launchStoryLevel(levelNumber = null) {
  currentMode = "story";
  scene.__headbangGameMode = "story";
  const level = levelNumber == null
    ? firstAvailableStoryLevel()
    : config.levels.find((entry) => entry.storyOrder === levelNumber && entry.playable);
  if (level) selectLevel(level, "story");
  else showLevelMode("story");
}

function startStoryFromMenu() {
  currentMode = "story";
  scene.__headbangGameMode = "story";
  scene.orientationController?.requestImmersiveMode?.();
  scene.playSfx?.("sfx-confirm", 0.55);
  if (!scene.campaignSave.introSeen) {
    scene.startIntro();
    return;
  }
  launchStoryLevel();
}

function startFreeMode() {
  currentMode = "free";
  scene.__headbangGameMode = "free";
  grantStarterMasterPen();
  scene.playSfx?.("sfx-confirm", 0.55);
  showLevelMode("free");
}

function completeIntroAndLaunchStory() {
  scene.clearIntroTyping?.();
  grantStarterMasterPen();
  scene.campaignSave.introSeen = true;
  scene.writeCampaignSave?.();
  scene.updateCampaignUi?.();
  launchStoryLevel(1);
}

async function selectLevel(level, mode) {
  if (mode === "story" && !isStoryUnlocked(level)) {
    scene.showFeedback?.("NIVEL BLOQUEADO");
    return;
  }
  if (!level.playable || !level.engineLevelId) {
    if (mode === "story" && new URLSearchParams(location.search).get(config.devBypassQuery) === "1") {
      markDevPlaceholderComplete(level);
    } else {
      scene.showFeedback?.("COMING SOON");
    }
    return;
  }
  try {
    window.HeadbangStoryLevels?.deactivate?.();
    if (window.HeadbangStoryLevels?.has(level.engineLevelId)) {
      await window.HeadbangStoryLevels.activate(level.engineLevelId);
    } else {
      scene.setActiveLevel(level.engineLevelId, false);
      if (mode === "story") {
        await window.HeadbangStoryLevels?.applyNativeBeatmap?.(level.storyOrder);
        window.HeadbangStoryLevels?.enhanceNativeLevel?.(level.storyOrder);
        await window.HeadbangStoryLevels?.activateFeatures?.(level.storyOrder);
      }
    }
    scene.activeLevel.index = level.storyOrder;
    scene.updateLevelCopy?.(scene.activeLevel);
    if (level.reward.type === "character-usb" && level.reward.asset) {
      ensureStoryUsbTexture(level);
      scene.activeLevel.usbKey = storyUsbTextureKey(level);
      scene.activeLevel.usbAsset = level.reward.asset;
    }
    scene.__activeStoryLevelId = mode === "story" ? level.id : null;
    scene.__storyLaunchPending = true;
    const title = document.getElementById("character-title");
    if (title) {
      const heading = document.createElement("span");
      heading.textContent = "ELIGE PERSONAJE";
      const levelLine = document.createElement("small");
      levelLine.className = "character-title__level";
      levelLine.textContent = `LEVEL ${level.storyOrder} \u00b7 ${level.levelName ?? level.title}`;
      title.replaceChildren(heading, levelLine);
    }
    const back = document.getElementById("character-back");
    if (back) back.textContent = "JUGAR NIVEL";
    scene.updateCharacterSelectionUi?.();
    scene.showOnly("character-screen");
    scene.revealSelectedCharacter?.();
  } catch (error) {
    console.error("[StoryModes] No se pudo abrir el nivel", error);
    scene.showFeedback?.("NIVEL NO DISPONIBLE");
  }
}

function markDevPlaceholderComplete(level) {
  if (!progress.devCompletedLevels.includes(level.id)) {
    progress.devCompletedLevels.push(level.id);
  }
  progress.highestUnlockedLevel = Math.max(
    progress.highestUnlockedLevel,
    Math.min(config.totalLevels, level.storyOrder + 1),
  );
  saveProgress();
  renderLevels();
}

function recordStoryCompletion(levelId) {
  const level = config.levels.find((candidate) => candidate.id === levelId);
  if (!level) return;
  progress.completedLevels = unique([...progress.completedLevels, level.id]);
  progress.generatedRewards = unique([...progress.generatedRewards, level.id]);
  progress.highestUnlockedLevel = Math.max(
    progress.highestUnlockedLevel,
    Math.min(config.totalLevels, level.storyOrder + 1),
  );
  saveProgress();
}

function collectStoryReward(levelId) {
  const level = config.levels.find((candidate) => candidate.id === levelId);
  if (!level || progress.collectedRewardLevelIds.includes(level.id)) return null;
  progress.collectedRewardLevelIds.push(level.id);
  if (level.reward.type === "character-usb") {
    progress.collectedUsbIds = unique([...progress.collectedUsbIds, level.reward.itemId]);
    progress.unlockedCharacters = unique([
      ...progress.unlockedCharacters,
      level.reward.characterId,
    ]).filter((id) => VALID_CHARACTERS.has(id));
  } else if (level.reward.type === "master-pen") {
    progress.masterPens += 1;
  }
  saveProgress();
  return level;
}

function updateCounters() {
  const completed = progress?.completedLevels?.length ?? 0;
  const usbCount = progress?.collectedUsbIds?.length ?? 0;
  const masterPens = progress?.masterPens ?? 0;
  const set = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  };
  set("campaign-progress", `${completed} / 15`);
  set("campaign-current", completed >= 15 ? "HISTORIA COMPLETADA" : `LEVEL ${progress?.highestUnlockedLevel ?? 1} DISPONIBLE`);
  set("mode-usb-count", usbCount);
  set("mode-master-pen-count", masterPens);
  set("master-usb-count", masterPens);
  set("levels-master-usb-count", masterPens);
}

function appendStoryInventory() {
  const gallery = document.getElementById("usb-gallery");
  if (!gallery || !progress || scene.collectionMode !== "usb") return;
  gallery.replaceChildren();
  for (const level of config.levels.filter((entry) => entry.reward.type === "character-usb")) {
    if (gallery.querySelector(`[data-story-item="${level.reward.itemId}"]`)) continue;
    const obtained = progress.collectedUsbIds.includes(level.reward.itemId);
    const item = document.createElement("article");
    item.className = `usb-gallery__item${obtained ? " is-obtained" : ""}`;
    item.dataset.storyItem = level.reward.itemId;
    item.innerHTML = `
      <img src="${level.reward.asset}" alt="${obtained ? `USB ${level.title}` : "USB BLOQUEADO"}" />
      <strong>${obtained ? `USB ${level.title}` : "USB BLOQUEADO"}</strong>
      <span>LEVEL ${level.storyOrder}${levelPhase(level)}</span>`;
    gallery.append(item);
  }
  const master = document.createElement("article");
  master.className = `usb-gallery__item master-pen-inventory${progress.masterPens ? " is-obtained" : ""}`;
  master.dataset.storyItem = "master-pen-counter";
  master.innerHTML = `<img src="${MASTER_PEN_ASSET}" alt="MASTER-PEN" /><strong>MASTER-PEN × ${progress.masterPens}</strong><span>DISPONIBLE EN MODO LIBRE</span>`;
  gallery.append(master);
}

function resetStoryProgress() {
  if (!confirm("¿Reiniciar únicamente el progreso del Modo Historia?")) return;
  progress = defaultProgress();
  saveProgress();
  renderLevels();
}

function patchScene(gameScene) {
  scene = gameScene;
  if (scene.__storyFreeModesPatched) return;
  scene.__storyFreeModesPatched = true;
  sanitizeEngineSave();
  syncCharactersToEngine();

  const originalShowOnly = scene.showOnly.bind(scene);
  scene.showOnly = (screenId = null) => {
    document.getElementById("game-modes-screen")?.classList.add("is-hidden");
    originalShowOnly(screenId);
  };

  const originalBuildCollection = scene.buildCollection.bind(scene);
  scene.buildCollection = () => {
    originalBuildCollection();
    appendStoryInventory();
  };

  const originalUpdateCampaignUi = scene.updateCampaignUi.bind(scene);
  scene.buildLevelSelectionUi = renderLevels;
  scene.updateCampaignUi = () => {
    originalUpdateCampaignUi();
    updateCounters();
  };

  const originalBeginUsbEjection = scene.beginUsbEjection.bind(scene);
  scene.beginUsbEjection = () => {
    if (scene.__activeStoryLevelId) recordStoryCompletion(scene.__activeStoryLevelId);
    originalBeginUsbEjection();
  };

  const originalCollectIntroUsb = scene.collectIntroUsb.bind(scene);
  scene.collectIntroUsb = () => {
    grantStarterMasterPen();
    originalCollectIntroUsb();
  };

  const originalStartUnlockSequence = scene.startUnlockSequence.bind(scene);
  scene.startUnlockSequence = (characterId) => {
    originalStartUnlockSequence(characterId);
    if (scene.__headbangGameMode !== "story" || scene.mode !== "unlock-sequence") return;
    const storyLevel = config.levels.find(
      (level) => level.reward.type === "character-usb"
        && level.reward.characterId === characterId,
    );
    const unlockUsb = document.getElementById("unlock-usb");
    if (storyLevel?.reward.asset && unlockUsb) {
      unlockUsb.src = storyLevel.reward.asset;
      unlockUsb.alt = `USB ${storyLevel.title}`;
    }
    const eyebrow = document.querySelector("#unlock-cinematic > .eyebrow");
    if (eyebrow) eyebrow.textContent = `USB ${storyLevel?.title ?? characterId} // SECURE DECRYPTION`;
  };

  const originalShowResults = scene.showResults.bind(scene);
  scene.showResults = (successful = false) => {
    const activeStoryId = scene.__activeStoryLevelId;
    const storyLevel = activeStoryId
      ? config.levels.find((level) => level.id === activeStoryId)
      : null;
    if (successful && activeStoryId) recordStoryCompletion(activeStoryId);
    const reward = successful && activeStoryId ? collectStoryReward(activeStoryId) : null;
    if (successful && storyLevel?.reward.type === "character-usb") {
      scene.campaignSave.unlockedCharacters = unique([
        ...scene.campaignSave.unlockedCharacters,
        storyLevel.reward.characterId,
      ]);
      if (!scene.campaignSave.characterUnlockSequenceViewed?.includes(storyLevel.reward.characterId)) {
        scene.campaignSave.newUnlockPending = unique([
          ...(scene.campaignSave.newUnlockPending ?? []),
          storyLevel.reward.characterId,
        ]);
      }
    }
    if (successful && storyLevel?.storyOrder === 2 && scene.run) {
      scene.run.score = 0;
      scene.run.combo = 0;
      scene.run.maxCombo = 0;
      scene.run.integrity = 0;
      scene.run.neck = 0;
      scene.run.counts = { PERFECT: 0, HEAVY: 0, WEAK: 0, MISS: 0 };
      scene.run.finalBonusApplied = true;
    }
    originalShowResults(successful);
    const resultListen = document.getElementById("result-listen-button");
    if (resultListen) {
      resultListen.href = successful && storyLevel?.listenUrl ? storyLevel.listenUrl : "";
      resultListen.classList.toggle("is-hidden", !(successful && storyLevel?.listenUrl));
    }
    if (successful && storyLevel) {
      const resultSong = document.getElementById("result-song-name");
      if (resultSong) resultSong.textContent = `LEVEL ${storyLevel.storyOrder} · ${storyLevel.levelName ?? storyLevel.title}`;
      if (storyLevel.storyOrder === 2) {
        for (const [id, value] of Object.entries({
          "result-score": "0", "result-accuracy": "0%", "result-perfect": "0", "result-heavy": "0",
          "result-weak": "0", "result-miss": "0", "result-combo": "x0", "result-damage": "0%",
          "result-totem": "0%", "result-best": "0",
        })) document.getElementById(id)?.replaceChildren(value);
        document.getElementById("results-title")?.replaceChildren("NIVEL COMPLETADO");
        document.getElementById("result-line")?.replaceChildren("SIN PUNTUACIÓN · EXPERIENCIA NARRATIVA");
      } else document.getElementById("result-totem")?.replaceChildren("0%");
      const noReward = storyLevel.reward.type === "none";
      document.getElementById("result-item")?.classList.toggle("is-hidden", noReward);
      document.getElementById("result-item-title").textContent = noReward
        ? "SIN RECOMPENSA"
        : storyLevel.reward.type === "master-pen" ? "MASTER-PEN" : `USB ${storyLevel.title}`;
      document.getElementById("result-item-artist").textContent = storyLevel.title;
      if (!noReward) document.getElementById("result-usb").src =
        storyLevel.reward.type === "character-usb" ? storyLevel.reward.asset : MASTER_PEN_ASSET;
      if (storyLevel.reward.type === "character-usb") {
        document.getElementById("result-unlock-character").textContent =
          `USB ${storyLevel.title} CONSEGUIDO`;
        document.getElementById("result-unlock-level").textContent =
          `DESBLOQUEA A ${storyLevel.title}`;
        const cta = document.getElementById("unlock-cta-button");
        const next = document.getElementById("next-level-button");
        cta?.classList.remove("is-hidden");
        cta?.querySelector("span")?.replaceChildren("NUEVO ARTISTA DISPONIBLE");
        cta?.querySelector("strong")?.replaceChildren(`DESBLOQUEAR A ${storyLevel.title}`);
        cta?.classList.add("unlock-cta--story");
        next?.classList.add("is-hidden");
        if (cta) cta.onclick = () => scene.startUnlockSequence(storyLevel.reward.characterId);
      } else {
        document.getElementById("result-unlock-character").textContent = "NIVEL COMPLETADO";
        document.getElementById("result-unlock-level").textContent = noReward ? "SIN OBJETO NI PERSONAJE" : "SIGUIENTE NIVEL DISPONIBLE";
        document.getElementById("unlock-cta-button")?.classList.add("is-hidden");
        const next = document.getElementById("next-level-button");
        if (next) {
          next.textContent = "SIGUIENTE NIVEL";
          next.classList.remove("is-hidden");
        }
      }
    }
    syncCharactersToEngine();
  };

  document.getElementById("play-button").onclick = startStoryFromMenu;
  document.getElementById("levels-button").onclick = startFreeMode;
  document.getElementById("story-mode-button").onclick = () => showLevelMode("story");
  document.getElementById("free-mode-button").onclick = () => showLevelMode("free");
  document.getElementById("game-modes-back").onclick = () => scene.showOnly("menu-screen");
  document.getElementById("levels-back").onclick = () => scene.showOnly("menu-screen");
  document.getElementById("story-reset-button").onclick = resetStoryProgress;
  document.getElementById("character-back").onclick = () => {
    scene.playSfx?.("sfx-confirm", 0.55);
    if (scene.__storyLaunchPending) {
      scene.__storyLaunchPending = false;
      document.getElementById("character-title").textContent = "ELIGE PERSONAJE";
      document.getElementById("character-back").textContent = "CONFIRMAR Y VOLVER";
      scene.showOnly("tutorial-screen");
    } else {
      scene.showOnly("menu-screen");
    }
  };
  document.getElementById("character-menu-button").onclick = () => {
    scene.__storyLaunchPending = false;
    scene.stopMusic?.();
    scene.showOnly("menu-screen");
  };
  document.getElementById("character-menu-button").textContent = "MENÚ PRINCIPAL";
  document.getElementById("results-levels").onclick = () => {
    scene.stopMusic?.();
    const current = config.levels.find((level) => level.id === scene.__activeStoryLevelId);
    showLevelMode(scene.__headbangGameMode || "story", current ? Math.min(15, current.storyOrder + 1) : null);
  };
  document.getElementById("next-level-button").onclick = () => {
    scene.stopMusic?.();
    const current = config.levels.find((level) => level.id === scene.__activeStoryLevelId);
    showLevelMode(scene.__headbangGameMode || "story", current ? Math.min(15, current.storyOrder + 1) : null);
  };

  document.querySelectorAll(`[data-character-id="${REMOVED_CHARACTER}"]`).forEach((node) => node.remove());
  registerStoryUsbAssets();
  scene.updateCampaignUi();
}

async function initialize() {
  const response = await fetch(CONFIG_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo cargar la campaña (${response.status})`);
  config = await response.json();
  if (config.totalLevels !== 15 || config.levels.length !== 15) {
    throw new Error("El registro de Historia debe contener exactamente 15 niveles");
  }
  progress = loadProgress();
  saveProgress();
  const waitForScene = () => {
    const candidate = window.__HEADBANG_GAME__?.scene?.getScenes?.(false)?.find(
      (entry) => typeof entry.buildLevelSelectionUi === "function" && entry.campaignSave,
    );
    if (candidate?.initialPreloadComplete) patchScene(candidate);
    else window.setTimeout(waitForScene, 50);
  };
  waitForScene();
}

initialize().catch((error) => console.error("[StoryModes]", error));

window.HeadbangStoryMode = Object.freeze({
  getConfig: () => structuredClone(config),
  getProgress: () => structuredClone(progress),
  grantStarterMasterPen,
  completeIntroAndLaunchStory,
  launchStoryLevel,
  resetStoryProgress,
});
