import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE_ROOT = "D:/0. LICAN/GAME_HEADBANG_DEALERS_BASS_TRAFFICKERS";
const OUT = path.join(ROOT, "public/headbangdealers_the_game/assets/story-levels");
const GENERATED = "C:/Users/rulin/.codex/generated_images/019fcf3c-ec09-71d1-84c3-9bcf3648468f";

const levels = {
  2: {
    source: "ASSets/NEW LEVELS/LEVEL 2",
    backgrounds: ["HENRY_FASE_1.png", "HENRY_FASE_1_OPEN_DOOR.png"],
    audio: "HENRY_LVL_1.wav",
  },
  5: {
    source: "ASSets/1. FONDO/NEW_BACKGROUNDS",
    backgrounds: ["HYDRAXXX_FASE_1.png"],
    audio: "MUSIC_SOURCE/FULL_TRACKS/V2/HYDRAXXX_LVL_1.wav",
    totem: "ASSets/2. TOTEM/TOTEM_HYDRAXXX_FASE_1.png",
  },
  7: {
    source: "ASSets/NEW LEVELS/LEVEL 7",
    backgrounds: ["FONDO_HENRY_FASE_2.png"],
    audio: "HENRY_LVL_2.mp3",
    totem: "TOTEM_HENRY_FASE_2.png",
  },
  10: {
    source: "ASSets/NEW LEVELS/LEVEL 10",
    backgrounds: ["HYDRAXXX_FASE_2.png"],
    audio: "HYDRAXXX_LVL_2.wav",
    totem: "TOTEM_HYDRAXXX_FASE_2.png",
  },
  12: {
    source: "ASSets/NEW LEVELS/LEVEL 12",
    backgrounds: ["MAGIC_BITE.png"],
    audio: "Warrior.mp3",
    totem: "MAGIC_BITE_TOTEM.png",
  },
  13: {
    source: "ASSets/NEW LEVELS/LEVEL 13",
    backgrounds: ["TREZE_LVL_13.png"],
    audio: "BASSQUAKE.wav",
    totem: "TOTEM_TREZE.png",
  },
  14: {
    source: "ASSets/NEW LEVELS/LEVEL 14",
    backgrounds: ["HENRY_FASE_3.png"],
    audio: "HENRY_LVL_3.mp3",
    totem: "TOTEM_HENRY_FASE_3.png",
  },
};

const fromSource = (level, file) => path.join(SOURCE_ROOT, levels[level].source, file);

async function webp(input, output, options = {}) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  let image = sharp(input, { failOn: "none" }).rotate();
  if (options.trim) image = image.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (options.max) image = image.resize(options.max, options.max, { fit: "inside", withoutEnlargement: true });
  await image.webp({ quality: options.quality ?? 88, alphaQuality: 100, smartSubsample: true }).toFile(output);
}

async function chromaKey(input, output, key, tolerance = 34) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const distance = Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]);
    if (distance <= tolerance) data[i + 3] = 0;
    else if (distance <= tolerance * 2.25) data[i + 3] = Math.min(data[i + 3], Math.round(255 * (distance - tolerance) / (tolerance * 1.25)));
  }
  await sharp(data, { raw: info }).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92, alphaQuality: 100 }).toFile(output);
}

function crackSvg(width, height, damage) {
  const count = damage === 25 ? 2 : damage === 50 ? 4 : damage === 75 ? 7 : 10;
  const paths = Array.from({ length: count }, (_, index) => {
    const x = Math.round(width * (0.22 + ((index * 0.113) % 0.57)));
    const y = Math.round(height * (0.16 + ((index * 0.173) % 0.63)));
    const dx = Math.round(width * (0.035 + (index % 3) * 0.012));
    const dy = Math.round(height * (0.075 + (index % 2) * 0.035));
    return `<path d="M ${x} ${y} l ${dx} ${dy} l ${-Math.round(dx * .55)} ${Math.round(dy * .35)} m ${Math.round(dx * .55)} ${-Math.round(dy * .35)} l ${Math.round(dx * .7)} ${Math.round(dy * .25)}"/>`;
  }).join("");
  const glow = damage >= 50
    ? `<g fill="#ff5a00" opacity="${damage / 180}"><circle cx="${width * .48}" cy="${height * .7}" r="${width * .018}"/><circle cx="${width * .63}" cy="${height * .42}" r="${width * .012}"/></g>`
    : "";
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#090b08" stroke-width="${Math.max(4, width * .009)}" stroke-linecap="square" stroke-linejoin="miter">${paths}</g><g fill="none" stroke="#a9ff39" stroke-width="${Math.max(1, width * .0025)}" opacity=".42">${paths}</g>${glow}</svg>`);
}

