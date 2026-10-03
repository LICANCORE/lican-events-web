const $ = (selector) => document.querySelector(selector);
const canvas = $('#visualizer');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const audio = $('#audio');
const fileInput = $('#audioFile');
const dropZone = $('#dropZone');
const playButton = $('#playButton');
const seek = $('#seek');
const recordButton = $('#recordButton');
const manualKickButton = $('#manualKickButton');

const VIDEO_BITS_PER_SECOND = 4000000;
const AUDIO_BITS_PER_SECOND = 192000;
const CAPTURE_FPS = 60;
const PRESETS = ['ring', 'shards', 'grid', 'chrome', 'tunnel', 'minimal'];
const requestedPreset = new URLSearchParams(window.location.search).get('preset');

const state = {
  preset: PRESETS.includes(requestedPreset) ? requestedPreset : 'ring',
  intensity: 0.82,
  bounce: 0.12,
  particles: true,
  shockwaves: true,
  waveform: true,
  effects: {
    voiceBars: true,
    bassDust: true,
    laserStreaks: true,
    orbitDots: true,
    pulseTunnel: true,
    chromaticArcs: true,
    scanlines: true,
  },
  loaded: false,
  recording: false,
  exporting: false,
  syncOffsetMs: 0,
  bands: { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0 },
  smoothed: { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0 },
  kick: 0,
  transient: 0,
};

let audioContext;
let sourceNode;
let analyser;
let mediaDestination;
let frequencyData;
let timeData;
let recorder;
let wakeLock;
let chunks = [];
let performanceSession = null;
let replaySession = null;
let finishingReplay = false;
let currentFileName = 'headbang-visualizer';
let currentFormat = 'AUDIO';
let preparedLogo = null;
let lastFrame = performance.now();
let elapsed = 0;
let highAverage = 0.06;
let lastTransientAt = 0;
let toastTimer;
const logo = new Image();
const particles = [];
const shockwaves = [];
const shards = [];
const stars = [];
const dust = [];
const orbitDots = [];
const streaks = [];
const crystalFacets = [];
const mercuryBands = [];
const mercuryDrops = [];

function seeded(index, salt = 0) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function initialiseAssets() {
  for (let i = 0; i < 220; i += 1) particles.push({
    angle: seeded(i, 1) * Math.PI * 2,
    radius: 425 + seeded(i, 2) * 500,
    size: 1.2 + seeded(i, 3) * 4.2,
    speed: 0.012 + seeded(i, 4) * 0.035,
    phase: seeded(i, 5) * Math.PI * 2,
    violet: seeded(i, 6) > 0.91,
  });
  for (let i = 0; i < 60; i += 1) shards.push({
    angle: (i / 60) * Math.PI * 2 + (seeded(i, 8) - 0.5) * 0.11,
    width: 7 + seeded(i, 9) * 19,
    length: 70 + seeded(i, 10) * 175,
    offset: seeded(i, 11) * 42,
  });
  for (let i = 0; i < 170; i += 1) stars.push({
    x: seeded(i, 12) * canvas.width,
    y: seeded(i, 13) * canvas.height,
    size: 0.7 + seeded(i, 14) * 2.1,
    phase: seeded(i, 15) * Math.PI * 2,
  });
  for (let i = 0; i < 150; i += 1) dust.push({
    angle: seeded(i, 16) * Math.PI * 2,
    radius: 430 + seeded(i, 17) * 410,
    size: 1 + seeded(i, 18) * 3.5,
    depth: 0.35 + seeded(i, 19) * 0.65,
  });
  for (let i = 0; i < 28; i += 1) orbitDots.push({
    angle: seeded(i, 20) * Math.PI * 2,
    radius: 430 + seeded(i, 21) * 105,
    size: 2.5 + seeded(i, 22) * 6,
    speed: (seeded(i, 23) > 0.5 ? 1 : -1) * (0.08 + seeded(i, 24) * 0.2),
  });
  for (let i = 0; i < 34; i += 1) streaks.push({
    angle: seeded(i, 25) * Math.PI * 2,
    inner: 470 + seeded(i, 26) * 190,
    length: 35 + seeded(i, 27) * 120,
    weight: 1 + seeded(i, 28) * 3,
  });
  for (let ring = 0; ring < 5; ring += 1) {
    const count = 16 + ring * 4;
    for (let i = 0; i < count; i += 1) {
      const id = ring * 100 + i;
      const a0 = (i / count) * Math.PI * 2 + (seeded(id, 29) - 0.5) * 0.08;
      const a1 = ((i + 1) / count) * Math.PI * 2 + (seeded(id, 30) - 0.5) * 0.08;
      crystalFacets.push({
        a0,
        a1,
        inner: 285 + ring * 135 + seeded(id, 31) * 26,
        outer: 420 + ring * 158 + seeded(id, 32) * 52,
        split: seeded(id, 33),
        depth: 0.35 + seeded(id, 34) * 0.65,
        violet: seeded(id, 35) > 0.78,
      });
    }
  }
  for (let i = 0; i < 9; i += 1) mercuryBands.push({
    y: 170 + i * 205 + seeded(i, 36) * 80,
    amplitude: 34 + seeded(i, 37) * 72,
    width: 24 + seeded(i, 38) * 54,
    frequency: 1.2 + seeded(i, 39) * 1.8,
    phase: seeded(i, 40) * Math.PI * 2,
    drift: (seeded(i, 41) > 0.5 ? 1 : -1) * (0.12 + seeded(i, 42) * 0.22),
    violet: i % 3 === 1,
  });
  for (let i = 0; i < 38; i += 1) mercuryDrops.push({
    x: seeded(i, 43) * canvas.width,
    y: seeded(i, 44) * canvas.height,
    radius: 5 + seeded(i, 45) * 22,
    phase: seeded(i, 46) * Math.PI * 2,
    violet: seeded(i, 47) > 0.64,
  });
}

