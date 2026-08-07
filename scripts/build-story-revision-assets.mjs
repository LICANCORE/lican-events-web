import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const GAME = path.join(ROOT, "public/headbangdealers_the_game/assets");
const STORY = path.join(GAME, "story-levels");
const GENERATED = "C:/Users/rulin/.codex/generated_images/019fcf3c-ec09-71d1-84c3-9bcf3648468f";
const SOURCE = "D:/0. LICAN/GAME_HEADBANG_DEALERS_BASS_TRAFFICKERS";
const RAW = path.join(ROOT, "artifacts/imagegen-story-revision");

const generated = {
  fox: "exec-d77e301d-d4ff-4442-a2fc-2a55b00044fb.png",
  riot: "exec-b8d8f079-eca6-434f-a23b-bf417a551532.png",
  riotDown: "exec-bd7cc5e7-362b-492b-9726-f728d8bd6b67.png",
  razorWire: "exec-1d5a055c-ad5a-470a-afe0-5c65ce45fde7.png",
};

async function chromaBuffer(input, key, tolerance = 40) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.hypot(data[index] - key[0], data[index + 1] - key[1], data[index + 2] - key[2]);
    if (distance <= tolerance) data[index + 3] = 0;
    else if (distance <= tolerance * 2.4) data[index + 3] = Math.min(data[index + 3], Math.round(255 * (distance - tolerance) / (tolerance * 1.4)));
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function saveChroma(input, output, key, tolerance = 40, max = 640) {
  const keyed = await chromaBuffer(input, key, tolerance);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(keyed).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(max, max, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 92, alphaQuality: 100 }).toFile(output);
}

async function splitSheet(name, prefix, key, tolerance = 40) {
  const input = path.join(GENERATED, generated[name]);
  const metadata = await sharp(input).metadata();
  const cellWidth = Math.floor(metadata.width / 4);
  for (let frame = 0; frame < 4; frame += 1) {
    const fullWidth = frame === 3 ? metadata.width - frame * cellWidth : cellWidth;
    const inset = Math.round(fullWidth * .05);
    const cell = await sharp(input).extract({ left: frame * cellWidth + inset, top: 0, width: fullWidth - inset * 2, height: metadata.height }).png().toBuffer();
    await saveChroma(cell, path.join(STORY, "actors", `${prefix}-${frame + 1}.webp`), key, tolerance);
  }
}

async function buildReveal(character, input) {
  const outputDir = path.join(GAME, "unlock/characters", character);
  await fs.mkdir(outputDir, { recursive: true });
  const base = sharp(input).ensureAlpha().resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const baseBuffer = await base.png().toBuffer();
  const pixelSizes = [24, 48, 96, 192, 1024];
  const brightness = [.44, .58, .72, .88, 1];
  for (let stage = 1; stage <= 5; stage += 1) {
    let image = sharp(baseBuffer);
    if (stage < 5) {
      // Materialize the low-resolution pass before scaling it back up. Sharp only
      // applies one resize per pipeline, so a buffer boundary is required here.
      const pixelBuffer = await image
        .resize(pixelSizes[stage - 1], pixelSizes[stage - 1], { kernel: sharp.kernel.nearest })
        .png()
        .toBuffer();
      image = sharp(pixelBuffer)
        .resize(1024, 1024, { kernel: sharp.kernel.nearest })
        .modulate({ saturation: .72 + stage * .055, brightness: brightness[stage - 1] });
    }
    await image.webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(outputDir, `HD_BT_UNLOCK_${character.toUpperCase().replaceAll("-", "_")}_STAGE_0${stage}_v020.webp`));
  }
}

async function buildTotemPieces(level, input) {
  const outputDir = path.join(STORY, "totem-pieces", `level-${level}`);
  await fs.mkdir(outputDir, { recursive: true });
  const base = await sharp(input).ensureAlpha().png().toBuffer();
  const metadata = await sharp(base).metadata();
  const regions = [
    [.34, .12, .32, .22],
    [.18, .43, .28, .22],
    [.55, .63, .29, .24],
  ];
  for (const [index, region] of regions.entries()) {
    const left = Math.max(0, Math.round(metadata.width * region[0]));
    const top = Math.max(0, Math.round(metadata.height * region[1]));
    const width = Math.min(metadata.width - left, Math.round(metadata.width * region[2]));
    const height = Math.min(metadata.height - top, Math.round(metadata.height * region[3]));
    await sharp(base).extract({ left, top, width, height })
      .resize(180, 180, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(outputDir, `piece-${index + 1}.webp`));
  }
}

