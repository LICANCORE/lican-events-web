import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const gameUrl = process.env.HEADBANG_QA_URL
  ?? "http://127.0.0.1:4173/headbangdealers_the_game/?mobileBootQa=1";
const persistedLevel = process.env.HEADBANG_QA_PERSISTED_LEVEL;
const port = 9362;
const profile = await mkdtemp(join(tmpdir(), "headbang-mobile-boot-qa-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let targets;
for (let attempt = 0; attempt < 80; attempt += 1) {
  try {
    targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    if (targets.length) break;
  } catch {}
  await sleep(100);
}

const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let requestId = 0;
const pending = new Map();
const exceptions = [];
const consoleMessages = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails);
  if (message.method === "Runtime.consoleAPICalled") {
    consoleMessages.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  }
  if (!message.id || !pending.has(message.id)) return;
  const entry = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(message.error.message));
  else entry.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++requestId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    mobile: true,
    screenOrientation: { type: "landscapePrimary", angle: 90 },
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Network.setUserAgentOverride", {
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
    platform: "Android",
  });
  if (persistedLevel) {
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(()=>{const level=${JSON.stringify(persistedLevel)};localStorage.setItem('hd_bt_selected_level_v013',level);localStorage.setItem('hd_bt_campaign_save_v019',JSON.stringify({version:19,introSeen:true,introMasterUsbCollected:true,masterUsbCount:0,tutorialCompleted:true,highestUnlockedLevel:15,unlockedLevels:[level],completedLevels:[],destroyedTotems:[],collectedUsb:[],collectedObjects:[],unlockedCharacters:['treze'],characterUnlockSequenceViewed:[],newUnlockPending:[],selectedCharacter:'treze',bestScoreByLevel:{},bestAccuracyByLevel:{},bestComboByLevel:{},bestRankByLevel:{},attemptsByLevel:{},campaignCompleted:false}));})()`,
    });
  }
  await send("Page.navigate", { url: gameUrl });

  let state;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    await sleep(100);
    state = await evaluate(`(()=>{const scene=window.__HEADBANG_GAME__?.scene?.getScenes?.(false)?.[0];return {
      loaderDone:document.getElementById('initial-loader')?.classList.contains('is-complete'),
      errorVisible:Boolean(document.getElementById('error-screen') && !document.getElementById('error-screen').classList.contains('is-hidden')),
      error:document.getElementById('error-message')?.textContent,
      gateVisible:Boolean(document.getElementById('newsletter-gate') && !document.getElementById('newsletter-gate').classList.contains('is-hidden')),
      device:document.documentElement?.dataset.device,
      layout:document.documentElement?.dataset.layout,
      mobileEnabled:document.documentElement?.dataset.mobileLandscapeEnabled,
      orientationBlocked:document.documentElement?.dataset.orientationBlocked,
      sceneReady:Boolean(scene?.initialPreloadComplete),
      mode:scene?.mode,
      campaignSave:scene?.campaignSave,
      graphics:{
        guide:Boolean(scene?.guide), levelContrastOverlay:Boolean(scene?.levelContrastOverlay),
        levelFloor:Boolean(scene?.levelFloor), ambientSmoke:Boolean(scene?.ambientSmoke)
      }
    }})()`);
    if (state.errorVisible || state.sceneReady) break;
  }

  let playability = null;
  if (!state.errorVisible && state.sceneReady) {
    await evaluate(`document.querySelector('.newsletter-guest')?.click()`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await evaluate(`document.getElementById('newsletter-gate')?.classList.contains('is-hidden')`)) break;
      await sleep(100);
    }
    await evaluate(`(()=>{const scene=window.__HEADBANG_GAME__.scene.getScenes(false)[0];scene.setActiveLevel('tutorial',false);scene.beginCountdown()})()`);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await evaluate(`window.__HEADBANG_GAME__.scene.getScenes(false)[0]?.mode==='playing'`)) break;
      await sleep(100);
    }

    const controls = await evaluate(`(()=>{const joystick=document.getElementById('move-joystick').getBoundingClientRect();const bass=document.getElementById('mobile-bass-button').getBoundingClientRect();const scene=window.__HEADBANG_GAME__.scene.getScenes(false)[0];return {beforeX:scene.character.x,beforeInputs:scene.run.unmatchedInputs.length,joystick:{left:joystick.left,top:joystick.top,width:joystick.width,height:joystick.height},bass:{left:bass.left,top:bass.top,width:bass.width,height:bass.height}}})()`);
    const joystickCenter = {
      x: controls.joystick.left + controls.joystick.width / 2,
      y: controls.joystick.top + controls.joystick.height / 2,
    };
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: joystickCenter.x, y: joystickCenter.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
    await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: joystickCenter.x + controls.joystick.width * 0.3, y: joystickCenter.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
    await sleep(450);
    const movement = await evaluate(`(()=>{const scene=window.__HEADBANG_GAME__.scene.getScenes(false)[0];return {duringX:scene.character.x,joystickX:scene.joystickVector.x}})()`);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    const bassCenter = {
      x: controls.bass.left + controls.bass.width / 2,
      y: controls.bass.top + controls.bass.height / 2,
    };
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: bassCenter.x, y: bassCenter.y, id: 2, radiusX: 4, radiusY: 4, force: 1 }] });
    await sleep(40);
    const attack = await evaluate(`(()=>{const scene=window.__HEADBANG_GAME__.scene.getScenes(false)[0];return {attacking:scene.attacking,inputs:scene.run.unmatchedInputs.length,lastInputMs:scene.run.lastInputMs}})()`);
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    playability = await evaluate(`(()=>{const scene=window.__HEADBANG_GAME__.scene.getScenes(false)[0];const stage=document.getElementById('game-stage').getBoundingClientRect();const joystick=document.getElementById('move-joystick').getBoundingClientRect();const bass=document.getElementById('mobile-bass-button').getBoundingClientRect();const scrolling=document.scrollingElement;return {mode:scene.mode,afterX:scene.character.x,joystickReleased:scene.joystickVector.x===0&&scene.joystickVector.y===0,hudVisible:!document.getElementById('hud').classList.contains('is-hidden'),noVerticalScroll:scrolling.scrollHeight<=scrolling.clientHeight+1,scrollMetrics:{scrolling:scrolling.scrollHeight,client:scrolling.clientHeight,html:document.documentElement.scrollHeight,body:document.body.scrollHeight,y:window.scrollY},stageInsideViewport:stage.left>=0&&stage.top>=0&&stage.right<=window.innerWidth+1&&stage.bottom<=window.innerHeight+1,controlsInsideViewport:[joystick,bass].every(rect=>rect.width>0&&rect.height>0&&rect.left>=0&&rect.top>=0&&rect.right<=window.innerWidth+1&&rect.bottom<=window.innerHeight+1),viewport:{width:window.innerWidth,height:window.innerHeight}}})()`);
    playability.movedRight = movement.duringX > controls.beforeX + 5;
    playability.joystickDuring = movement.joystickX;
    playability.headBangRegistered = attack.attacking || attack.inputs > controls.beforeInputs || Number.isFinite(attack.lastInputMs);
    playability.attack = attack;
  }

  const report = {
    state,
    playability,
    exceptions: exceptions.map((entry) => ({
      text: entry.text,
      description: entry.exception?.description,
      stack: entry.stackTrace?.callFrames?.slice(0, 8),
    })),
    consoleMessages,
  };
  console.log(JSON.stringify(report, null, 2));
  if (
    state.errorVisible
    || exceptions.length
    || !playability?.movedRight
    || !playability?.headBangRegistered
    || !playability?.joystickReleased
    || !playability?.hudVisible
    || !playability?.noVerticalScroll
    || !playability?.stageInsideViewport
    || !playability?.controlsInsideViewport
  ) process.exitCode = 1;
} finally {
  socket.close();
  chrome.kill();
}