function prepareLogo(image) {
  const offscreen = document.createElement('canvas');
  offscreen.width = image.naturalWidth;
  offscreen.height = image.naturalHeight;
  const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(image, 0, 0);
  const pixels = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const red = pixels.data[i];
    const green = pixels.data[i + 1];
    const blue = pixels.data[i + 2];
    pixels.data[i + 3] = Math.min(255, Math.max(0, green - Math.max(red, blue)) * 3.2);
  }
  offCtx.putImageData(pixels, 0, 0);
  preparedLogo = offscreen;
}

logo.addEventListener('load', () => prepareLogo(logo));
logo.src = 'assets/headbang-dealers.png';
initialiseAssets();

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function formatTime(value) {
  if (!Number.isFinite(value)) return '00:00';
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

function getOutputLatencySeconds() {
  if (!audioContext) return 0;
  try {
    const stamp = audioContext.getOutputTimestamp?.();
    if (stamp && Number.isFinite(stamp.contextTime)) {
      const measured = audioContext.currentTime - stamp.contextTime;
      if (measured >= 0 && measured < 0.8) return measured;
    }
  } catch { /* use the standards-based fallback below */ }
  return Math.min(0.8, Math.max(0, (audioContext.baseLatency || 0) + (audioContext.outputLatency || 0)));
}

function getSyncCorrectionSeconds() {
  return Math.max(-0.5, Math.min(0.8, getOutputLatencySeconds() + state.syncOffsetMs / 1000));
}

function updateLatencyReadout() {
  const output = $('#syncOffsetOutput');
  if (!output) return;
  const autoMs = Math.round(getOutputLatencySeconds() * 1000);
  const manual = state.syncOffsetMs;
  output.textContent = manual === 0 ? `AUTO · ${autoMs} ms` : `${autoMs + manual} ms`;
}

function clonePerformanceConfig() {
  return {
    preset: state.preset,
    intensity: state.intensity,
    bounce: state.bounce,
    particles: state.particles,
    shockwaves: state.shockwaves,
    waveform: state.waveform,
    effects: { ...state.effects },
  };
}

function restorePerformanceConfig(config) {
  state.preset = config.preset;
  state.intensity = config.intensity;
  state.bounce = config.bounce;
  state.particles = config.particles;
  state.shockwaves = config.shockwaves;
  state.waveform = config.waveform;
  state.effects = { ...config.effects };
}

function logPerformanceEvent(type, value = null) {
  if (!state.recording || state.exporting || !performanceSession) return;
  const time = Math.max(0, audio.currentTime - getSyncCorrectionSeconds());
  performanceSession.events.push({ time, type, value });
}

function resetReactiveState() {
  state.kick = 0;
  state.transient = 0;
  Object.keys(state.bands).forEach((key) => { state.bands[key] = 0; });
  Object.keys(state.smoothed).forEach((key) => { state.smoothed[key] = 0; });
  shockwaves.length = 0;
  elapsed = 0;
  lastFrame = performance.now();
}

function ensureAudioGraph() {
  if (audioContext) return;
  audioContext = new AudioContext({ latencyHint: 'interactive' });
  sourceNode = audioContext.createMediaElementSource(audio);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.55;
  analyser.minDecibels = -92;
  analyser.maxDecibels = -16;
  mediaDestination = audioContext.createMediaStreamDestination();
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
  analyser.connect(mediaDestination);
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);
  updateLatencyReadout();
}

function averageBand(lowHz, highHz) {
  if (!analyser || !frequencyData) return 0;
  const binHz = audioContext.sampleRate / analyser.fftSize;
  const start = Math.max(0, Math.floor(lowHz / binHz));
  const end = Math.min(frequencyData.length - 1, Math.ceil(highHz / binHz));
  let sum = 0;
  for (let i = start; i <= end; i += 1) sum += frequencyData[i];
  return sum / Math.max(1, end - start + 1) / 255;
}

function triggerKick({ log = true } = {}) {
  if (log) logPerformanceEvent('kick');
  state.kick = 1;
  if (state.shockwaves) shockwaves.push({ radius: 385, alpha: 0.9, width: 9 });
  manualKickButton.classList.remove('is-triggered');
  void manualKickButton.offsetWidth;
  manualKickButton.classList.add('is-triggered');
  setTimeout(() => manualKickButton.classList.remove('is-triggered'), 130);
}

function applyPerformanceEvent(event) {
  if (event.type === 'kick') {
    triggerKick({ log: false });
  } else if (event.type === 'preset') {
    state.preset = event.value;
  } else if (event.type === 'intensity') {
    state.intensity = event.value;
  } else if (event.type === 'bounce') {
    state.bounce = event.value;
  } else if (event.type === 'toggle') {
    state[event.value.name] = event.value.checked;
  } else if (event.type === 'effect') {
    state.effects[event.value.name] = event.value.checked;
  }
}

function replayDueEvents() {
  if (!state.exporting || !replaySession) return;
  const now = audio.currentTime + 0.5 / CAPTURE_FPS;
  while (replaySession.cursor < replaySession.events.length && replaySession.events[replaySession.cursor].time <= now) {
    applyPerformanceEvent(replaySession.events[replaySession.cursor]);
    replaySession.cursor += 1;
  }
}

function analyseAudio(now, dt) {
  state.kick *= Math.pow(0.035, dt);
  if (!analyser || audio.paused) {
    Object.keys(state.smoothed).forEach((key) => { state.smoothed[key] *= Math.pow(0.045, dt); });
    state.transient *= Math.pow(0.02, dt);
    return;
  }
  analyser.getByteFrequencyData(frequencyData);
  analyser.getByteTimeDomainData(timeData);
  state.bands = {
    sub: averageBand(24, 58),
    bass: averageBand(58, 180),
    lowMid: averageBand(180, 520),
    mid: averageBand(520, 2200),
    high: averageBand(2200, 8200),
    air: averageBand(8200, 16000),
  };
  Object.keys(state.bands).forEach((key) => {
    const incoming = state.bands[key];
    const rate = incoming > state.smoothed[key] ? 0.48 : 0.105;
    state.smoothed[key] += (incoming - state.smoothed[key]) * rate;
  });
  highAverage = highAverage * 0.97 + state.bands.high * 0.03;
  const transientDetected = state.bands.high > Math.max(0.18, highAverage * 1.34) && now - lastTransientAt > 82;
  if (transientDetected) {
    state.transient = 1;
    lastTransientAt = now;
  } else {
    state.transient *= Math.pow(0.018, dt);
  }
}