function missingChunksSvg(width, height, level, damage) {
  if (damage < 50) return null;
  const profiles = {
    5: [[.28, .08], [.76, .42], [.34, .72]],
    7: [[.18, .22], [.78, .58], [.48, .83]],
    10: [[.72, .12], [.22, .54], [.68, .78]],
    12: [[.20, .14], [.82, .47], [.42, .76]],
    13: [[.77, .18], [.19, .61], [.64, .82]],
    14: [[.16, .28], [.81, .52], [.37, .86]],
  };
  const count = damage === 50 ? 1 : damage === 75 ? 2 : 3;
  const holes = (profiles[level] ?? profiles[7]).slice(0, count).map(([px, py], index) => {
    const size = width * (.045 + damage * .00045 + index * .012);
    const x = px * width;
    const y = py * height;
    return `<path d="M ${x-size} ${y-size*.4} l ${size*.4} ${-size*.8} l ${size*.9} ${size*.25} l ${size*.6} ${size*.85} l ${-size*.75} ${size*.65} l ${-size*1.15} ${-size*.3} z" fill="white"/>`;
  }).join("");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${holes}</svg>`);
}

async function totemWithAlpha(input, forceWhiteRemoval = false) {
  const image = sharp(input).rotate().ensureAlpha();
  if (!forceWhiteRemoval) return image.png().toBuffer();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const low = Math.min(data[i], data[i + 1], data[i + 2]);
    const high = Math.max(data[i], data[i + 1], data[i + 2]);
    if (low >= 246 && high - low <= 9) data[i + 3] = 0;
    else if (low >= 231 && high - low <= 15) data[i + 3] = Math.round(255 * (246 - low) / 15);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function buildTotem(level, input) {
  const base = await totemWithAlpha(input, level === 10);
  const meta = await sharp(base).metadata();
  for (const damage of [0, 25, 50, 75, 100]) {
    let image = sharp(base);
    if (damage) {
      image = image.modulate({ brightness: 1 - damage * 0.0032, saturation: 1 - damage * 0.0045 });
      const chunks = missingChunksSvg(meta.width, meta.height, level, damage);
      const composites = [{ input: crackSvg(meta.width, meta.height, damage), blend: "over" }];
      if (chunks) composites.unshift({ input: chunks, blend: "dest-out" });
      image = image.composite(composites);
    }
    const target = path.join(OUT, `level-${level}`, `totem-${damage}.webp`);
    await image.webp({ quality: 90, alphaQuality: 100 }).toFile(target);
  }
}

await fs.mkdir(OUT, { recursive: true });

for (const [levelText, definition] of Object.entries(levels)) {
  const level = Number(levelText);
  const dir = path.join(OUT, `level-${level}`);
  await fs.mkdir(dir, { recursive: true });
  for (const [index, background] of definition.backgrounds.entries()) {
    await webp(fromSource(level, background), path.join(dir, `background${index ? `-${index + 1}` : ""}.webp`), { quality: 90 });
  }
  const audioSource = definition.audio.includes("/") ? path.join(SOURCE_ROOT, definition.audio) : fromSource(level, definition.audio);
  await fs.copyFile(audioSource, path.join(dir, `track${path.extname(audioSource).toLowerCase()}`));
  if (definition.totem) {
    const totemSource = definition.totem.includes("/")
      ? path.join(SOURCE_ROOT, definition.totem)
      : fromSource(level, definition.totem);
    await buildTotem(level, totemSource);
  }
}

const shared = path.join(OUT, "actors");
await fs.mkdir(shared, { recursive: true });
for (let index = 1; index <= 4; index += 1) {
  await webp(fromSource(2, `BAT/BAT_${index}.png`), path.join(shared, `bat-${index}.webp`), { trim: true, max: 512 });
  await webp(fromSource(7, `SKELLETON/SKELLETON_${index}.png`), path.join(shared, `skeleton-${index}.webp`), { trim: true, max: 640 });
}
await webp(path.join(SOURCE_ROOT, "ASSets/5. VIVOS/ZORRO_SIBERIANO.png"), path.join(shared, "arctic-fox.webp"), { trim: true, max: 640 });
await chromaKey(path.join(GENERATED, "exec-e18f8239-6125-4eba-a02f-631fae57214c.png"), path.join(shared, "bone-pile.webp"), [255, 0, 255], 38);
await chromaKey(path.join(GENERATED, "exec-9b43c3a4-d398-4e88-8fc1-4322710e329f.png"), path.join(shared, "fallen-bat.webp"), [0, 255, 0], 45);

console.log(`Story assets built in ${OUT}`);
