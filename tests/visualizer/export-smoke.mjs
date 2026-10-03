import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.env.TEST_URL || 'http://127.0.0.1:4176/Headbang-Visualizer';
const name = url.includes('127.0.0.1') ? 'local' : 'production';
await mkdir('artifacts/visualizer', { recursive: true });
// Ten seconds of generated pulses, with no copyrighted recording or network upload.
const rate = 48000;
const wav = Buffer.alloc(44 + rate * 10 * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 0; i < rate * 10; i++) {
  const t = i / rate;
  wav.writeInt16LE(Math.round(15000 * Math.sin(t * Math.PI * 2 * 80) * Math.exp(-(t % 0.5) * 18)), 44 + i * 2);
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  const uploads = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.method() === 'POST') uploads.push(request.url()); });
  const response = await page.goto(url);
  assert.equal(response.status(), 200);
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex, nofollow, noarchive/);
  assert.equal(await page.locator('#syncOffset').count(), 1);
  await page.locator('#audioFile').setInputFiles({ name: 'test-pulses.wav', mimeType: 'audio/wav', buffer: wav });
  await page.waitForFunction(() => !document.querySelector('#recordButton').disabled);
  await page.evaluate(() => {
    window.replayedEvents = [];
    const original = applyPerformanceEvent;
    applyPerformanceEvent = (event) => {
      window.replayedEvents.push({ ...event, appliedAt: audio.currentTime });
      original(event);
    };
  });
  await page.locator('#recordButton').click();
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(500);
    await page.locator('#manualKickButton').click();
    await page.keyboard.press('Space');
    for (const key of ['p', 'o', 'f']) await page.keyboard.press(key);
  }
  await page.locator('[data-preset="minimal"]').click();
  await page.locator('#intensity').fill('70');
  await page.locator('#bounce').fill('8');
  await page.waitForTimeout(2500);
  const performance = await page.evaluate(() => ({ ...performanceSession, stopTime: audio.currentTime }));
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.locator('#recordButton').click();
  const download = await downloadPromise;
  await download.saveAs(`artifacts/visualizer/${name}-download.mp4`);
  assert.ok(!download.suggestedFilename().includes('sin-finalizar'), await page.locator('#toast').innerText());
  const output = `artifacts/visualizer/${name}.mp4`;
  await download.saveAs(output);
  const bytes = await readFile(output);
  const boxes = [];
  for (let offset = 0; offset < bytes.length;) {
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (size === 1) size = Number(bytes.readBigUInt64BE(offset + 8));
    if (size === 0) size = bytes.length - offset;
    assert.ok(size >= 8);
    boxes.push({ type, offset, size }); offset += size;
  }
  assert.ok(!boxes.some((box) => box.type === 'moof'));
  assert.ok(boxes.find((box) => box.type === 'moov').offset < boxes.find((box) => box.type === 'mdat').offset);
  const result = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (x) => x.charCodeAt(0));
    const file = MP4Box.createFile(); const buffer = bytes.buffer; buffer.fileStart = 0;
    file.appendBuffer(buffer); file.flush(); const info = file.getInfo();
    const video = document.createElement('video'); video.muted = true;
    video.src = URL.createObjectURL(new Blob([buffer], { type: 'video/mp4' }));
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
    const seeks = [];
    for (const fraction of [0.8, 0.2, 0.5]) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Seek timeout')), 8000);
        video.onseeked = () => { clearTimeout(timer); seeks.push(video.currentTime); resolve(); };
        video.currentTime = video.duration * fraction;
      });
    }
    URL.revokeObjectURL(video.src);
    const tracks = info.tracks.map((track) => ({ codec: track.codec, duration: track.duration / track.timescale,
      samples: track.nb_samples, video: track.video, audio: track.audio,
      fps: track.video ? track.nb_samples * track.timescale / track.duration : undefined,
      start: file.getTrackById(track.id).samples[0].cts / track.timescale }));
    return { duration: video.duration, fragmented: info.isFragmented, tracks, seeks, replayedEvents: window.replayedEvents };
  }, bytes.toString('base64'));
  assert.equal(result.fragmented, false);
  assert.match(result.tracks[0].codec, /^avc1/);
  assert.ok(result.tracks.some((track) => track.codec === 'mp4a.40.2'));
  const video = result.tracks.find((track) => track.video);
  assert.equal(video.video.width, 1080); assert.equal(video.video.height, 1920);
  assert.ok(Math.abs(result.duration - performance.stopTime) < 0.5);
  assert.equal(result.replayedEvents.length, performance.events.length);
  const maxEventErrorMs = Math.max(...result.replayedEvents.map((event) => Math.abs(event.appliedAt - event.time) * 1000));
  assert.ok(maxEventErrorMs < 100, `Replay delay: ${maxEventErrorMs} ms`);
  assert.deepEqual(uploads, []); assert.deepEqual(errors, []);
  const report = { url, browser: browser.version(), sizeBytes: bytes.length, boxes, performance, maxEventErrorMs, ...result };
  await writeFile(`artifacts/visualizer/${name}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ url, sizeBytes: bytes.length, duration: result.duration, tracks: result.tracks,
    maxEventErrorMs, eventCount: result.replayedEvents.length, seeks: result.seeks }));
} finally { await browser.close(); }