function drawBackground(w, h, bands) {
  const sub = bands.sub * state.intensity;
  const gradient = ctx.createRadialGradient(w / 2, h * 0.47, 25, w / 2, h * 0.47, h * 0.72);
  if (state.preset === 'chrome') {
    gradient.addColorStop(0, `rgba(18,5,${28 + sub * 32},1)`);
    gradient.addColorStop(0.43, '#050807');
  } else {
    gradient.addColorStop(0, `rgba(4,${18 + sub * 42},12,1)`);
    gradient.addColorStop(0.43, '#030806');
  }
  gradient.addColorStop(1, '#010202');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  const starEnergy = 0.05 + bands.air * 0.7;
  stars.forEach((star) => {
    const flicker = 0.25 + 0.75 * Math.abs(Math.sin(elapsed * (1.1 + star.phase * 0.1) + star.phase));
    ctx.fillStyle = `rgba(145,255,166,${starEnergy * flicker})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  });
}

function drawCrystalBackground(cx, cy, bands) {
  if (state.preset !== 'shards') return;
  const separation = (bands.lowMid * 16 + bands.mid * 24 + state.transient * 7) * state.intensity;
  const edgeEnergy = 0.28 + bands.high * 0.72 + state.transient * 0.22;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'screen';
  crystalFacets.forEach((facet, index) => {
    const middle = (facet.a0 + facet.a1) * 0.5;
    const gap = separation * facet.depth;
    const inner = facet.inner + gap;
    const outer = facet.outer + gap * 2.1;
    const innerSkew = (facet.split - 0.5) * 32;
    const p0 = { x: Math.cos(facet.a0) * inner, y: Math.sin(facet.a0) * inner };
    const p1 = { x: Math.cos(facet.a1) * (inner + innerSkew), y: Math.sin(facet.a1) * (inner + innerSkew) };
    const p2 = { x: Math.cos(facet.a1) * outer, y: Math.sin(facet.a1) * outer };
    const p3 = { x: Math.cos(middle) * (outer + 26 + facet.split * 55), y: Math.sin(middle) * (outer + 26 + facet.split * 55) };
    const fill = ctx.createLinearGradient(p0.x, p0.y, p3.x, p3.y);
    if (facet.violet) {
      fill.addColorStop(0, 'rgba(38,8,62,.035)');
      fill.addColorStop(0.58, `rgba(155,66,255,${0.07 + bands.mid * 0.14})`);
      fill.addColorStop(0.83, `rgba(224,235,255,${0.085 + bands.high * 0.18})`);
      fill.addColorStop(1, 'rgba(20,3,32,.01)');
    } else {
      fill.addColorStop(0, 'rgba(0,25,8,.035)');
      fill.addColorStop(0.52, `rgba(0,255,36,${0.065 + bands.lowMid * 0.13})`);
      fill.addColorStop(0.82, `rgba(225,255,232,${0.08 + bands.high * 0.17})`);
      fill.addColorStop(1, 'rgba(0,20,6,.01)');
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = facet.violet
      ? `rgba(196,151,255,${edgeEnergy * facet.depth * 0.58})`
      : `rgba(165,255,184,${edgeEnergy * facet.depth * 0.52})`;
    ctx.lineWidth = 0.8 + bands.high * 2.2;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (index % 9 === 0 && bands.high > 0.12) {
      ctx.strokeStyle = `rgba(245,255,248,${bands.high * 0.38})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();
    }
  });
  ctx.lineCap = 'round';
  for (let crack = 0; crack < 30; crack += 1) {
    const baseAngle = (crack / 30) * Math.PI * 2 + (seeded(crack, 48) - 0.5) * 0.09;
    let lastX = Math.cos(baseAngle) * 278;
    let lastY = Math.sin(baseAngle) * 278;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    for (let segment = 1; segment <= 6; segment += 1) {
      const radius = 278 + segment * (118 + seeded(crack * 10 + segment, 49) * 52);
      const angle = baseAngle + (seeded(crack * 10 + segment, 50) - 0.5) * 0.1;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      ctx.lineTo(x, y);
      if ((segment === 2 || segment === 4) && crack % 2 === 0) {
        const branchAngle = angle + (seeded(crack + segment, 51) > 0.5 ? 1 : -1) * (0.13 + seeded(crack, 52) * 0.12);
        const branchLength = 65 + seeded(crack + segment, 53) * 110;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(branchAngle) * branchLength, y + Math.sin(branchAngle) * branchLength);
        ctx.moveTo(x, y);
      }
      lastX = x;
      lastY = y;
    }
    ctx.strokeStyle = crack % 7 === 0
      ? `rgba(184,112,255,${0.12 + bands.high * 0.4})`
      : `rgba(210,255,220,${0.1 + bands.high * 0.38})`;
    ctx.lineWidth = 0.8 + bands.high * 1.8;
    ctx.stroke();
  }
  ctx.restore();
}

function mercuryWaveY(band, x, bands) {
  const normalized = x / canvas.width;
  const amplitude = band.amplitude * (0.72 + bands.sub * 0.9 + bands.lowMid * 0.36);
  return band.y
    + Math.sin(normalized * Math.PI * 2 * band.frequency + band.phase + elapsed * band.drift) * amplitude
    + Math.sin(normalized * Math.PI * 2 * (band.frequency * 0.43) - elapsed * band.drift * 0.7 + band.phase) * amplitude * 0.34;
}

