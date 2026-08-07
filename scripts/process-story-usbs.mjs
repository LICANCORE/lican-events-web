import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [sourceDirectory, outputDirectory, previewPath] = process.argv.slice(2);

if (!sourceDirectory || !outputDirectory) {
  throw new Error('Usage: node scripts/process-story-usbs.mjs <source-dir> <output-dir>');
}

const sourceFiles = (await readdir(sourceDirectory))
  .filter((name) => name.endsWith('_SOURCE_v001.png'))
  .sort();
const processed = [];

for (const sourceName of sourceFiles) {
  const sourcePath = path.join(sourceDirectory, sourceName);
  const outputName = sourceName.replace('_SOURCE_v001.png', '_v001.png');
  const outputPath = path.join(outputDirectory, outputName);
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const max = Math.max(red, green, blue) / 255;
    const min = Math.min(red, green, blue) / 255;
    const delta = max - min;
    let hue = 0;
    if (delta > 0) {
      if (max === red / 255) hue = 60 * (((green - blue) / 255 / delta) % 6);
      else if (max === green / 255) hue = 60 * ((blue - red) / 255 / delta + 2);
      else hue = 60 * ((red - green) / 255 / delta + 4);
    }
    if (hue < 0) hue += 360;
    const saturation = max === 0 ? 0 : delta / max;
    const chroma = hue >= 292 && hue <= 338 && saturation >= 0.34 && max >= 0.12;
    data[offset + 3] = chroma ? 0 : 255;
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath);

  processed.push({ outputName, outputPath });
  process.stdout.write(`${outputName}\n`);
}

if (previewPath) {
  const columns = 3;
  const tileWidth = 512;
  const tileHeight = 340;
  const rows = Math.ceil(processed.length / columns);
  const labels = {
    BEUTNOISE: 'BEUTNOISE',
    DAVID_NEON: 'DAVID NEON',
    EDDY_CLASH: 'EDDY CLASH',
    FAYE: 'FAYE',
    FRANKALE: 'FRANKALE',
    HENRY_RITUALS: 'HENRY RITUALS',
    HYDRAXXX: 'HYDRAXXX',
    MAGIC_BITE: 'MAGIC BITE',
    ONIONSTEP: 'ONIONSTEP',
    QVEENS: 'QVEENS',
    VIKO: 'VIKO',
  };
  const layers = [];

  for (const [index, item] of processed.entries()) {
    const key = item.outputName
      .replace('HD_BT_USB_STORY_', '')
      .replace('_v001.png', '');
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * tileHeight;
    const sprite = await sharp(item.outputPath)
      .resize(472, 270, { fit: 'contain' })
      .png()
      .toBuffer();
    const label = Buffer.from(`
      <svg width="512" height="54" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="54" fill="#081008"/>
        <text x="256" y="36" text-anchor="middle" fill="#55ff00"
          font-family="monospace" font-size="25" font-weight="bold">${labels[key]}</text>
      </svg>`);
    layers.push({ input: sprite, left: left + 20, top: top + 6 });
    layers.push({ input: label, left, top: top + 280 });
  }

  const preview = sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 4,
      background: '#030603',
    },
  }).composite(layers).flatten({ background: '#030603' });
  if (/\.jpe?g$/i.test(previewPath)) {
    await preview.jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toFile(previewPath);
  } else {
    await preview.png({ compressionLevel: 9 }).toFile(previewPath);
  }
  process.stdout.write(`PREVIEW ${previewPath}\n`);
}
