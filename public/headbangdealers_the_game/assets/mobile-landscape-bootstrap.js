const GAME_MODULE_URL = "/headbangdealers_the_game/assets/index-DlqHMLJa.js";
const VIEWPORT_SETTLE_FRAMES = 2;
const RESIZE_DEBOUNCE_MS = 120;
const ACTIVE_RUN_MODES = new Set([
  "playing",
  "usb-ejection",
  "usb-waiting",
  "usb-pickup",
]);

const root = document.documentElement;
const orientationOverlay = document.getElementById("orientation-overlay");
const immersiveButton = document.getElementById("orientation-fullscreen-button");

let gameImportPromise = null;
let resizeTimer = 0;
let resizeFrame = 0;
let scenePromise = null;
let orientationPause = null;
const activePointers = new Map();

function viewportSize() {
  const viewport = window.visualViewport;
  return {
    width: Math.max(1, Math.round(viewport?.width || window.innerWidth || 1)),
    height: Math.max(1, Math.round(viewport?.height || window.innerHeight || 1)),
  };
}

function mediaMatches(query) {
  return Boolean(window.matchMedia?.(query).matches);
}

function deviceState() {
  const { width, height } = viewportSize();
  const coarse = mediaMatches("(pointer: coarse)");
  const noHover = mediaMatches("(hover: none)");
  const touchPoints = Number(navigator.maxTouchPoints) || 0;
  const touchCapable = coarse || noHover || touchPoints > 0;
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const landscape = mediaMatches("(orientation: landscape)") || width > height;
  const handheld = touchCapable && shortEdge <= 1024 && longEdge <= 1800;
  const mobile = handheld && shortEdge <= 600 && longEdge <= 1400;

  return {
    width,
    height,
    landscape,
    handheld,
    device: mobile ? "mobile" : handheld ? "tablet" : "desktop",
  };
}

function publishState(state = deviceState()) {
  const blocked = state.handheld && !state.landscape;

  root.dataset.device = state.device;
  root.dataset.orientation = state.landscape ? "landscape" : "portrait";
  // The compiled Phaser scene selects its 960x540 world only for "desktop".
  // Handheld landscape still uses that logical world; CSS and this controller
  // provide the mobile controls without rotating the scene.
  root.dataset.layout = state.landscape ? "desktop" : `${state.device}-portrait`;
  root.dataset.layoutReady = "true";
  root.dataset.mobileLandscapeEnabled = String(state.handheld);
  root.dataset.orientationBlocked = String(blocked);
  orientationOverlay?.setAttribute("aria-hidden", String(!blocked));

  return { ...state, blocked };
}

function waitForStableViewport(frames = VIEWPORT_SETTLE_FRAMES) {
  return new Promise((resolve) => {
    const next = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => next(remaining - 1));
    };
    next(frames);
  });
}

function getScene() {
  return window.__HEADBANG_GAME__?.scene?.getScenes?.(false)?.find(
    (candidate) =>
      typeof candidate.handleResize === "function" &&
      typeof candidate.pauseRun === "function" &&
      typeof candidate.resumeRun === "function" &&
      candidate.initialPreloadComplete === true &&
      candidate.character &&
      candidate.background,
  );
}

function waitForScene() {
  if (scenePromise) {
    return scenePromise;
  }

  scenePromise = new Promise((resolve) => {
    const findScene = () => {
      const scene = getScene();
      if (!scene) {
        window.setTimeout(findScene, 50);
        return;
      }
      resolve(scene);
    };
    findScene();
  });

  return scenePromise;
}

function resetTouchState(scene = getScene()) {
  for (const [pointerId, target] of activePointers) {
    try {
      if (target?.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
      target?.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "touch",
        }),
      );
    } catch {
      // A detached target or an already-released pointer needs no recovery.
    }
  }
  activePointers.clear();

  if (scene) {
    scene.joystickVector = { x: 0, y: 0 };
    scene.mobileActionPressed = false;
    scene.mobileJumpWasPressed = false;
    scene.mobileJumpHoldMs = 0;
  }

  const knob = document.getElementById("joystick-knob");
  if (knob) {
    knob.style.transform = "translate(-50%, -50%)";
  }
}

async function requestImmersiveMode() {
  const state = publishState();
  if (!state.handheld) {
    return false;
  }

  const fullscreenTarget = document.documentElement;
  if (!document.fullscreenElement && fullscreenTarget.requestFullscreen) {
    try {
      await fullscreenTarget.requestFullscreen({ navigationUI: "hide" });
    } catch {
      try {
        await fullscreenTarget.requestFullscreen();
      } catch {
        // Fullscreen is optional; the real-orientation fallback remains active.
      }
    }
  }

  if (screen.orientation?.lock) {
    try {
      await screen.orientation.lock("landscape-primary");
    } catch {
      try {
        await screen.orientation.lock("landscape");
      } catch {
        // Safari and some embedded browsers do not expose orientation lock.
      }
    }
  }

  scheduleViewportUpdate(true);
  return deviceState().landscape;
}

function patchScene(scene) {
  scene.mobileLandscapeMode = deviceState().handheld;
  scene.blockForOrientation = blockForOrientation;
  scene.resumeFromOrientation = resumeFromOrientation;

  if (scene.orientationController) {
    scene.orientationController.onViewport = () => {};
    scene.orientationController.onBlock = blockForOrientation;
    scene.orientationController.onUnblock = resumeFromOrientation;
    scene.orientationController.isHandheldLandscape = () => {
      const state = deviceState();
      return state.handheld && state.landscape;
    };
    scene.orientationController.requestImmersiveMode = requestImmersiveMode;
  }

  const bassButton = document.getElementById("mobile-bass-button");
  if (bassButton) {
    bassButton.textContent = "HEAD BANG";
    bassButton.setAttribute("aria-label", "Head bang");
  }
}