function drawMercuryBackground(w, h, bands) {
  if (state.preset !== 'chrome') return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  mercuryBands.forEach((band, index) => {
    const thickness = band.width * (0.8 + bands.bass * 1.15 + bands.mid * 0.22);
    const points = 54;
    ctx.beginPath();
    for (let i = 0; i <= points; i += 1) {
      const x = (i / points) * w;
      const y = mercuryWaveY(band, x, bands) - thickness * 0.5;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = points; i >= 0; i -= 1) {
      const x = (i / points) * w;
      const modulation = 0.72 + 0.28 * Math.sin(i * 0.47 + band.phase);
      const y = mercuryWaveY(band, x, bands) + thickness * modulation;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, band.y - thickness, w, band.y + thickness);
    if (band.violet) {
      fill.addColorStop(0, 'rgba(18,0,28,.02)');
      fill.addColorStop(0.24, `rgba(155,0,255,${0.2 + bands.mid * 0.36})`);
      fill.addColorStop(0.46, `rgba(236,242,255,${0.28 + bands.high * 0.42})`);
      fill.addColorStop(0.68, `rgba(0,255,36,${0.19 + bands.bass * 0.34})`);
      fill.addColorStop(1, 'rgba(12,0,24,.02)');
    } else {
      fill.addColorStop(0, 'rgba(0,24,6,.02)');
      fill.addColorStop(0.2, `rgba(0,255,36,${0.2 + bands.bass * 0.38})`);
      fill.addColorStop(0.48, `rgba(240,250,246,${0.3 + bands.high * 0.44})`);
      fill.addColorStop(0.72, `rgba(136,26,255,${0.17 + bands.mid * 0.32})`);
      fill.addColorStop(1, 'rgba(0,18,4,.02)');
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = `rgba(235,255,240,${0.11 + bands.high * 0.28})`;
    ctx.lineWidth = 1.1 + bands.air * 2;
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i <= points; i += 1) {
      const x = (i / points) * w;
      const y = mercuryWaveY(band, x, bands) - thickness * 0.2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + bands.high * 0.28 + state.transient * 0.1})`;
    ctx.lineWidth = 1.8 + bands.air * 3.5;
    ctx.stroke();
  });

  mercuryDrops.forEach((drop, index) => {
    const drift = Math.sin(elapsed * 0.22 + drop.phase) * (10 + bands.mid * 22);
    const x = drop.x + drift;
    const y = (drop.y + elapsed * (2 + bands.sub * 7) * (index % 2 ? 1 : -1) + h) % h;
    const radius = drop.radius * (0.72 + bands.high * 0.7);
    const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, 1, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${0.18 + bands.air * 0.38})`);
    gradient.addColorStop(0.28, drop.violet ? 'rgba(170,65,255,.32)' : 'rgba(30,255,72,.32)');
    gradient.addColorStop(0.72, 'rgba(22,30,26,.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawPulseTunnel(cx, cy, bands) {
  if (!state.effects.pulseTunnel && state.preset !== 'tunnel') return;
  const boosted = state.preset === 'tunnel' ? 1.45 : 0.72;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 1.18);
  for (let i = 0; i < 11; i += 1) {
    const phase = (elapsed * (0.09 + bands.sub * 0.22) + i / 11) % 1;
    const radius = 430 + phase * 770;
    const alpha = (1 - phase) * (0.035 + bands.sub * 0.22) * boosted;
    ctx.strokeStyle = `rgba(0,255,36,${alpha})`;
    ctx.lineWidth = 1.2 + bands.sub * 5 * (1 - phase);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerspectiveGrid(w, h, bands) {
  if (state.preset !== 'grid') return;
  const horizon = h * 0.58;
  ctx.save();
  ctx.strokeStyle = `rgba(0,255,36,${0.07 + bands.mid * 0.34})`;
  ctx.lineWidth = 2;
  for (let i = -8; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * 12, horizon);
    ctx.lineTo(w / 2 + i * 150, h);
    ctx.stroke();
  }
  for (let i = 0; i < 17; i += 1) {
    const p = i / 16;
    const y = horizon + p * p * (h - horizon);
    ctx.globalAlpha = 0.25 + p * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScanlines(w, h, bands) {
  if (!state.effects.scanlines) return;
  const alpha = 0.012 + bands.air * 0.05;
  ctx.save();
  ctx.fillStyle = `rgba(150,255,170,${alpha})`;
  const offset = Math.floor((elapsed * 22) % 8);
  for (let y = offset; y < h; y += 8) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

function drawBassDust(cx, cy, bands) {
  if (!state.effects.bassDust) return;
  ctx.save();
  dust.forEach((point, index) => {
    const breathing = point.radius + Math.sin(elapsed * 1.1 + index) * bands.bass * 38;
    const angle = point.angle + elapsed * 0.018 * point.depth;
    const x = cx + Math.cos(angle) * breathing;
    const y = cy + Math.sin(angle) * breathing * 1.06;
    const alpha = (0.035 + bands.bass * 0.52) * point.depth;
    ctx.fillStyle = index % 13 === 0 ? `rgba(155,66,255,${alpha * 0.8})` : `rgba(0,255,36,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, point.size * (0.65 + bands.bass * 1.2), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawOrbitDots(cx, cy, bands) {
  if (!state.effects.orbitDots) return;
  ctx.save();
  orbitDots.forEach((dot, index) => {
    const angle = dot.angle + elapsed * dot.speed * (0.55 + bands.lowMid * 1.8);
    const radius = dot.radius + Math.sin(elapsed * 0.7 + index) * bands.mid * 24;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const alpha = 0.08 + (bands.lowMid * 0.55 + bands.mid * 0.24);
    ctx.fillStyle = index % 7 === 0 ? `rgba(155,66,255,${alpha})` : `rgba(0,255,36,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, dot.size * (0.65 + bands.mid), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawLaserStreaks(cx, cy, bands) {
  if (!state.effects.laserStreaks) return;
  const energy = bands.high * 0.9 + state.transient * 0.65;
  if (energy < 0.06) return;
  ctx.save();
  ctx.translate(cx, cy);
  streaks.forEach((streak, index) => {
    const pulse = Math.max(0, Math.sin(elapsed * (2.2 + index % 5) + index * 1.71));
    const alpha = energy * pulse * (index % 4 === 0 ? 0.65 : 0.28);
    if (alpha < 0.025) return;
    const angle = streak.angle + Math.sin(elapsed * 0.17 + index) * 0.018;
    const inner = streak.inner;
    ctx.strokeStyle = index % 9 === 0 ? `rgba(155,66,255,${alpha})` : `rgba(112,255,136,${alpha})`;
    ctx.lineWidth = streak.weight * (0.65 + bands.air);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * (inner + streak.length), Math.sin(angle) * (inner + streak.length));
    ctx.stroke();
  });
  ctx.restore();
}

function drawChromaticArcs(cx, cy, bands) {
  if (!state.effects.chromaticArcs || state.preset === 'minimal') return;
  const energy = bands.mid * 0.65 + bands.high * 0.45;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(elapsed * 0.025);
  const arcs = [
    { r: 425, start: -0.18, length: 0.48, color: '0,255,36' },
    { r: 451, start: 0.37, length: 0.32, color: '155,66,255' },
    { r: 478, start: 0.69, length: 0.42, color: '175,255,190' },
    { r: 505, start: 1.18, length: 0.28, color: '0,255,36' },
  ];
  arcs.forEach((arc, index) => {
    const start = (arc.start + index * 0.41) * Math.PI * 2;
    const length = (arc.length + energy * 0.1) * Math.PI * 2;
    ctx.strokeStyle = `rgba(${arc.color},${0.07 + energy * 0.34})`;
    ctx.lineWidth = 2 + energy * (index % 2 ? 8 : 5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, arc.r + Math.sin(elapsed + index) * bands.mid * 8, start, start + length);
    ctx.stroke();
  });
  ctx.restore();
}

function drawChromeContours(cx, cy, bands) {
  if (state.preset !== 'chrome') return;
  const energy = bands.lowMid * 0.5 + bands.mid * 0.42 + bands.high * 0.25;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-elapsed * 0.018);
  for (let i = 0; i < 7; i += 1) {
    const radius = 445 + i * 34 + Math.sin(elapsed * 0.8 + i) * bands.bass * 12;
    const start = (i * 0.77 + 0.1) % (Math.PI * 2);
    const end = start + 0.7 + energy * 1.25;
    const gradient = ctx.createLinearGradient(-radius, 0, radius, 0);
    gradient.addColorStop(0, 'rgba(155,66,255,.08)');
    gradient.addColorStop(0.42, `rgba(222,255,230,${0.08 + energy * 0.38})`);
    gradient.addColorStop(0.56, `rgba(0,255,36,${0.12 + energy * 0.48})`);
    gradient.addColorStop(1, 'rgba(155,66,255,.05)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 6 + (i % 3) * 4 + energy * 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, radius, start, end);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVoiceBars(cx, cy, radius, bands) {
  if (!state.effects.voiceBars) return;
  const count = 128;
  const voiceEnergy = Math.min(1, bands.lowMid * 0.68 + bands.mid * 0.82 + bands.high * 0.18);
  const binHz = analyser ? audioContext.sampleRate / analyser.fftSize : 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.shadowColor = '#00ff24';
  ctx.shadowBlur = 8 + voiceEnergy * 20;
  for (let i = 0; i < count; i += 1) {
    const half = count / 2;
    const mirrored = i < half ? i / (half - 1) : (count - i - 1) / (half - 1);
    const hz = 160 * Math.pow(4500 / 160, mirrored);
    const bin = analyser ? Math.min(frequencyData.length - 1, Math.max(1, Math.round(hz / binHz))) : 0;
    const raw = analyser && frequencyData ? frequencyData[bin] / 255 : 0;
    const level = Math.pow(raw, 1.18);
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const start = radius + 7;
    const length = 7 + level * 112 * state.intensity;
    const alpha = 0.3 + level * 0.68;
    ctx.strokeStyle = i % 16 === 0
      ? `rgba(170,92,255,${alpha})`
      : `rgba(108,255,132,${alpha})`;
    ctx.lineWidth = 2.2 + level * 3.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
    ctx.lineTo(Math.cos(angle) * (start + length), Math.sin(angle) * (start + length));
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpectrumRing(cx, cy, baseRadius, bands) {
  if (!analyser || !frequencyData || state.preset === 'minimal') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = `rgba(0,255,36,${0.4 + bands.lowMid * 0.4})`;
    ctx.lineWidth = 3 + bands.bass * 7;
    ctx.shadowColor = '#00ff24';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const count = state.preset === 'shards' ? 112 : 176;
  const binStep = Math.max(1, Math.floor(frequencyData.length * 0.56 / count));
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < count; i += 1) {
    const mirroredIndex = i < count / 2 ? i : count - 1 - i;
    const raw = frequencyData[Math.max(1, mirroredIndex * binStep)] / 255;
    const value = Math.pow(raw, 1.48) * state.intensity;
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const inside = baseRadius + bands.lowMid * 8;
    const length = 8 + value * (state.preset === 'shards' ? 165 : 118);
    const violet = i % 17 === 0 && bands.high > 0.2;
    ctx.strokeStyle = violet ? `rgba(155,66,255,${0.22 + value})` : `rgba(0,255,36,${0.2 + value * 0.92})`;
    ctx.lineWidth = state.preset === 'shards' ? 2.5 + value * 7 : 1.7 + value * 4.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inside, Math.sin(angle) * inside);
    ctx.lineTo(Math.cos(angle) * (inside + length), Math.sin(angle) * (inside + length));
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(0,255,36,${0.5 + bands.bass * 0.42})`;
  ctx.lineWidth = 3 + bands.bass * 6;
  ctx.shadowColor = '#00ff24';
  ctx.shadowBlur = 24 + bands.high * 28;
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWaveRing(cx, cy, radius, bands) {
  if (!state.waveform || !analyser || !timeData) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(208,255,216,${0.12 + bands.mid * 0.47})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  const count = 240;
  for (let i = 0; i <= count; i += 1) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const sample = (timeData[Math.floor(i / count * (timeData.length - 1))] - 128) / 128;
    const r = radius + sample * (12 + bands.mid * 54) * state.intensity;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawShards(cx, cy, radius, bands) {
  if (state.preset !== 'shards') return;
  const energy = bands.mid * 0.65 + bands.high * 0.48;
  ctx.save();
  ctx.translate(cx, cy);
  shards.forEach((shard, index) => {
    const inner = radius + 48 + shard.offset + Math.sin(elapsed * 1.7 + index) * bands.high * 8;
    const length = shard.length * (0.28 + energy * state.intensity);
    const width = shard.width * (0.45 + bands.high);
    ctx.save();
    ctx.rotate(shard.angle);
    const gradient = ctx.createLinearGradient(inner, 0, inner + length, 0);
    gradient.addColorStop(0, 'rgba(0,255,36,.1)');
    gradient.addColorStop(0.62, `rgba(150,255,170,${0.1 + bands.high * 0.36})`);
    gradient.addColorStop(1, 'rgba(230,255,236,.01)');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = `rgba(190,255,205,${0.1 + bands.high * 0.25})`;
    ctx.beginPath();
    ctx.moveTo(inner, -width / 2);
    ctx.lineTo(inner + length, 0);
    ctx.lineTo(inner, width / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
}

function drawParticles(cx, cy, bands, dt) {
  if (!state.particles) return;
  const speedBoost = 0.24 + bands.high * 0.82 + state.transient * 0.42;
  particles.forEach((particle, index) => {
    particle.angle += particle.speed * dt * speedBoost;
    particle.radius += (bands.high * 10 + state.transient * 5) * dt * (index % 3 === 0 ? 1 : 0.18);
    if (particle.radius > 940) particle.radius = 430 + seeded(index, Math.floor(elapsed)) * 55;
    const wobble = Math.sin(elapsed * 1.5 + particle.phase) * (8 + bands.mid * 27);
    const radial = particle.radius + wobble;
    const x = cx + Math.cos(particle.angle) * radial;
    const y = cy + Math.sin(particle.angle) * radial;
    const alpha = Math.min(0.88, 0.04 + bands.high * 0.82 + state.transient * 0.23) * (1 - Math.max(0, particle.radius - 720) / 360);
    ctx.fillStyle = particle.violet ? `rgba(155,66,255,${alpha * 0.72})` : `rgba(0,255,36,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, particle.size * (0.55 + bands.air * 1.5), 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawShockwaves(cx, cy, dt) {
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
    const wave = shockwaves[i];
    wave.radius += dt * 240;
    wave.alpha *= Math.pow(0.15, dt);
    wave.width = Math.max(1.4, wave.width - dt * 8);
    ctx.strokeStyle = `rgba(0,255,36,${wave.alpha})`;
    ctx.lineWidth = wave.width;
    ctx.shadowColor = '#00ff24';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(0, 0, wave.radius, 0, Math.PI * 2);
    ctx.stroke();
    if (wave.alpha < 0.025) shockwaves.splice(i, 1);
  }
  ctx.restore();
}

function drawLogo(cx, cy, bands) {
  if (!preparedLogo) return;
  const width = 420 * (1 + state.kick * state.bounce);
  const height = width * preparedLogo.height / preparedLogo.width;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = '#00ff24';
  ctx.shadowBlur = 16 + bands.high * 30;
  ctx.globalAlpha = 0.96 + bands.mid * 0.04;
  ctx.drawImage(preparedLogo, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawFrame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (state.loaded && !audio.paused) elapsed = audio.currentTime;
  else elapsed += dt;
  replayDueEvents();
  analyseAudio(now, dt);
  const bands = state.smoothed;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h * 0.47;
  const baseRadius = state.preset === 'minimal' ? 375 : 385;
  drawBackground(w, h, bands);
  drawCrystalBackground(cx, cy, bands);
  drawMercuryBackground(w, h, bands);
  drawPulseTunnel(cx, cy, bands);
  drawPerspectiveGrid(w, h, bands);
  drawScanlines(w, h, bands);
  drawBassDust(cx, cy, bands);
  drawParticles(cx, cy, bands, dt);
  drawLaserStreaks(cx, cy, bands);
  drawOrbitDots(cx, cy, bands);
  drawChromeContours(cx, cy, bands);
  drawChromaticArcs(cx, cy, bands);
  drawShards(cx, cy, baseRadius, bands);
  drawSpectrumRing(cx, cy, baseRadius, bands);
  drawVoiceBars(cx, cy, baseRadius, bands);
  drawWaveRing(cx, cy, baseRadius - 23, bands);
  if (state.shockwaves) drawShockwaves(cx, cy, dt);
  drawLogo(cx, cy, bands);
  const bassLevel = (bands.sub * 0.45 + bands.bass * 0.55);
  $('#bassMeter').style.width = `${Math.min(100, bassLevel * 150)}%`;
  $('#midMeter').style.width = `${Math.min(100, bands.mid * 155)}%`;
  $('#highMeter').style.width = `${Math.min(100, bands.high * 175)}%`;
  $('#bassValue').textContent = Math.round(bassLevel * 100);
  $('#midValue').textContent = Math.round(bands.mid * 100);
  $('#highValue').textContent = Math.round(bands.high * 100);
  if (state.exporting && replaySession && !finishingReplay && audio.currentTime >= replaySession.duration - 1 / CAPTURE_FPS) {
    finishReplayPass();
  }
  requestAnimationFrame(drawFrame);
}

function updateTransport() {
  $('#currentTime').textContent = formatTime(audio.currentTime);
  $('#duration').textContent = formatTime(audio.duration);
  if (!seek.matches(':active') && Number.isFinite(audio.duration) && audio.duration > 0) {
    seek.value = Math.round(audio.currentTime / audio.duration * 1000);
  }
  if (state.recording) $('#exportStatus').textContent = `Capturando interpretación · ${performanceSession?.durationLimit ? Math.round(audio.currentTime / performanceSession.durationLimit * 100) : 0}%`;
  if (state.exporting) $('#exportStatus').textContent = `Sincronizando y renderizando · ${replaySession?.duration ? Math.round(audio.currentTime / replaySession.duration * 100) : 0}%`;
}

function loadFile(file) {
  if (!file) return;
  const supportedHint = file.type.startsWith('audio/') || file.type.startsWith('video/') || /\.(wav|mp3|m4a|aac|ogg|flac|mp4|webm)$/i.test(file.name);
  if (!supportedHint) return showToast('Ese archivo no parece contener audio compatible.', true);
  if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
  audio.src = URL.createObjectURL(file);
  currentFileName = file.name.replace(/\.[^.]+$/, '') || 'headbang-visualizer';
  currentFormat = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
  $('#trackName').textContent = file.name;
  $('#trackMeta').textContent = `${(file.size / 1048576).toFixed(1)} MB · Analizando formato`;
  $('#trackCard').classList.remove('is-empty');
  audio.load();
}

fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragging');
}));
['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragging');
}));
dropZone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));

audio.addEventListener('loadedmetadata', () => {
  state.loaded = true;
  playButton.disabled = false;
  seek.disabled = false;
  recordButton.disabled = false;
  $('#duration').textContent = formatTime(audio.duration);
  $('#trackMeta').textContent = `${formatTime(audio.duration)} · ${currentFormat}`;
  $('#exportStatus').textContent = 'Preparado para grabar desde el inicio';
  showToast('Pista preparada. El bombo se controla solo con clic o Espacio.');
});

audio.addEventListener('error', () => {
  state.loaded = false;
  playButton.disabled = true;
  recordButton.disabled = true;
  $('#trackMeta').textContent = 'Formato no compatible con este navegador';
  showToast('No se pudo abrir el códec. Prueba WAV, MP3, M4A, OGG o FLAC.', true);
});
audio.addEventListener('play', () => {
  playButton.textContent = '❚❚';
  playButton.setAttribute('aria-label', 'Pausar');
});
audio.addEventListener('pause', () => {
  if (!state.recording && !state.exporting) {
    playButton.textContent = '▶';
    playButton.setAttribute('aria-label', 'Reproducir');
  }
});
audio.addEventListener('timeupdate', updateTransport);
audio.addEventListener('ended', () => {
  if (state.recording) finishPerformancePass();
  else if (state.exporting) finishReplayPass();
});

playButton.addEventListener('click', async () => {
  ensureAudioGraph();
  await audioContext.resume();
  if (audio.paused) await audio.play(); else audio.pause();
});
seek.addEventListener('input', () => {
  if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * Number(seek.value) / 1000;
});

document.querySelectorAll('.preset').forEach((button) => button.addEventListener('click', () => {
  state.preset = button.dataset.preset;
  logPerformanceEvent('preset', state.preset);
  document.querySelectorAll('.preset').forEach((item) => item.classList.toggle('is-active', item === button));
}));
document.querySelectorAll('.preset').forEach((item) => item.classList.toggle('is-active', item.dataset.preset === state.preset));

document.querySelectorAll('.effect-tile').forEach((button) => button.addEventListener('click', () => {
  const key = button.dataset.effect;
  state.effects[key] = !state.effects[key];
  logPerformanceEvent('effect', { name: key, checked: state.effects[key] });
  button.classList.toggle('is-active', state.effects[key]);
  button.querySelector('em').textContent = state.effects[key] ? 'ON' : 'OFF';
}));

$('#intensity').addEventListener('input', (event) => {
  state.intensity = Number(event.target.value) / 100;
  logPerformanceEvent('intensity', state.intensity);
  $('#intensityOutput').textContent = `${event.target.value}%`;
});
$('#bounce').addEventListener('input', (event) => {
  state.bounce = Number(event.target.value) / 100;
  logPerformanceEvent('bounce', state.bounce);
  $('#bounceOutput').textContent = `${event.target.value}%`;
});
$('#syncOffset').addEventListener('input', (event) => {
  state.syncOffsetMs = Number(event.target.value);
  updateLatencyReadout();
});

function setToggle(name, checked, announce = false, log = true) {
  const config = {
    particles: ['#particlesToggle', 'Partículas'],
    shockwaves: ['#shockToggle', 'Ondas de impacto'],
    waveform: ['#waveToggle', 'Forma de onda'],
  }[name];
  state[name] = checked;
  if (log) logPerformanceEvent('toggle', { name, checked });
  $(config[0]).checked = checked;
  if (announce) showToast(`${config[1]}: ${checked ? 'activadas' : 'desactivadas'}`);
}

$('#particlesToggle').addEventListener('change', (event) => setToggle('particles', event.target.checked));
$('#shockToggle').addEventListener('change', (event) => setToggle('shockwaves', event.target.checked));
$('#waveToggle').addEventListener('change', (event) => setToggle('waveform', event.target.checked));
manualKickButton.addEventListener('click', triggerKick);

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (event.target === fileInput) return;
  if (event.code === 'Space') {
    event.preventDefault();
    triggerKick();
    return;
  }
  if (event.code === 'KeyP') {
    event.preventDefault();
    setToggle('particles', !state.particles, true);
  } else if (event.code === 'KeyO') {
    event.preventDefault();
    setToggle('shockwaves', !state.shockwaves, true);
  } else if (event.code === 'KeyF') {
    event.preventDefault();
    setToggle('waveform', !state.waveform, true);
  }
});

function selectRecordingType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function buildExportFilename(baseName, mimeType = '') {
  const safeBase = `${baseName || 'headbang-visualizer'}`.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|\x00-\x1F]+/g, '-').replace(/\s+/g, '-');
  const normalized = safeBase || 'headbang-visualizer';
  const extension = mimeType && mimeType.includes('mp4') ? 'mp4' : (mimeType && mimeType.includes('webm') ? 'webm' : 'mp4');
  return `${normalized}-${performanceSession?.initial.preset || state.preset}-1080x1920.${extension}`;
}

