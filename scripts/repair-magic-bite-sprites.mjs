import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const characterDir = path.join(root, "public/headbangdealers_the_game/assets/character/magic_bite");
const backupDir = path.join(root, "artifacts/backups/magic-bite-v019-before-fix");
const sourceDir = path.join(root, "artifacts/imagegen-story-revision");
const generatedDir = "C:/Users/rulin/.codex/generated_images/019fcf3c-ec09-71d1-84c3-9bcf3648468f";
const actionSource = path.join(generatedDir, "exec-6f2c44e9-e339-4230-98c1-41c8a690f26a.png");
const walkSource = path.join(generatedDir, "exec-577314c6-f83e-462a-99da-1d3a9af06d25.png");

await fs.mkdir(backupDir, { recursive: true });
await fs.mkdir(sourceDir, { recursive: true });
for (const file of await fs.readdir(characterDir)) {
  if (!file.endsWith(".webp")) continue;
  const backup = path.join(backupDir, file);
  try { await fs.access(backup); } catch { await fs.copyFile(path.join(characterDir, file), backup); }
}
await fs.copyFile(actionSource, path.join(sourceDir, "magic-bite-actions-chroma-source.png"));
await fs.copyFile(walkSource, path.join(sourceDir, "magic-bite-walk-chroma-source.png"));

async function removeMagenta(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.hypot(data[index] - 255, data[index + 1], data[index + 2] - 255);
    const magentaDominant = data[index] > 95 && data[index + 2] > 95
      && data[index + 1] < 170 && (data[index] + data[index + 2]) / 2 > data[index + 1] * 1.45;
    if (distance < 42 || magentaDominant) data[index + 3] = 0;
    else if (distance < 100) data[index + 3] = Math.min(data[index + 3], Math.round((distance - 42) / 58 * 255));
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

async function keepLargestComponent(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const seen = new Uint8Array(pixels);
  const components = [];
  for (let start = 0; start < pixels; start += 1) {
    if (seen[start] || data[start * 4 + 3] < 20) continue;
    const queue = [start];
    const members = [];
    seen[start] = 1;
    while (queue.length) {
      const index = queue.pop();
      members.push(index);
      const x = index % info.width;
      const neighbours = [index - info.width, index + info.width];
      if (x > 0) neighbours.push(index - 1);
      if (x < info.width - 1) neighbours.push(index + 1);
      for (const neighbour of neighbours) if (neighbour >= 0 && neighbour < pixels && !seen[neighbour] && data[neighbour * 4 + 3] >= 20) {
        seen[neighbour] = 1;
        queue.push(neighbour);
      }
    }
    components.push(members);
  }
  components.sort((a, b) => b.length - a.length);
  const keep = new Uint8Array(pixels);
  for (const index of components[0] ?? []) keep[index] = 1;
  for (let index = 0; index < pixels; index += 1) if (!keep[index]) data[index * 4 + 3] = 0;
  return sharp(data, { raw: info }).png().toBuffer();
}

async function normalizedCell(sheet, cellIndex, cellCount, scale, bottom = 238) {
  const metadata = await sharp(sheet).metadata();
  const cellWidth = Math.floor(metadata.width / cellCount);
  const fullLeft = cellIndex * cellWidth;
  const fullWidth = cellIndex === cellCount - 1 ? metadata.width - fullLeft : cellWidth;
  const inset = Math.round(fullWidth * .055);
  const left = fullLeft + inset;
  const width = fullWidth - inset * 2;
  const extracted = await sharp(sheet).extract({ left, top: 0, width, height: metadata.height }).png().toBuffer();
  const transparent = await removeMagenta(extracted);
  const scaled = await sharp(transparent).resize({ width: Math.round(width * scale), height: Math.round(metadata.height * scale), fit: "fill", kernel: sharp.kernel.nearest }).png().toBuffer();
  const isolated = await keepLargestComponent(scaled);
  const trimmed = await sharp(isolated).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const trimmedMeta = await sharp(trimmed).metadata();
  const leftOnCanvas = Math.round((256 - trimmedMeta.width) / 2);
  const topOnCanvas = bottom - trimmedMeta.height;
  if (leftOnCanvas < 0 || topOnCanvas < 0) throw new Error(`Sprite does not fit: ${trimmedMeta.width}x${trimmedMeta.height}`);
  return sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: trimmed, left: leftOnCanvas, top: topOnCanvas }]).png().toBuffer();
}

async function savePair(rightBuffer, rightName, leftName) {
  await sharp(rightBuffer).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(characterDir, rightName));
  await sharp(rightBuffer).flop().webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(characterDir, leftName));
}

const jump = await normalizedCell(actionSource, 1, 3, .279);
const crouch = await normalizedCell(actionSource, 2, 3, .279);
await savePair(jump, "HD_BT_MAGIC_BITE_SIDE_RIGHT_JUMP_v019.webp", "HD_BT_MAGIC_BITE_SIDE_LEFT_JUMP_v019.webp");
await savePair(crouch, "HD_BT_MAGIC_BITE_SIDE_RIGHT_CROUCH_v019.webp", "HD_BT_MAGIC_BITE_SIDE_LEFT_CROUCH_v019.webp");

for (let frame = 0; frame < 4; frame += 1) {
  const sprite = await normalizedCell(walkSource, frame, 4, .30);
  const number = String(frame + 1).padStart(2, "0");
  await savePair(sprite, `HD_BT_MAGIC_BITE_WALK_RIGHT_${number}_v019.webp`, `HD_BT_MAGIC_BITE_WALK_LEFT_${number}_v019.webp`);
}

for (const side of ["RIGHT", "LEFT"]) for (const [pose, version] of [["LOAD", "v019"], ["PAIN", "v013"]]) {
  const file = `HD_BT_MAGIC_BITE_SIDE_${side}_${pose}_${version}.webp`;
  const input = await fs.readFile(path.join(characterDir, file));
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 205; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) data[(y * info.width + x) * 4 + 3] = 0;
  const output = await sharp(data, { raw: info }).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
  await fs.writeFile(path.join(characterDir, file), output);
}

console.log("MAGIC BITE sprites repaired and normalized.");