async function blockForOrientation() {
  const scene = getScene();
  resetTouchState(scene);
  root.dataset.orientationBlocked = "true";

  if (!scene || scene.orientationBlocked) {
    return;
  }

  const activeRun = ACTIVE_RUN_MODES.has(scene.mode);
  orientationPause = {
    activeRun,
    clockWasPaused: Boolean(scene.time?.paused),
    mode: scene.mode,
    pausedAt: performance.now(),
  };
  scene.orientationBlocked = true;

  if (activeRun) {
    await scene.pauseRun(true);
  } else {
    if (scene.time) {
      scene.time.paused = true;
    }
    scene.tweens?.pauseAll?.();
    try {
      await scene.sound?.context?.suspend?.();
    } catch {
      // Audio suspension is best-effort outside a user gesture.
    }
  }
}

async function resumeFromOrientation() {
  const scene = getScene();
  if (!scene) {
    return;
  }

  resetTouchState(scene);
  scene.mobileLandscapeMode = true;
  await waitForStableViewport();

  const modeBeforeResize = scene.mode;
  const wasActiveBeforeResize = ACTIVE_RUN_MODES.has(modeBeforeResize);
  scene.handleResize(true);
  scene.game?.scale?.refresh?.();
  scene.orientationBlocked = false;

  if (
    orientationPause?.activeRun &&
    scene.audioStartAt === null &&
    Number.isFinite(scene.fallbackStartAt)
  ) {
    scene.fallbackStartAt += performance.now() - orientationPause.pausedAt;
  }

  if (orientationPause?.activeRun || (wasActiveBeforeResize && scene.mode === "paused")) {
    await scene.resumeRun();
  } else if (orientationPause && !orientationPause.clockWasPaused) {
    if (scene.time) {
      scene.time.paused = false;
    }
    scene.tweens?.resumeAll?.();
    try {
      await scene.sound?.context?.resume?.();
    } catch {
      // A later game gesture will unlock audio if the browser requires it.
    }
  }

  orientationPause = null;
  root.dataset.orientationBlocked = "false";
}

async function ensureGameLoaded() {
  if (gameImportPromise) {
    return gameImportPromise;
  }

  const state = publishState();
  if (state.handheld && !state.landscape) {
    return null;
  }

  // Force the 960x540 logical world before Phaser reads the initial dataset.
  root.dataset.layout = "desktop";
  gameImportPromise = import(GAME_MODULE_URL)
    .then(waitForScene)
    .then(async (scene) => {
      patchScene(scene);
      if (deviceState().handheld && !deviceState().landscape) {
        await blockForOrientation();
      } else if (deviceState().handheld) {
        await resumeFromOrientation();
      }
      return scene;
    })
    .catch((error) => {
      gameImportPromise = null;
      console.error("[HeadbangLandscape] No se pudo iniciar el juego", error);
      throw error;
    });

  return gameImportPromise;
}

async function applyViewportState(forceResize = false) {
  const previousBlocked = root.dataset.orientationBlocked === "true";
  const state = publishState();

  if (state.blocked) {
    await blockForOrientation();
    return;
  }

  await ensureGameLoaded();
  const scene = getScene();
  if (!scene) {
    return;
  }

  patchScene(scene);
  if (previousBlocked || scene.orientationBlocked) {
    await resumeFromOrientation();
    return;
  }

  if (forceResize && state.handheld) {
    const wasActive = ACTIVE_RUN_MODES.has(scene.mode);
    scene.mobileLandscapeMode = true;
    resetTouchState(scene);
    await waitForStableViewport();
    scene.handleResize(true);
    scene.game?.scale?.refresh?.();
    if (wasActive && scene.mode === "paused") {
      await scene.resumeRun();
    }
  }
}

function scheduleViewportUpdate(forceResize = false) {
  window.clearTimeout(resizeTimer);
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    resizeTimer = window.setTimeout(
      () => applyViewportState(forceResize),
      RESIZE_DEBOUNCE_MS,
    );
  });
}

document.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType === "touch") {
      activePointers.set(event.pointerId, event.target);
    }
  },
  true,
);

for (const eventName of ["pointerup", "pointercancel"]) {
  document.addEventListener(
    eventName,
    (event) => activePointers.delete(event.pointerId),
    true,
  );
}

immersiveButton?.addEventListener("click", () => {
  if (!getScene()) {
    requestImmersiveMode();
  }
});
window.addEventListener("resize", () => scheduleViewportUpdate(true), { passive: true });
window.addEventListener("orientationchange", () => scheduleViewportUpdate(true), { passive: true });
document.addEventListener("fullscreenchange", () => scheduleViewportUpdate(true));
window.visualViewport?.addEventListener("resize", () => scheduleViewportUpdate(true), { passive: true });
window.visualViewport?.addEventListener("scroll", () => scheduleViewportUpdate(false), { passive: true });
screen.orientation?.addEventListener?.("change", () => scheduleViewportUpdate(true));

const rootStateObserver = new MutationObserver(() => {
  const state = deviceState();
  const expectedEnabled = String(state.handheld);
  const expectedBlocked = String(state.handheld && !state.landscape);
  if (
    root.dataset.mobileLandscapeEnabled !== expectedEnabled ||
    root.dataset.orientationBlocked !== expectedBlocked
  ) {
    publishState(state);
  }
});
rootStateObserver.observe(root, {
  attributes: true,
  attributeFilter: ["data-mobile-landscape-enabled", "data-orientation-blocked"],
});

publishState();
ensureGameLoaded();

window.HeadbangLandscape = Object.freeze({
  getState: () => publishState(),
  requestImmersiveMode,
  refresh: () => applyViewportState(true),
});
