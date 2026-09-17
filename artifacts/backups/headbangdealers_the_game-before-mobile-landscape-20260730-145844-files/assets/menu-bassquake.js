const BASSQUAKE_URL =
  "/headbangdealers_the_game/assets/audio/music/BASSQUAKE.wav";
const UNLOCK_OFFSET_SECONDS = 95;
const MENU_VOLUME = 0.36;
const PATCH_FLAG = "__headbangBassquakePatched";
const MENU_SCREENS = new Set([
  "menu-screen",
  "character-screen",
  "levels-screen",
  "gallery-screen",
  "settings-screen",
  "credits-screen",
  "tutorial-screen",
  "results-screen",
  "unlock-screen",
  "intro-screen",
  "error-screen",
]);

const audio = new Audio(BASSQUAKE_URL);
audio.id = "headbang-bassquake";
audio.loop = true;
audio.preload = "auto";
audio.volume = MENU_VOLUME;
audio.playsInline = true;

let shouldPlay = true;
let unlockSeekPending = false;

function syncSoundSetting() {
  const soundButton = document.getElementById("sound-button");
  audio.muted = soundButton?.getAttribute("aria-pressed") === "false";
}

async function playContinuous() {
  shouldPlay = true;
  syncSoundSetting();

  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

function pauseForLevel() {
  shouldPlay = false;
  audio.pause();
}

function seekToUnlockSection() {
  shouldPlay = true;
  unlockSeekPending = true;

  const applySeek = () => {
    if (!unlockSeekPending) {
      return;
    }

    const safeOffset = Number.isFinite(audio.duration)
      ? Math.min(UNLOCK_OFFSET_SECONDS, Math.max(0, audio.duration - 0.1))
      : UNLOCK_OFFSET_SECONDS;

    try {
      audio.currentTime = safeOffset;
      unlockSeekPending = false;
    } catch {
      return;
    }

    void playContinuous();
  };

  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    applySeek();
  } else {
    audio.addEventListener("loadedmetadata", applySeek, { once: true });
    audio.load();
    void playContinuous();
  }
}

function resumeOnUserGesture() {
  if (shouldPlay) {
    void playContinuous();
  }
}

for (const eventName of ["pointerdown", "touchstart", "keydown"]) {
  document.addEventListener(eventName, resumeOnUserGesture, {
    capture: true,
    passive: true,
  });
}

const soundButton = document.getElementById("sound-button");
if (soundButton) {
  new MutationObserver(syncSoundSetting).observe(soundButton, {
    attributes: true,
    attributeFilter: ["aria-pressed"],
  });
}

function patchScene() {
  const scene = window.__HEADBANG_GAME__?.scene
    ?.getScenes?.(false)
    ?.find((candidate) => typeof candidate.showOnly === "function");

  if (!scene) {
    window.setTimeout(patchScene, 80);
    return;
  }

  if (scene[PATCH_FLAG]) {
    return;
  }

  const originalShowOnly = scene.showOnly;
  scene.showOnly = function showOnlyWithBassquake(screenId, ...args) {
    const result = originalShowOnly.call(this, screenId, ...args);

    if (MENU_SCREENS.has(screenId)) {
      void playContinuous();
    }

    return result;
  };

  const originalStartUnlockSequence = scene.startUnlockSequence;
  scene.startUnlockSequence = function startUnlockSequenceWithBassquake(...args) {
    const result = originalStartUnlockSequence.apply(this, args);

    if (this.mode === "unlock-sequence") {
      seekToUnlockSection();
    }

    return result;
  };

  const originalBeginCountdown = scene.beginCountdown;
  scene.beginCountdown = function beginCountdownWithoutBassquake(...args) {
    pauseForLevel();
    return originalBeginCountdown.apply(this, args);
  };

  const originalStartRun = scene.startRun;
  scene.startRun = function startRunWithoutBassquake(...args) {
    pauseForLevel();
    return originalStartRun.apply(this, args);
  };

  scene[PATCH_FLAG] = true;
  syncSoundSetting();
}

window.__HEADBANG_BASSQUAKE__ = {
  audio,
  play: playContinuous,
  pauseForLevel,
  playUnlock: seekToUnlockSection,
  getState: () => ({
    currentTime: audio.currentTime,
    duration: audio.duration,
    loop: audio.loop,
    muted: audio.muted,
    paused: audio.paused,
    shouldPlay,
    unlockSeekPending,
  }),
};

void playContinuous();
patchScene();
