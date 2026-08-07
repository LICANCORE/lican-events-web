const PATCH_FLAG = "__headbangV019RuntimeFixes";
const GAME_ASSET_PREFIX = "/headbangdealers_the_game";

const REPLAY_LABELS = Object.freeze({
  en: "REPLAY INTRO",
  es: "REPETIR INTRO",
  de: "INTRO WIEDERHOLEN",
  eo: "RIPETI ENKONDUKON",
});

function engineAssetUrl(value) {
  if (typeof value !== "string") return value;
  // The compiled game prefixes unlock-manifest paths itself. Keeping an
  // already-prefixed URL here produced /headbangdealers_the_game twice.
  return value.startsWith(`${GAME_ASSET_PREFIX}/assets/`)
    ? value.slice(GAME_ASSET_PREFIX.length)
    : value;
}

function normalizeUnlockManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return false;
  }

  manifest.pcOff = engineAssetUrl(manifest.pcOff);
  manifest.pcOn = engineAssetUrl(manifest.pcOn);

  for (const sequence of Object.values(manifest.sequences ?? {})) {
    sequence.usb = engineAssetUrl(sequence.usb);
    if (Array.isArray(sequence.stages)) {
      sequence.stages = sequence.stages.map(engineAssetUrl);
    }
  }

  return true;
}

function getGameScene() {
  return window.__HEADBANG_GAME__?.scene
    ?.getScenes?.(false)
    ?.find(
      (candidate) =>
        typeof candidate.startIntro === "function" &&
        candidate.unlockManifest,
    );
}

function currentLocale(scene) {
  return REPLAY_LABELS[scene?.locale] ? scene.locale : "es";
}

function addReplayIntroButton(scene) {
  const menuActions = document.querySelector("#menu-screen .menu-actions");
  if (!menuActions || document.getElementById("intro-replay-button")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "intro-replay-button";
  button.className = "menu-button";
  button.type = "button";
  button.textContent = REPLAY_LABELS[currentLocale(scene)];
  button.addEventListener("click", () => {
    scene.startIntro();
  });

  const levelsButton = document.getElementById("levels-button");
  menuActions.insertBefore(button, levelsButton ?? null);

  window.addEventListener("headbang-language-changed", (event) => {
    const locale = REPLAY_LABELS[event.detail?.locale]
      ? event.detail.locale
      : currentLocale(scene);
    button.textContent = REPLAY_LABELS[locale];
  });
}

function patchGame() {
  const scene = getGameScene();
  if (!scene) {
    window.setTimeout(patchGame, 50);
    return;
  }

  if (scene[PATCH_FLAG]) {
    return;
  }

  normalizeUnlockManifest(scene.unlockManifest);
  addReplayIntroButton(scene);
  scene[PATCH_FLAG] = true;
}

patchGame();

window.HeadbangGameRuntime = Object.freeze({
  replayIntro() {
    const scene = getGameScene();
    if (!scene) {
      return false;
    }
    scene.startIntro();
    return true;
  },
  getUnlockAssetPaths() {
    const manifest = getGameScene()?.unlockManifest;
    if (!manifest) {
      return null;
    }
    return {
      pcOff: manifest.pcOff,
      pcOn: manifest.pcOn,
      sequences: structuredClone(manifest.sequences),
    };
  },
});
