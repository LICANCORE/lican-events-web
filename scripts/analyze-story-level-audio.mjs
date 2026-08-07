import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const debugPort = 9341;
const origin = `http://127.0.0.1:${debugPort}`;
const gameOrigin = process.argv[2] ?? "http://127.0.0.1:4173";
const output = resolve("public/headbangdealers_the_game/assets/story-levels/beatmaps.json");
const profile = await mkdtemp(join(tmpdir(), "headbang-audio-analysis-"));
let localServer = null;
const files = {
  1: "track.wav",
  2: "track.wav",
  5: "track.wav",
  6: "track.mp3",
  7: "track.mp3",
  10: "track.wav",
  12: "track.mp3",
  13: "track.wav",
  14: "track.mp3",
};
const cuts = {
  1: [0, 9999],
  2: [0, 61],
  5: null,
  6: null,
  7: [26, 144],
  10: [97, 181],
  12: [25, 143],
  13: [85, 165],
  14: [70, 161],
};
const autoDurations = { 5: 105, 6: 90 };

try {
  await fetch(`${gameOrigin}/headbangdealers_the_game/`);
} catch {
  localServer = spawn("C:/Program Files/nodejs/npm.cmd", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173"], {
    cwd: process.cwd(), stdio: "ignore", windowsHide: true,
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${gameOrigin}/headbangdealers_the_game/`);
      if (response.ok) break;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
}

const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore", windowsHide: true });
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
let targets;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    targets = await fetch(`${origin}/json/list`).then((response) => response.json());
    if (targets.length) break;
  } catch {}
  await sleep(100);
}
if (!targets?.length) throw new Error("Chrome DevTools did not start");
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
  if (message.error) handlers.reject(new Error(message.error.message));
  else handlers.resolve(message.result);
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

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: `${gameOrigin}/headbangdealers_the_game/` });
  await sleep(1000);
  const result = await evaluate(`(async () => {
    const files = ${JSON.stringify(files)};
    const cuts = ${JSON.stringify(cuts)};
    const autoDurations = ${JSON.stringify(autoDurations)};
    const context = new AudioContext();
    const output = {};

    const analyse = (buffer, requestedCut, level) => {
      const channel = buffer.getChannelData(0);
      const rate = buffer.sampleRate;
      const hop = 512;
      const frameRate = rate / hop;
      const frames = Math.ceil(channel.length / hop);
      const bass = new Float32Array(frames);
      let low = 0;
      const alpha = 1 - Math.exp(-2 * Math.PI * 170 / rate);
      for (let frame = 0; frame < frames; frame += 1) {
        let energy = 0;
        const start = frame * hop;
        const end = Math.min(channel.length, start + hop);
        for (let sample = start; sample < end; sample += 1) {
          low += alpha * (channel[sample] - low);
          energy += low * low;
        }
        bass[frame] = Math.sqrt(energy / Math.max(1, end - start));
      }
      let cut = requestedCut;
      if (!cut) {
        const windowSeconds = Math.min(autoDurations[level] ?? 105, buffer.duration - 2);
        let bestStart = 0;
        let bestScore = -1;
        for (let start = 0; start + windowSeconds <= buffer.duration; start += 2) {
          const a = Math.floor(start * frameRate);
          const b = Math.floor((start + windowSeconds) * frameRate);
          let sum = 0;
          let changes = 0;
          for (let i = a + 1; i < b; i += 1) {
            sum += bass[i];
            changes += Math.max(0, bass[i] - bass[i - 1] * 1.04);
          }
          const score = sum / (b - a) + changes * 2.2 / (b - a);
          if (score > bestScore) { bestScore = score; bestStart = start; }
        }
        cut = [bestStart, bestStart + windowSeconds];
      }
      cut = [Math.max(0, cut[0]), Math.min(buffer.duration, cut[1])];
      const from = Math.floor(cut[0] * frameRate);
      const to = Math.floor(cut[1] * frameRate);
      const onset = new Float32Array(to - from);
      let onsetMax = 0;
      for (let i = from + 2; i < to; i += 1) {
        const value = Math.max(0, bass[i] - (bass[i - 1] * .72 + bass[i - 2] * .28));
        onset[i - from] = value;
        onsetMax = Math.max(onsetMax, value);
      }
      if (onsetMax) for (let i = 0; i < onset.length; i += 1) onset[i] /= onsetMax;

      let bestBpm = 120;
      let bestCorrelation = -1;
      for (let bpm = 76; bpm <= 178; bpm += .25) {
        const lag = Math.round(frameRate * 60 / bpm);
        let correlation = 0;
        for (let i = lag; i < onset.length; i += 1) correlation += onset[i] * onset[i - lag];
        correlation /= Math.max(1, onset.length - lag);
        const tempoBias = 1 - Math.abs(bpm - 126) / 420;
        if (correlation * tempoBias > bestCorrelation) {
          bestCorrelation = correlation * tempoBias;
          bestBpm = bpm;
        }
      }
      const beatSeconds = 60 / bestBpm;
      let phase = 0;
      let phaseScore = -1;
      for (let candidate = 0; candidate < beatSeconds; candidate += 1 / frameRate) {
        let score = 0;
        for (let time = candidate; time < cut[1] - cut[0]; time += beatSeconds) {
          const index = Math.round(time * frameRate);
          score += onset[index] ?? 0;
        }
        if (score > phaseScore) { phaseScore = score; phase = candidate; }
      }
      const candidates = [];
      for (let time = phase; time < cut[1] - cut[0] - .3; time += beatSeconds / 2) {
        const center = Math.round(time * frameRate);
        const radius = Math.max(1, Math.round(frameRate * .065));
        let peak = center;
        for (let i = Math.max(0, center - radius); i <= Math.min(onset.length - 1, center + radius); i += 1) {
          if (onset[i] > onset[peak]) peak = i;
        }
        const strength = onset[peak] + ((Math.round((time - phase) / beatSeconds) % 4 === 0) ? .18 : 0);
        candidates.push({ time: peak / frameRate, strength });
      }
      const targetCount = Math.min(78, Math.max(58, Math.round((cut[1] - cut[0]) * .68)));
      const bucketSeconds = (cut[1] - cut[0]) / targetCount;
      const selected = [];
      for (let bucket = 0; bucket < targetCount; bucket += 1) {
        const center = (bucket + .5) * bucketSeconds;
        const inBucket = candidates.filter((candidate) => Math.abs(candidate.time - center) <= bucketSeconds * .72);
        const best = (inBucket.length ? inBucket : candidates).sort((a, b) => {
          const scoreA = a.strength - Math.abs(a.time - center) / bucketSeconds * .12;
          const scoreB = b.strength - Math.abs(b.time - center) / bucketSeconds * .12;
          return scoreB - scoreA;
        })[0];
        if (best && !selected.includes(best)) selected.push(best);
      }
      selected.sort((a, b) => a.time - b.time);
      const events = selected.map((event, index) => ({
        id: "STORY_LVL_EVENT_" + String(index + 1).padStart(3, "0"),
        timeMs: Math.round(event.time * 1000),
        hitType: event.strength > .72 ? "ACCENT" : event.strength > .38 ? "SYNCOPATED" : "STANDARD",
        baseDamageScalar: event.strength > .72 ? 1.3 : event.strength > .38 ? 1.1 : 1,
        chargesBassMeter: true,
      }));
      if (level === 5) {
        [53136, 53525, 53914].forEach((timeMs, index) => events.push({
          id: "STORY_L5_DENSE_53_" + (index + 1), timeMs, hitType: "ACCENT", baseDamageScalar: 1.25, chargesBassMeter: true,
        }));
        events.sort((a, b) => a.timeMs - b.timeMs);
      }
      return {
        sourceDurationSec: Number(buffer.duration.toFixed(3)),
        sourceStartSec: Number(cut[0].toFixed(3)),
        sourceEndSec: Number(cut[1].toFixed(3)),
        bpm: Number(bestBpm.toFixed(2)),
        analysisConfidence: Number(Math.min(1, bestCorrelation * 180).toFixed(3)),
        audioDurationMs: Math.round((cut[1] - cut[0]) * 1000),
        dropStartMs: Math.round((cut[1] - cut[0]) * .62 * 1000),
        dropEndMs: Math.round((cut[1] - cut[0]) * .84 * 1000),
        events,
      };
    };

    for (const [level, file] of Object.entries(files)) {
      const response = await fetch("/headbangdealers_the_game/assets/story-levels/level-" + level + "/" + file);
      if (!response.ok) throw new Error("Cannot load level " + level + ": " + response.status);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      output[level] = analyse(buffer, cuts[level], Number(level));
    }
    await context.close();
    return output;
  })()`);
  await writeFile(output, `${JSON.stringify({ version: 1, generatedBy: "WebAudio bass-onset analysis", levels: result }, null, 2)}\n`);
  console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([level, map]) => [level, {
    cut: [map.sourceStartSec, map.sourceEndSec], bpm: map.bpm, confidence: map.analysisConfidence, events: map.events.length,
  }])), null, 2));
} finally {
  socket.close();
  chrome.kill();
  localServer?.kill();
}
