import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const gameUrl = "http://127.0.0.1:4173/headbangdealers_the_game/?storyDev=1";
const output = "artifacts/responsive-v3";
const port = 9363;
await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "headbang-mobile-v3-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, "--window-size=844,390", "about:blank",
], { stdio: "ignore", windowsHide: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let targets;
for (let attempt = 0; attempt < 80; attempt += 1) {
  try { targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()); if (targets.length) break; } catch {}
  await sleep(100);
}
const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let requestId = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id || !pending.has(message.id)) return;
  const entry = pending.get(message.id); pending.delete(message.id);
  if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++requestId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
};
const screenshot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(join(output, `${name}.png`), Buffer.from(result.data, "base64"));
};
const rect = `(element)=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,scrollW:element.scrollWidth,scrollH:element.scrollHeight,clientW:element.clientWidth,clientH:element.clientHeight}}`;

try {
  console.log("qa:start");
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.navigate", { url: gameUrl });
  console.log("qa:navigated");
  for (let attempt = 0; attempt < 150; attempt += 1) {
    await sleep(100);
    if (await evaluate(`Boolean(window.__HEADBANG_GAME__?.scene?.getScenes(false)?.find(s=>s.__storyFreeModesPatched) && window.HeadbangStoryMode?.getConfig?.() && document.querySelector('.newsletter-guest'))`)) break;
  }
  await evaluate(`document.querySelector('.newsletter-guest')?.click()`);
  console.log("qa:guest");
  await sleep(650);
  await evaluate(`(()=>{document.getElementById('newsletter-gate')?.classList.add('is-hidden');document.documentElement.dataset.appVisible='true';document.documentElement.dataset.device='mobile';document.documentElement.dataset.orientation='landscape';document.documentElement.dataset.layout='desktop';document.documentElement.dataset.mobileLandscapeEnabled='true';return true})()`);
  const sceneExpression = `window.__HEADBANG_GAME__.scene.getScenes(false)[0]`;
  const report = {};

  await evaluate(`(()=>{const s=${sceneExpression};s.showOnly('menu-screen');document.getElementById('hud').classList.add('is-hidden')})()`);
  await sleep(120);
  report.menu = await evaluate(`(()=>{const r=${rect};return {card:r(document.querySelector('.menu-card')),hero:r(document.querySelector('.menu-hero')),image:r(document.getElementById('menu-character-image'))}})()`);
  await screenshot("01-menu");
  console.log("qa:menu");

  await evaluate(`(()=>{const s=${sceneExpression};s.updateCharacterSelectionUi();s.showOnly('character-screen')})()`);
  await sleep(120);
  report.characters = await evaluate(`(()=>{const r=${rect},panel=document.querySelector('.character-select'),cards=[...document.querySelectorAll('.character-card')].slice(0,5);return {panel:r(panel),cards:cards.map(c=>({card:r(c),visual:r(c.querySelector('.character-card__visual')),name:r(c.querySelector(':scope>strong')),lock:c.querySelector('.character-lock')?.textContent}))}})()`);
  await screenshot("02-characters");
  console.log("qa:characters");

  await evaluate(`(async()=>{const s=${sceneExpression};HeadbangStoryMode.launchStoryLevel(2);for(let i=0;i<100&&(s.__activeStoryLevelId!=='story-level-02'||document.getElementById('character-screen').classList.contains('is-hidden'));i++)await new Promise(r=>setTimeout(r,25));s.showOnly('tutorial-screen')})()`);
  await sleep(140);
  report.tutorialNoHurt = await evaluate(`(()=>{const r=${rect},panel=document.querySelector('#tutorial-screen .panel'),items=document.querySelector('#tutorial-screen .tutorial-items');return {panel:r(panel),items:r(items),hurtHidden:document.getElementById('tutorial-hurt-card').hidden,start:r(document.getElementById('start-button')),back:r(document.getElementById('tutorial-back')),bass:r(document.querySelector('.tutorial-bass')),miss:r(document.querySelector('.tutorial-item--miss'))}})()`);
  await screenshot("03-tutorial-no-hurt");
  console.log("qa:tutorial-no-hurt");

  await evaluate(`(async()=>{const s=${sceneExpression};HeadbangStoryMode.launchStoryLevel(1);for(let i=0;i<100&&(s.__activeStoryLevelId!=='story-level-01'||document.getElementById('character-screen').classList.contains('is-hidden'));i++)await new Promise(r=>setTimeout(r,25));s.showOnly('tutorial-screen')})()`);
  await sleep(140);
  report.tutorialHurt = await evaluate(`(()=>{const r=${rect};return {panel:r(document.querySelector('#tutorial-screen .panel')),items:r(document.querySelector('#tutorial-screen .tutorial-items')),hurtHidden:document.getElementById('tutorial-hurt-card').hidden,miss:r(document.querySelector('.tutorial-item--miss'))}})()`);
  await screenshot("04-tutorial-hurt");
  console.log("qa:tutorial-hurt");

  await evaluate(`(()=>{const s=${sceneExpression};s.showOnly('settings-screen')})()`);
  await sleep(120);
  report.settings = await evaluate(`(()=>{const r=${rect},panel=document.querySelector('#settings-screen .info-panel');return {panel:r(panel),back:r(document.getElementById('settings-back')),buttons:[...panel.querySelectorAll('button')].map(r),overflow:getComputedStyle(panel).overflowY}})()`);
  await screenshot("05-settings");
  console.log("qa:settings");

  await evaluate(`(()=>{const s=${sceneExpression};s.showOnly('results-screen');document.getElementById('result-kind').textContent='NIVEL COMPLETADO';document.getElementById('results-title').textContent='NIVEL COMPLETADO';document.getElementById('unlock-cta-button').classList.remove('is-hidden');document.getElementById('unlock-cta-button').querySelector('strong').textContent='DESBLOQUEAR A HENRY RITUALS';return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})()`);
  await sleep(120);
  report.results = await evaluate(`(()=>{const r=${rect},panel=document.querySelector('.results-card'),actions=document.querySelector('.results-actions');return {panel:r(panel),kind:r(document.getElementById('result-kind')),title:r(document.getElementById('results-title')),actions:r(actions),buttons:[...actions.children].filter(x=>!x.classList.contains('is-hidden')).map(x=>({text:x.textContent.trim(),...r(x)}))}})()`);
  await screenshot("06-results");
  console.log("qa:results");

  await evaluate(`(()=>{const s=${sceneExpression};s.showOnly('unlock-screen');const u=document.getElementById('unlock-cinematic');u.dataset.phase='complete';document.getElementById('unlock-continue-button').classList.remove('is-hidden');document.getElementById('unlock-skip-button').classList.add('is-hidden');document.getElementById('unlock-character-image').src='/headbangdealers_the_game/assets/character/selector_v009/HD_BT_FRANKALE_FRONT_GAME_SELECT_v009.webp';document.getElementById('unlock-artist-name').textContent='FRANKALE';return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})()`);
  await sleep(140);
  report.unlock = await evaluate(`(()=>{const r=${rect},panel=document.getElementById('unlock-cinematic');return {panel:r(panel),layout:r(document.querySelector('.unlock-layout')),character:r(document.getElementById('unlock-character-image')),continue:r(document.getElementById('unlock-continue-button'))}})()`);
  await screenshot("07-unlock");
  console.log("qa:unlock");

  await evaluate(`(()=>{const s=${sceneExpression};s.showOnly('menu-screen');document.getElementById('menu-screen').classList.add('is-hidden');document.getElementById('hud').classList.remove('is-hidden');document.getElementById('feedback').dataset.kind='PERFECT';document.getElementById('feedback').textContent='PERFECT';document.getElementById('feedback').classList.add('is-active');document.getElementById('usb-pickup-prompt').classList.remove('is-hidden');document.getElementById('usb-pickup-control').textContent='RECOGE LOS ITEMS CON S / ↓';return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})()`);
  await sleep(120);
  report.hud = await evaluate(`(()=>{const r=${rect},top=document.querySelector('.hud__top'),cells=[...top.children];return {top:r(top),cells:cells.map(x=>({id:x.id||x.className,...r(x)})),neck:r(document.querySelector('.meter--neck')),totem:r(document.getElementById('totem-readout')),pickup:r(document.getElementById('usb-pickup-prompt')),feedback:r(document.getElementById('feedback')),feedbackAsset:getComputedStyle(document.getElementById('feedback')).backgroundImage}})()`);
  await screenshot("08-hud-perfect");
  console.log("qa:hud");

  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate(`(()=>{document.documentElement.dataset.device='desktop';document.documentElement.dataset.orientation='landscape';document.documentElement.dataset.layout='desktop';document.documentElement.dataset.mobileLandscapeEnabled='false';const feedback=document.getElementById('feedback');feedback.dataset.kind='PERFECT';feedback.textContent='PERFECT';feedback.classList.add('is-active');return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})()`);
  await sleep(120);
  report.desktopPerfect = await evaluate(`(()=>{const r=${rect},feedback=document.getElementById('feedback');return {feedback:r(feedback),asset:getComputedStyle(feedback).backgroundImage}})()`);
  await screenshot("09-desktop-perfect");
  console.log("qa:desktop-perfect");

  const viewport = { width: 844, height: 390 };
  const inViewport = (box) => box.x >= -1 && box.y >= -1 && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1;
  const noOverflow = (box) => box.scrollW <= box.clientW + 1 && box.scrollH <= box.clientH + 1;
  const assertions = {
    menuFits: inViewport(report.menu.card) && noOverflow(report.menu.card),
    menuCharacterInside: report.menu.image.y >= report.menu.hero.y - 1 && report.menu.image.bottom <= Math.min(report.menu.hero.bottom + 1, viewport.height + 1),
    characterPanelFits: inViewport(report.characters.panel) && noOverflow(report.characters.panel),
    characterCardsFit: report.characters.cards.every(({ card, visual, name }) => inViewport(card) && visual.bottom <= name.y + 1 && name.bottom <= card.bottom + 1),
    lockedCopy: report.characters.cards.filter(({ lock }) => lock).every(({ lock }) => lock.includes("DESBLOQUEA NIVELES")),
    noHurtRemoved: report.tutorialNoHurt.hurtHidden && report.tutorialNoHurt.items.w > 0,
    tutorialFits: [report.tutorialNoHurt, report.tutorialHurt].every(({ panel, items }) => inViewport(panel) && noOverflow(panel) && noOverflow(items)),
    settingsFits: inViewport(report.settings.panel) && noOverflow(report.settings.panel) && inViewport(report.settings.back),
    resultsFit: inViewport(report.results.panel) && noOverflow(report.results.panel) && report.results.buttons.every(inViewport),
    resultTitleMaxTwoLines: report.results.title.h <= Number.parseFloat(await evaluate(`getComputedStyle(document.getElementById('results-title')).lineHeight`)) * 2.1 + 1,
    unlockFits: inViewport(report.unlock.panel) && noOverflow(report.unlock.panel) && inViewport(report.unlock.continue),
    hudSingleRow: report.hud.cells.every((cell) => Math.abs(cell.y - report.hud.top.y) < 2) && inViewport(report.hud.top),
    lowerHudClear: inViewport(report.hud.neck) && inViewport(report.hud.totem),
    perfectAsset: report.hud.feedbackAsset.includes("HD_BT_UI_PERFECT_WORDMARK_v022.png"),
    desktopPerfectAsset: report.desktopPerfect.asset.includes("HD_BT_UI_PERFECT_WORDMARK_v022.png") && report.desktopPerfect.feedback.w > 180,
  };
  report.assertions = assertions;
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(assertions).some((value) => !value)) throw new Error(`Responsive v3 QA failed: ${JSON.stringify(assertions)}`);
} finally {
  socket.close();
  chrome.kill();
}
