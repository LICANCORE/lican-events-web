const STORY_BASE = "/headbangdealers_the_game/assets/story-levels";

function watchInterfaceCopy() {
  const rewrite = (node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.id === "loader-status" && document.getElementById("loader-fraction")?.textContent?.trim() === "4/4") {
      if (node.textContent !== "CARGANDO BEATS AL MARGEN DEL CONTROL") node.textContent = "CARGANDO BEATS AL MARGEN DEL CONTROL";
    }
    if (node.id === "countdown-value") {
      if (/^\s*[123]\s*$/.test(node.textContent ?? "")) node.classList.remove("is-headbang");
      else {
        if (node.textContent !== "¡HEADBANG!!") node.textContent = "¡HEADBANG!!";
        node.classList.add("is-headbang");
      }
    }
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      rewrite(record.target);
      for (const node of record.addedNodes) rewrite(node);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  rewrite(document.getElementById("loader-status"));
  rewrite(document.getElementById("countdown-value"));
}

function fitPiece(scene, sprite, maxSize) {
  const source = sprite.texture.getSourceImage();
  const scale = maxSize / Math.max(source.width, source.height);
  sprite.setDisplaySize(source.width * scale, source.height * scale);
}

function preloadTotemPieces(scene) {
  const levels = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  for (const level of levels) for (let part = 1; part <= 3; part += 1) {
    const key = `story-totem-piece-${level}-${part}`;
    if (!scene.textures.exists(key)) scene.load.image(key, `${STORY_BASE}/totem-pieces/level-${level}/piece-${part}.webp`);
  }
  if (!scene.load.isLoading()) scene.load.start();
}

function throwTotemPiece(scene) {
  const level = Number(scene.activeLevel?.index);
  if (![1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(level)) return;
  const key = `story-totem-piece-${level}-${1 + Math.floor(Math.random() * 3)}`;
  if (!scene.textures.exists(key)) return;
  const startX = scene.totem.x + (Math.random() - .5) * 70;
  const startY = scene.layout.impact.y + (Math.random() - .5) * 45;
  const piece = scene.add.image(startX, startY, key).setDepth(8.3).setAngle(Math.random() * 90 - 45);
  fitPiece(scene, piece, Math.max(22, scene.layout.height * (.045 + Math.random() * .025)));
  const side = Math.random() < .5 ? -1 : 1;
  scene.tweens.add({
    targets: piece,
    x: startX + side * (80 + Math.random() * 150),
    y: startY - (65 + Math.random() * 100),
    angle: piece.angle + side * (170 + Math.random() * 260),
    duration: 260 + Math.random() * 170,
    ease: "Quad.easeOut",
    onComplete: () => scene.tweens.add({
      targets: piece,
      y: (scene.characterBaseY ?? scene.layout.character.y) + 5,
      angle: piece.angle + side * 210,
      alpha: .18,
      duration: 430 + Math.random() * 230,
      ease: "Quad.easeIn",
      onComplete: () => piece.destroy(),
    }),
  });
}

function patchScene(scene) {
  if (scene.__storyRevisionV2Patched) return;
  scene.__storyRevisionV2Patched = true;
  preloadTotemPieces(scene);

  const originalApplyJudgement = scene.applyJudgement.bind(scene);
  scene.applyJudgement = (...args) => {
    const before = scene.run?.integrity ?? 100;
    const result = originalApplyJudgement(...args);
    if (args[1] === "PERFECT" && (scene.run?.integrity ?? before) < before) throwTotemPiece(scene);
    return result;
  };

  const originalBeginUsbEjection = scene.beginUsbEjection.bind(scene);
  scene.beginUsbEjection = (...args) => {
    if (scene.run) {
      scene.run.integrity = 0;
      scene.run.destroyed = true;
      scene.updateHud?.(0);
    }
    return originalBeginUsbEjection(...args);
  };

  const originalActivateDrop = scene.activateDropIfReady.bind(scene);
  scene.activateDropIfReady = (...args) => {
    const originalWave = scene.spawnWave;
    scene.spawnWave = () => {};
    try { return originalActivateDrop(...args); }
    finally { scene.spawnWave = originalWave; }
  };

  const originalCloseUnlock = scene.closeUnlockSequence.bind(scene);
  scene.closeUnlockSequence = (...args) => {
    if (scene.__headbangGameMode !== "story") return originalCloseUnlock(...args);
    scene.clearUnlockTimers?.();
    scene.mode = "menu";
    scene.writeCampaignSave?.();
    scene.updateCampaignUi?.();
    document.getElementById("results-levels")?.click();
  };

  scene.events.on("update", () => {
    if (scene.__activeStoryLevelId === "story-level-01" && scene.ambientActor?.visible) {
      scene.ambientActor.y = (scene.characterBaseY ?? scene.layout.character.y) + 5;
    }
  });
}

function waitForScene() {
  const scene = window.__HEADBANG_GAME__?.scene?.getScenes?.(false)?.find((item) => item.applyJudgement && item.beginUsbEjection);
  if (scene) patchScene(scene);
  else setTimeout(waitForScene, 60);
}

watchInterfaceCopy();
window.__HEADBANG_BASSQUAKE__?.audio?.addEventListener("canplay", () => void window.__HEADBANG_BASSQUAKE__.play(), { once: true });
waitForScene();
