import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9337;
const origin = `http://127.0.0.1:${port}`;
const gameUrl = process.argv[2] ?? "http://127.0.0.1:4173/headbangdealers_the_game/";
const outputDir = resolve("preview/story-flow-qa");
const profile = await mkdtemp(join(tmpdir(), "headbang-story-qa-"));
await mkdir(outputDir, { recursive: true });

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--window-size=1600,1000",
  "about:blank",
], { stdio: "ignore", windowsHide: true });

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
let targets;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    targets = await fetch(`${origin}/json/list`).then((response) => response.json());
    if (targets.length) break;
  } catch {}
  await sleep(100);
}
if (!targets?.length) throw new Error("Chrome DevTools no respondió");

const pageTarget = targets.find((target) => target.type === "page" && !target.url.startsWith("chrome-extension://"));
if (!pageTarget) throw new Error("No se encontró una pestaña de navegador para QA");
const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolvePromise, reject) => {
  socket.addEventListener("open", resolvePromise, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let requestId = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve: resolvePromise, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolvePromise(message.result);
});
const send = (method, params = {}) => new Promise((resolvePromise, reject) => {
  const id = ++requestId;
  pending.set(id, { resolve: resolvePromise, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
  }
  return result.result.value;
};
const screenshot = async (name) => {
  const { data } = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(join(outputDir, name), Buffer.from(data, "base64"));
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: gameUrl });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(250);
    await evaluate(`document.querySelector('.newsletter-guest')?.click()`);
    const ready = await evaluate(`Boolean(
      document.getElementById('play-button')
      && window.HeadbangStoryMode?.getConfig?.()
      && window.__HEADBANG_GAME__?.scene?.getScenes?.(false)?.some(
        (scene) => scene.__storyFreeModesPatched && scene.__headbangCyberLaughPatched
      )
    )`);
    if (ready) break;
  }
  await sleep(500);
  await evaluate(`
    document.documentElement.dataset.appVisible = 'true';
    const loader = document.getElementById('initial-loader');
    if (loader) loader.style.display = 'none';
    document.getElementById('newsletter-gate')?.classList.add('is-hidden');
  `);

  const menu = await evaluate(`({
    play: document.getElementById('play-button')?.textContent.trim(),
    free: document.getElementById('levels-button')?.textContent.trim(),
    ready: Boolean(window.__HEADBANG_GAME__?.scene?.getScenes?.(false)?.some(
      (scene) => scene.__storyFreeModesPatched && scene.__headbangCyberLaughPatched
    )),
    url: location.href,
    title: document.title,
    body: document.body?.textContent?.trim().slice(0, 120),
  })`);
  if (!menu.play || !menu.ready) throw new Error(`Juego no preparado: ${JSON.stringify(menu)}`);
  await evaluate(`document.getElementById('play-button')?.click()`);
  await sleep(500);
  const introBefore = await evaluate(`({
    visible: !document.getElementById('intro-screen').classList.contains('is-hidden'),
    next: document.getElementById('intro-next-button').textContent.trim(),
    skip: document.getElementById('intro-skip-button').textContent.trim(),
    speaking: document.getElementById('intro-skull').classList.contains('is-speaking'),
    jawAnimation: getComputedStyle(document.querySelector('.intro-skull__jaw')).animationName,
    textLength: document.getElementById('intro-dialogue').textContent.length,
  })`);
  await evaluate(`document.getElementById('intro-next-button').click()`);
  const introAfterNext = await evaluate(`({
    page: window.__HEADBANG_GAME__.scene.getScenes(false)[0].introPage,
    typing: Boolean(window.__HEADBANG_GAME__.scene.getScenes(false)[0].introTypingTimer),
    textLength: document.getElementById('intro-dialogue').textContent.length,
  })`);
  await screenshot("01-intro-next-skip-desktop.png");
  await evaluate(`document.getElementById('intro-skip-button').click()`);
  await sleep(300);
  const afterSkip = await evaluate(`({
    characterScreen: !document.getElementById('character-screen').classList.contains('is-hidden'),
    mode: window.__HEADBANG_GAME__.scene.getScenes(false)[0].__headbangGameMode,
    selectedLevel: window.__HEADBANG_GAME__.scene.getScenes(false)[0].selectedLevelId,
    story: window.HeadbangStoryMode.getProgress(),
  })`);

  const hudDesktop = await evaluate(`(() => {
    const hud = document.getElementById('hud');
    document.getElementById('game-stage').className = 'stage stage--landscape';
    hud.classList.remove('is-hidden');
    const children = [...document.querySelector('.hud__top').children];
    return children.map((node) => ({
      kind: node.className,
      text: node.textContent.trim().replace(/\\s+/g, ' '),
      top: Math.round(node.getBoundingClientRect().top),
      height: Math.round(node.getBoundingClientRect().height),
    }));
  })()`);
  await screenshot("02-hud-desktop.png");

  await send("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sleep(300);
  const hudMobile = await evaluate(`[...document.querySelector('.hud__top').children].map((node) => ({
    text: node.textContent.trim().replace(/\\s+/g, ' '),
    top: Math.round(node.getBoundingClientRect().top),
    height: Math.round(node.getBoundingClientRect().height),
  }))`);
  await screenshot("03-hud-mobile-landscape.png");

  const freeModePenCounts = await evaluate(`(() => {
    const scene = window.__HEADBANG_GAME__.scene.getScenes(false)[0];
    scene.showOnly('menu-screen');
    document.getElementById('levels-button').click();
    const first = window.HeadbangStoryMode.getProgress().masterPens;
    scene.showOnly('menu-screen');
    document.getElementById('levels-button').click();
    const second = window.HeadbangStoryMode.getProgress().masterPens;
    return { first, second, mode: scene.__headbangGameMode };
  })()`);

  await send("Emulation.setDeviceMetricsOverride", {
    width: 1400,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const results = await evaluate(`(() => {
    const scene = window.__HEADBANG_GAME__.scene.getScenes(false)[0];
    scene.__headbangGameMode = 'story';
    scene.__activeStoryLevelId = 'story-level-01';
    scene.setActiveLevel('tutorial', false);
    scene.run = {
      score: 79400,
      accuracy: 96.2,
      maxCombo: 28,
      integrity: 0,
      neck: 0,
      destroyed: true,
      usbCollected: true,
      objectCollected: false,
      vertebraeFailure: false,
      failed: false,
      finalBonusApplied: true,
      counts: { PERFECT: 26, HEAVY: 2, WEAK: 0, MISS: 0 },
      events: [],
    };
    scene.showResults(true);
    return {
      cta: document.querySelector('#unlock-cta-button strong').textContent.trim(),
      ctaVisible: !document.getElementById('unlock-cta-button').classList.contains('is-hidden'),
      ctaAnimation: getComputedStyle(document.getElementById('unlock-cta-button')).animationName,
      nextHidden: document.getElementById('next-level-button').classList.contains('is-hidden'),
      rewardUsb: document.getElementById('result-usb').getAttribute('src'),
    };
  })()`);
  await screenshot("04-frankale-results-cta-desktop.png");
  const unlock = await evaluate(`(() => {
    const scene = window.__HEADBANG_GAME__.scene.getScenes(false)[0];
    document.getElementById('unlock-cta-button').click();
    return {
      mode: scene.mode,
      usb: document.getElementById('unlock-usb').getAttribute('src'),
      pcOff: document.getElementById('unlock-pc-off').getAttribute('src'),
      pcOn: document.getElementById('unlock-pc-on').getAttribute('src'),
      stages: scene.unlockManifest?.sequences?.frankale?.stages?.length
        ?? document.querySelectorAll('#unlock-stage-progress > i').length,
    };
  })()`);
  await sleep(4300);
  const unlockResources = await evaluate(`({
    phase: document.getElementById('unlock-cinematic').dataset.phase,
    pcOffLoaded: document.getElementById('unlock-pc-off').naturalWidth > 0,
    pcOnLoaded: document.getElementById('unlock-pc-on').naturalWidth > 0,
    usbLoaded: document.getElementById('unlock-usb').naturalWidth > 0,
    revealLoaded: document.getElementById('unlock-character-image').naturalWidth > 0,
    revealSrc: document.getElementById('unlock-character-image').getAttribute('src'),
  })`);
  await screenshot("05-frankale-unlock-usb-desktop.png");

  const report = {
    menu,
    introBefore,
    introAfterNext,
    afterSkip,
    hudDesktop,
    hudMobile,
    freeModePenCounts,
    results,
    unlock,
    unlockResources,
  };
  await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket.close();
  chrome.kill();
}