async function startPerformancePass() {
  ensureAudioGraph();
  await audioContext.resume();
  if (!selectRecordingType() || !canvas.captureStream) throw new Error('el navegador no permite grabar Canvas');
  audio.pause();
  audio.currentTime = 0;
  resetReactiveState();
  performanceSession = {
    initial: clonePerformanceConfig(),
    events: [],
    durationLimit: Number.isFinite(audio.duration) ? audio.duration : 0,
  };
  state.recording = true;
  state.exporting = false;
  recordButton.classList.add('is-recording');
  recordButton.innerHTML = '<i></i> DETENER';
  playButton.disabled = true;
  seek.disabled = true;
  $('#exportStatus').textContent = 'Capturando interpretación · reloj de audio activo';
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
  await audio.play();
  setTimeout(updateLatencyReadout, 250);
}

async function finishPerformancePass() {
  if (!state.recording || !performanceSession) return;
  const duration = Math.max(0.05, Math.min(audio.currentTime || audio.duration || 0, audio.duration || Infinity));
  state.recording = false;
  audio.pause();
  recordButton.classList.remove('is-recording');
  recordButton.disabled = true;
  recordButton.innerHTML = '<i></i> RENDERIZANDO';
  performanceSession.duration = duration;
  $('#exportStatus').textContent = 'Preparando repetición sincronizada';
  showToast('Interpretación capturada. Renderizando con el reloj de la canción.');
  try {
    await startReplayPass(performanceSession);
  } catch (error) {
    state.exporting = false;
    recordButton.disabled = false;
    recordButton.innerHTML = '<i></i> GRABAR';
    playButton.disabled = false;
    seek.disabled = false;
    showToast(`No se pudo renderizar: ${error.message}`, true);
  }
}

