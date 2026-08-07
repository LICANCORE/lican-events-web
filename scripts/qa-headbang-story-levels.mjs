import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const port = 4173;
const debugPort = 9347;
const gameUrl = `http://127.0.0.1:${port}/headbangdealers_the_game/?storyDev=1`;
const outputDir = resolve("preview/story-levels");
await mkdir(outputDir, { recursive: true });
let server;
try {
  await fetch(gameUrl);
} catch {
  server = spawn("C:/Program Files/nodejs/npm.cmd", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(), stdio: "ignore", windowsHide: true,
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(gameUrl)).ok) break; } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
}
const profile = await mkdtemp(join(tmpdir(), "headbang-story-levels-qa-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--window-size=1600,1000", "about:blank",
], { stdio: "ignore", windowsHide: true });
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
let targets;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try { targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json()); if (targets.length) break; } catch {}
  await sleep(100);
}
const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
await new Promise((resolvePromise, reject) => {
  socket.addEventListener("open", resolvePromise, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let requestId = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id || !pending.has(message.id)) return;
  const handlers = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) handlers.reject(new Error(message.error.message)); else handlers.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolvePromise, reject) => {
  const id = ++requestId;
  pending.set(id, { resolve: resolvePromise, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const screenshot = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(join(outputDir, name), Buffer.from(result.data, "base64"));
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.__qaErrors=[]; addEventListener('error',e=>window.__qaErrors.push(String(e.error?.stack||e.message))); addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason?.stack||e.reason)));` });
  await send("Page.navigate", { url: gameUrl });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(250);
    await evaluate(`document.querySelector('.newsletter-guest')?.click()`);
    const ready = await evaluate(`Boolean(window.HeadbangStoryLevels && window.HeadbangStoryMode?.getConfig?.() && window.__HEADBANG_GAME__?.scene?.getScenes(false)?.some(scene => scene.__storyLevelsRuntimePatched && scene.__storyFreeModesPatched))`);
    if (ready) break;
  }
  await evaluate(`document.getElementById('newsletter-gate')?.classList.add('is-hidden'); document.getElementById('initial-loader')?.remove(); document.documentElement.dataset.appVisible='true'`);
  const levels = [
    "story-henry-phase-1", "story-hydraxxx-phase-1", "story-beutnoise-phase-1", "story-henry-phase-2",
    "story-hydraxxx-phase-2", "story-magic-bite", "story-treze", "story-henry-phase-3",
  ];
  const activation = {};
  for (const id of levels) {
    activation[id] = await evaluate(`(async()=>{await HeadbangStoryLevels.activate(${JSON.stringify(id)}); const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; return {id:s.activeLevel.id, bpm:s.beatmap.bpm, events:s.beatmap.events.length, audio:s.cache.audio.exists('track-'+s.selectedSong), background:s.textures.exists(s.backgroundTexture()), totems:${JSON.stringify([0,25,50,75,100])}.filter(v=>s.textures.exists(s.totemTexture(v))).length};})()`);
  }
  const level2 = await evaluate(`(async()=>{await HeadbangStoryLevels.activate('story-henry-phase-1'); const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; s.showOnly(null); document.getElementById('hud').classList.remove('is-hidden'); s.mode='playing'; s.audioStartAt=null; s.fallbackStartAt=performance.now()-30100; await new Promise(r=>setTimeout(r,350)); return {totemVisible:s.totem.visible, background:s.background.texture.key, actors:HeadbangStoryLevels.getActorSummary().length};})()`);
  await screenshot("level-02-open-door-bats.png");
  const level6 = await evaluate(`(async()=>{await HeadbangStoryLevels.activate('story-beutnoise-phase-1'); const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; s.showOnly(null); document.getElementById('hud').classList.remove('is-hidden'); s.mode='playing'; s.applyLevelWorldTextures(); const prompt=document.getElementById('usb-pickup-prompt'); prompt.classList.remove('is-hidden'); await new Promise(r=>requestAnimationFrame(r)); const box=prompt.getBoundingClientRect(); const before={ground:s.characterBaseY,backgroundY:s.background.y,eyes:s.ambientEyes.filter(x=>x.visible).map(x=>({x:x.x,y:x.y})),prompt:{width:box.width,height:box.height,scrollWidth:prompt.scrollWidth,scrollHeight:prompt.scrollHeight}}; s.revealAmbientRabbits(); await new Promise(r=>setTimeout(r,900)); prompt.classList.add('is-hidden'); return {...before,rabbits:s.ambientRabbits.filter(x=>x.visible).length,visibleEyes:s.ambientEyes.filter(x=>x.visible).length};})()`);
  await screenshot("level-06-ground-eyes-rabbits.png");
  const level7 = await evaluate(`(async()=>{await HeadbangStoryLevels.activate('story-henry-phase-2'); const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; s.showOnly(null); s.mode='playing'; s.audioStartAt=null; s.fallbackStartAt=performance.now()-9000; await new Promise(r=>setTimeout(r,250)); const before=HeadbangStoryLevels.getActorSummary(); const enemy=s.children.list.find(x=>x.texture?.key?.startsWith('story-skeleton-')); if(enemy){enemy.x=s.character.x+40; enemy.y=s.character.y; s.playHeadbang('PERFECT');} await new Promise(r=>setTimeout(r,80)); return {before,after:HeadbangStoryLevels.getActorSummary(),boneVisible:s.children.list.some(x=>x.texture?.key==='story-bone-pile'&&x.visible)};})()`);
  const level14 = await evaluate(`(async()=>{await HeadbangStoryLevels.activate('story-henry-phase-3'); const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; s.showOnly(null); document.getElementById('hud').classList.remove('is-hidden'); s.mode='playing'; s.audioStartAt=null; s.fallbackStartAt=performance.now()-5500; await new Promise(r=>setTimeout(r,250)); const bat=s.children.list.find(x=>x.texture?.key?.startsWith('story-bat-')); if(bat){bat.x=s.character.x+30; bat.y=s.character.y-45; s.playHeadbang('PERFECT');} await new Promise(r=>setTimeout(r,100)); const fallen=s.children.list.find(x=>x.texture?.key==='story-fallen-bat'&&x.visible); return {fallen:Boolean(fallen),fallenHeight:fallen?.displayHeight,expectedHeight:s.layout.height*.045,screen404:s.children.list.some(x=>x.text==='404 NOT FOUND'&&x.visible), neck:s.run.neck};})()`);
  const level8 = await evaluate(`(async()=>{const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; HeadbangStoryLevels.deactivate(); s.setActiveLevel('level-5-onionstep',false); const before=s.beatmap.events.length; const enhanced=HeadbangStoryLevels.enhanceNativeLevel(8); const finalBass=s.beatmap.events.filter(x=>String(x.id).startsWith('STORY_L8_FINAL_BASS_')); await HeadbangStoryLevels.activateFeatures(8); s.showOnly(null); s.mode='playing'; s.audioStartAt=null; s.fallbackStartAt=performance.now()-9200; await new Promise(r=>setTimeout(r,250)); return {actors:HeadbangStoryLevels.getActorSummary(), razor:s.children.list.some(x=>x.texture?.key==='story-razor-wire'&&x.visible),enhanced,before,after:s.beatmap.events.length,finalBass:finalBass.map(x=>x.timeMs),duration:s.beatmap.audioDurationMs};})()`);
  const level9 = await evaluate(`(async()=>{const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; HeadbangStoryLevels.deactivate(); s.setActiveLevel('level-6-faye',false); await HeadbangStoryLevels.activateFeatures(9); s.showOnly(null); s.mode='playing'; s.audioStartAt=null; s.fallbackStartAt=performance.now()-8200; await new Promise(r=>setTimeout(r,250)); const riot=s.children.list.find(x=>x.texture?.key?.startsWith('story-riot-charge-')); if(riot){riot.x=s.character.x+35; riot.y=s.character.y; s.playHeadbang('PERFECT');} await new Promise(r=>setTimeout(r,90)); return {actors:HeadbangStoryLevels.getActorSummary(), defeated:s.children.list.some(x=>x.texture?.key==='story-riot-defeated'&&x.visible)};})()`);
  const perfectReaction = await evaluate(`(async()=>{await HeadbangStoryLevels.activate('story-hydraxxx-phase-1'); const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; s.mode='playing'; s.character.x=s.totem.x-80; const before=s.run.integrity; const event={processed:false,hitType:'NORMAL',baseDamageScalar:1,chargesBassMeter:true,timeMs:0}; s.applyJudgement(event,'PERFECT'); await new Promise(r=>setTimeout(r,30)); let waves=0; const wave=s.spawnWave; s.spawnWave=()=>{waves++}; s.run.dropActive=false; s.beatmap.dropStartMs=0; s.beatmap.dropEndMs=10000; s.activateDropIfReady(100); s.spawnWave=wave; return {damaged:s.run.integrity<before,piece:s.children.list.some(x=>x.texture?.key?.startsWith('story-totem-piece-5-')&&x.visible),passiveWaves:waves};})()`);
  await screenshot("level-14-404-and-bats.png");
  const campaign = await evaluate(`(()=>{const c=HeadbangStoryMode.getConfig(); const l2=c.levels.find(x=>x.storyOrder===2); return {count:c.levels.length, playable:c.levels.filter(x=>x.playable).map(x=>x.storyOrder), level2Reward:l2.reward.type};})()`);
  const level2Results = await evaluate(`(async()=>{await HeadbangStoryLevels.activate('story-henry-phase-1'); const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; s.__activeStoryLevelId='story-level-02'; s.showResults(true); return {itemHidden:document.getElementById('result-item').classList.contains('is-hidden'), next:document.getElementById('next-level-button').textContent.trim(), completed:HeadbangStoryMode.getProgress().completedLevels.includes('story-level-02'), reward:document.getElementById('result-unlock-level').textContent.trim()};})()`);
  await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await sleep(350);
  const mobile = await evaluate(`(async()=>{await HeadbangStoryLevels.activate('story-henry-phase-2'); const s=__HEADBANG_GAME__.scene.getScenes(false)[0]; s.handleResize?.(true); s.showOnly(null); document.getElementById('hud').classList.remove('is-hidden'); s.mode='playing'; s.audioStartAt=null; s.fallbackStartAt=performance.now()-31000; await new Promise(r=>setTimeout(r,250)); return {layout:[s.layout.width,s.layout.height], skeletons:HeadbangStoryLevels.getActorSummary().filter(x=>x.kind==='skeleton').length, canvas:document.querySelector('#canvas-host canvas')?.getBoundingClientRect().toJSON()};})()`);
  await screenshot("level-07-mobile-skeletons.png");
  const errors = await evaluate(`window.__qaErrors`);
  const report = { activation, level2, level6, level7, level8, level9, level14, perfectReaction, campaign, level2Results, mobile, errors };
  if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);
  if (!level2.background.endsWith("background-open") || level2.totemVisible || level2.actors < 20) throw new Error(`Level 2 failed: ${JSON.stringify(level2)}`);
  if (level6.ground !== 413 || level6.backgroundY > -700 || level6.eyes.length !== 6 || level6.eyes.some(({x})=>x < 170 || x > 675) || level6.rabbits !== 6 || level6.visibleEyes || level6.prompt.scrollWidth > level6.prompt.width || level6.prompt.scrollHeight > level6.prompt.height) throw new Error(`Level 6 failed: ${JSON.stringify(level6)}`);
  if (!level7.boneVisible || !level14.fallen || Math.abs(level14.fallenHeight-level14.expectedHeight)>1 || !level14.screen404) throw new Error(`Actor interactions failed: ${JSON.stringify({ level7, level14 })}`);
  if (!level8.enhanced || level8.finalBass.length < 4 || level8.after <= level8.before || level8.finalBass.some(time=>time<level8.duration-10000||time>=level8.duration)) throw new Error(`Level 8 final beatmap failed: ${JSON.stringify(level8)}`);
  if (!level8.razor || !level9.defeated) throw new Error(`New HURT actors failed: ${JSON.stringify({ level8, level9 })}`);
  if (!perfectReaction.damaged || !perfectReaction.piece || perfectReaction.passiveWaves) throw new Error(`Perfect reaction failed: ${JSON.stringify(perfectReaction)}`);
  if (!level2Results.itemHidden || !level2Results.completed || level2Results.next !== "SIGUIENTE NIVEL") throw new Error(`Level 2 results failed: ${JSON.stringify(level2Results)}`);
  if (!mobile.skeletons || mobile.canvas.width > 844 || mobile.canvas.height > 390) throw new Error(`Mobile layout failed: ${JSON.stringify(mobile)}`);
  for (const [id, state] of Object.entries(activation)) {
    const validEvents = id === "story-henry-phase-1" ? state.events === 0 : state.events >= 45;
    if (!state.audio || !state.background || !validEvents || (id !== "story-henry-phase-1" && state.totems !== 5)) throw new Error(`Activation failed ${id}: ${JSON.stringify(state)}`);
  }
  await writeFile(join(outputDir, "qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket.close();
  chrome.kill();
  server?.kill();
}
