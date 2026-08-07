import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const gameUrl = "http://127.0.0.1:4173/headbangdealers_the_game/?storyDev=1";
const port = 9351;
const profile = await mkdtemp(join(tmpdir(), "headbang-responsive-qa-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, "--window-size=1600,900", "about:blank",
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

try {
  await send("Page.enable");
  await send("Runtime.enable");
  const start = performance.now();
  await send("Page.navigate", { url: gameUrl });
  let loader;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await sleep(100);
    loader = await evaluate(`(()=>{const e=document.getElementById('initial-loader');return {done:!e||e.classList.contains('is-complete'),fraction:document.getElementById('loader-fraction')?.textContent,status:document.getElementById('loader-status')?.textContent,teeth:[...document.querySelectorAll('.loader-tooth')].map(x=>getComputedStyle(x).getPropertyValue('--landing-x'))}})()`);
    if (loader.done) break;
  }
  loader.elapsedMs = Math.round(performance.now() - start);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await evaluate(`document.getElementById('newsletter-gate')?.offsetHeight > 0`)) break;
    await sleep(100);
  }
  const desktopGate = await evaluate(`(()=>{const g=document.getElementById('newsletter-gate'),p=document.getElementById('newsletter-form');return {window:[innerWidth,innerHeight],body:[document.body.scrollWidth,document.body.scrollHeight],gate:[g.clientHeight,g.scrollHeight,getComputedStyle(g).overflowY],panel:[p.clientHeight,p.scrollHeight,getComputedStyle(p).overflowY],music:__HEADBANG_BASSQUAKE__?.getState()}})()`);
  await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await sleep(250);
  const mobileGate = await evaluate(`(()=>{const g=document.getElementById('newsletter-gate'),p=document.getElementById('newsletter-form');return {window:[innerWidth,innerHeight],gate:[g.clientHeight,g.scrollHeight],panel:[p.clientHeight,p.scrollHeight],body:[document.body.clientHeight,document.body.scrollHeight]}})()`);
  await evaluate(`document.querySelector('.newsletter-guest')?.click()`);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await sleep(100);
    if (await evaluate(`Boolean(window.HeadbangStoryMode?.getConfig?.() && window.__HEADBANG_GAME__?.scene?.getScenes(false)?.[0]?.__storyRevisionV2Patched)`)) break;
  }
  const interfaceState = await evaluate(`(async()=>{const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; document.getElementById('newsletter-gate')?.classList.add('is-hidden'); document.documentElement.dataset.appVisible='true'; s.showOnly('character-screen'); await new Promise(r=>requestAnimationFrame(r)); const c=document.querySelector('.character-select'); const character=[c.clientHeight,c.scrollHeight,getComputedStyle(c).overflowY]; s.__headbangGameMode='story'; s.buildLevelSelectionUi(); s.showOnly('levels-screen'); await new Promise(r=>requestAnimationFrame(r)); const l=document.querySelector('.levels-select'); const cards=[...document.querySelectorAll('.story-level-card')]; const cardFits=cards.map(card=>({id:card.dataset.levelId,card:[card.clientHeight,card.scrollHeight],title:(()=>{const e=card.querySelector('.level-card__artist');return [e.clientHeight,e.scrollHeight]})()})); for(let i=0;i<3;i++){document.getElementById('levels-next')?.click();await new Promise(r=>requestAnimationFrame(r));} const level15=document.querySelector('[data-level-id="story-level-15"]'); const comingSoon={state:level15?.querySelector('.level-card__state')?.textContent.trim(),placeholder:level15?.classList.contains('is-placeholder'),filter:getComputedStyle(level15?.querySelector('.level-card__background')).filter}; HeadbangStoryMode.launchStoryLevel(1); await new Promise(r=>setTimeout(r,650)); const characterTitle={lines:document.getElementById('character-title')?.children.length,text:document.getElementById('character-title')?.innerText,level:document.querySelector('.character-title__level')?.textContent,menu:document.getElementById('character-menu-button')?.textContent}; await HeadbangStoryLevels.activate('story-henry-phase-1'); HeadbangStoryLevels.deactivate(); s.setActiveLevel('tutorial',false); return {character,levels:[l.clientHeight,l.scrollHeight,getComputedStyle(l).overflowY],cardFits,comingSoon,characterTitle,totemPreviews:document.querySelectorAll('.level-card__totem').length,firstName:cards[0]?.querySelector('.level-card__artist')?.textContent.trim(),activeDefinition:HeadbangStoryLevels.getActiveDefinition(),actors:HeadbangStoryLevels.getActorSummary().length,totemVisible:s.totem.visible,background:s.background.texture.key};})()`);
  const report = { loader, desktopGate, mobileGate, interfaceState };
  if (!loader.done || loader.elapsedMs >= 10000 || loader.fraction !== "4/4" || loader.status !== "CARGANDO BEATS AL MARGEN DEL CONTROL" || new Set(loader.teeth).size < 3) throw new Error(`Loader QA failed: ${JSON.stringify(loader)}`);
  for (const data of [desktopGate, mobileGate]) {
    if (data.gate[1] > data.gate[0] || data.panel[1] > data.panel[0] || data.body[1] > data.body[0]) throw new Error(`Viewport overflow: ${JSON.stringify(data)}`);
  }
  if (interfaceState.character[1] > interfaceState.character[0] || interfaceState.levels[1] > interfaceState.levels[0] || interfaceState.cardFits.some(({card,title})=>card[1]>card[0]||title[1]>title[0]) || interfaceState.comingSoon.state !== "COMING SOON" || !interfaceState.comingSoon.placeholder || !interfaceState.comingSoon.filter.includes("grayscale(1)") || interfaceState.characterTitle.lines !== 2 || !interfaceState.characterTitle.level?.startsWith("LEVEL 1 · ") || interfaceState.characterTitle.menu !== "MENÚ PRINCIPAL" || interfaceState.totemPreviews || interfaceState.firstName !== "El Último Altavoz" || interfaceState.activeDefinition || interfaceState.actors || !interfaceState.totemVisible || interfaceState.background.includes("story-level-2")) throw new Error(`Interface/state QA failed: ${JSON.stringify(interfaceState)}`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket.close();
  chrome.kill();
}
