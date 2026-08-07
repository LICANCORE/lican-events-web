import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("public/headbangdealers_the_game/assets");
const output = path.resolve("artifacts/imagegen-story-revision/story-revision-assets-contact-sheet.png");
const assets = [
  ["ZORRO · 4 FASES", "story-levels/actors/arctic-fox-groom-1.webp"],
  ["ZORRO · LIMPIEZA", "story-levels/actors/arctic-fox-groom-3.webp"],
  ["HURT NIVEL 8", "story-levels/actors/razor-wire.webp"],
  ["ANTIDISTURBIOS · CARGA", "story-levels/actors/riot-charge-2.webp"],
  ["ANTIDISTURBIOS · DERRIBADO", "story-levels/actors/riot-defeated.webp"],
  ["HYDRAXXX · FASE 5", "unlock/characters/hydraxxx/HD_BT_UNLOCK_HYDRAXXX_STAGE_05_v020.webp"],
  ["MAGIC BITE · FASE 5", "unlock/characters/magic_bite/HD_BT_UNLOCK_MAGIC_BITE_STAGE_05_v020.webp"],
  ["HENRY RITUALS · FASE 5", "unlock/characters/henry_rituals/HD_BT_UNLOCK_HENRY_RITUALS_STAGE_05_v020.webp"],
];
const tileW = 480;
const tileH = 360;
const titleH = 46;
const composites = [];
for (let index = 0; index < assets.length; index += 1) {
  const [label, relative] = assets[index];
  const image = await sharp(path.join(root, relative)).resize(tileW - 28, tileH - titleH - 22, { fit: "contain" }).png().toBuffer();
  const svg = Buffer.from(`<svg width="${tileW}" height="${tileH}"><rect width="100%" height="100%" fill="#061009" stroke="#55ff00" stroke-width="3"/><text x="18" y="31" fill="#55ff00" font-size="21" font-weight="900" font-family="Arial Narrow,Arial">${label}</text></svg>`);
  const tile = await sharp(svg).composite([{ input: image, gravity: "south" }]).png().toBuffer();
  composites.push({ input: tile, left: index % 2 * tileW, top: Math.floor(index / 2) * tileH });
}
await fs.mkdir(path.dirname(output), { recursive: true });
await sharp({ create: { width: tileW * 2, height: tileH * 4, channels: 4, background: "#020403" } })
  .composite(composites).png().toFile(output);
console.log(output);