async function startReplayPass(session) {
  const mimeType = selectRecordingType();
  const stream = canvas.captureStream(CAPTURE_FPS);
  mediaDestination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
  chunks = [];
  replaySession = {
    duration: session.duration,
    events: [...session.events].sort((a, b) => a.time - b.time),
    cursor: 0,
  };
  restorePerformanceConfig(session.initial);
  resetReactiveState();
  recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
  });
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  recorder.addEventListener('stop', finalizeRecording, { once: true });
  finishingReplay = false;
  state.exporting = true;
  audio.currentTime = 0;
  recorder.start(250);
  await audio.play();
}

function finishReplayPass() {
  if (!state.exporting || finishingReplay) return;
  finishingReplay = true;
  audio.pause();
  if (recorder?.state && recorder.state !== 'inactive') recorder.stop();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function finalizeRecording() {
  const type = recorder?.mimeType || selectRecordingType() || 'video/webm';
  const rawBlob = new Blob(chunks, { type });
  chunks = [];
  $('#exportStatus').textContent = 'Finalizando vídeo localmente · creando índice MP4';
  try {
    if (!type.includes('mp4')) throw new Error('Este navegador no ofrece captura H.264/AAC. Usa Chrome o Edge actualizado para exportar MP4.');
    const finalBlob = await finalizeMp4(rawBlob);
    downloadBlob(finalBlob, buildExportFilename(currentFileName, 'video/mp4'));
    $('#exportStatus').textContent = 'MP4 indexado guardado · H.264/AAC · navegación activa';
    showToast('MP4 finalizado en tu navegador. La canción y el vídeo no se han subido.');
  } catch (error) {
    downloadBlob(rawBlob, buildExportFilename(currentFileName + '-captura-sin-finalizar', type));
    $('#exportStatus').textContent = 'Captura de respaldo descargada · MP4 final no disponible';
    showToast(error.message + ' El respaldo conserva el formato original y puede requerir conversión.', true);
  }
  recorder?.stream.getVideoTracks().forEach((track) => track.stop());

  state.recording = false;
  state.exporting = false;
  recordButton.classList.remove('is-recording');
  recordButton.innerHTML = '<i></i> GRABAR';
  recordButton.disabled = false;
  playButton.disabled = false;
  seek.disabled = false;
  wakeLock?.release?.();
  performanceSession = null;
  replaySession = null;
  finishingReplay = false;
}

recordButton.addEventListener('click', async () => {
  if (!state.loaded) return;
  if (state.recording) {
    await finishPerformancePass();
    return;
  }
  if (state.exporting) return;
  try {
    await startPerformancePass();
  } catch (error) {
    state.recording = false;
    state.exporting = false;
    recordButton.classList.remove('is-recording');
    recordButton.innerHTML = '<i></i> GRABAR';
    recordButton.disabled = false;
    showToast(`No se pudo iniciar la grabación: ${error.message}`, true);
  }
});

const codec = selectRecordingType();
$('#codecNote').textContent = codec.includes('mp4')
  ? 'Captura H.264/AAC y finalización MP4 local con índice de navegación.'
  : 'MP4 H.264/AAC no disponible: usa Chrome o Edge actualizado. Respaldo WebM disponible.';

function registerWebMCP() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  Promise.resolve(context.registerTool({
    name: 'configure_visualizer',
    title: 'Configurar visualizador',
    description: 'Cambia el preset y los controles visuales visibles sin cargar ni reproducir archivos.',
    inputSchema: {
      type: 'object',
      properties: {
        preset: { type: 'string', enum: PRESETS },
        intensity: { type: 'number', minimum: 20, maximum: 140 },
        logoBounce: { type: 'number', minimum: 0, maximum: 22 },
        particles: { type: 'boolean' },
        shockwaves: { type: 'boolean' },
        waveform: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!input || typeof input !== 'object') throw new Error('Configuración no válida');
      if (input.preset !== undefined && !PRESETS.includes(input.preset)) throw new Error('Preset no válido');
      if (input.preset) document.querySelector(`[data-preset="${input.preset}"]`).click();
      if (input.intensity !== undefined) {
        $('#intensity').value = input.intensity;
        $('#intensity').dispatchEvent(new Event('input'));
      }
      if (input.logoBounce !== undefined) {
        $('#bounce').value = input.logoBounce;
        $('#bounce').dispatchEvent(new Event('input'));
      }
      [['particles', '#particlesToggle'], ['shockwaves', '#shockToggle'], ['waveform', '#waveToggle']].forEach(([key, selector]) => {
        if (input[key] !== undefined) {
          $(selector).checked = input[key];
          $(selector).dispatchEvent(new Event('change'));
        }
      });
      return {
        preset: state.preset,
        intensity: Math.round(state.intensity * 100),
        logoBounce: Math.round(state.bounce * 100),
      };
    },
  })).catch(() => {});
}

registerWebMCP();
requestAnimationFrame(drawFrame);