await fs.mkdir(RAW, { recursive: true });
for (const [name, file] of Object.entries(generated)) await fs.copyFile(path.join(GENERATED, file), path.join(RAW, `${name}-chroma-source.png`));
await splitSheet("fox", "arctic-fox-groom", [255, 0, 255], 44);
await splitSheet("riot", "riot-charge", [0, 255, 0], 44);
await saveChroma(path.join(GENERATED, generated.riotDown), path.join(STORY, "actors/riot-defeated.webp"), [0, 255, 0], 44, 720);
await saveChroma(path.join(GENERATED, generated.razorWire), path.join(STORY, "actors/razor-wire.webp"), [0, 255, 0], 44, 520);

await buildReveal("hydraxxx", path.join(GAME, "character/selector_v009/HD_BT_HYDRAXXX_FRONT_GAME_SELECT_v009.webp"));
await buildReveal("magic_bite", path.join(GAME, "character/selector_v019/HD_BT_MAGIC_BITE_FRONT_GAME_SELECT_v019.webp"));
await buildReveal("henry_rituals", path.join(GAME, "character/selector_v014/HD_BT_HENRY_RITUALS_FRONT_GAME_SELECT_v014.webp"));

const level6Dir = path.join(STORY, "level-6");
await fs.mkdir(level6Dir, { recursive: true });
await fs.copyFile(path.join(GAME, "campaign/backgrounds/HD_BT_LEVEL04_BACKGROUND.webp"), path.join(level6Dir, "background.webp"));
for (const damage of [0, 25, 50, 75, 100]) {
  await fs.copyFile(path.join(GAME, `campaign/totems/HD_BT_LEVEL04_TOTEM_DAMAGE${String(damage).padStart(2, "0")}.webp`), path.join(level6Dir, `totem-${damage}.webp`));
}
await fs.copyFile(path.join(SOURCE, "MUSIC_SOURCE/FULL_TRACKS/V2/BEUTNOISE_LVL_1.mp3"), path.join(level6Dir, "track.mp3"));
const level1Dir = path.join(STORY, "level-1");
await fs.mkdir(level1Dir, { recursive: true });
await fs.copyFile(path.join(GAME, "audio/custom/HD_BT_AUDIO_CUSTOM_FRANKALE_PABLO_TUTORIAL_v001.wav"), path.join(level1Dir, "track.wav"));

const pieceSources = {
  1: path.join(GAME, "targets/HD_BT_TARGET_BASSTOTEM_DAMAGE00_v001.webp"),
  3: path.join(GAME, "campaign/totems/HD_BT_LEVEL02_TOTEM_DAMAGE00.webp"),
  4: path.join(GAME, "campaign/totems/HD_BT_LEVEL03_TOTEM_DAMAGE00.webp"),
  5: path.join(STORY, "level-5/totem-0.webp"),
  6: path.join(STORY, "level-6/totem-0.webp"),
  7: path.join(STORY, "level-7/totem-0.webp"),
  8: path.join(GAME, "campaign/totems/HD_BT_LEVEL05_TOTEM_DAMAGE00_v014.webp"),
  9: path.join(GAME, "campaign/totems/HD_BT_LEVEL06_TOTEM_DAMAGE00.webp"),
  10: path.join(STORY, "level-10/totem-0.webp"),
  11: path.join(GAME, "campaign/totems/HD_BT_LEVEL07_TOTEM_DAMAGE00_v012.webp"),
  12: path.join(STORY, "level-12/totem-0.webp"),
  13: path.join(STORY, "level-13/totem-0.webp"),
  14: path.join(STORY, "level-14/totem-0.webp"),
};
for (const [level, input] of Object.entries(pieceSources)) await buildTotemPieces(level, input);

console.log("Story revision assets generated.");
