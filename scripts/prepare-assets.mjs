import { mkdir, cp, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { build } from 'esbuild';
import sharp from 'sharp';

const runFile = promisify(execFile);

// ──────────────── Icons & Screenshots ────────────────
for (const size of [192, 512])
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/icon-${size}.png`);
for (const size of [192, 512]) {
  const innerSize = Math.round(size * 0.8);
  const padding = Math.round((size - innerSize) / 2);
  const maskInner = await sharp('public/icon.svg').resize(innerSize, innerSize).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 24, g: 63, b: 53, alpha: 1 },
    },
  })
    .composite([{ input: maskInner, top: padding, left: padding }])
    .png()
    .toFile(`public/icon-maskable-${size}.png`);
}
await sharp({
  create: {
    width: 1280,
    height: 800,
    channels: 4,
    background: { r: 24, g: 63, b: 53, alpha: 1 },
  },
})
  .composite([{ input: 'public/icon-512.png', top: 144, left: 384 }])
  .png()
  .toFile('public/screenshot-wide.png');
await sharp({
  create: {
    width: 750,
    height: 1334,
    channels: 4,
    background: { r: 24, g: 63, b: 53, alpha: 1 },
  },
})
  .composite([{ input: 'public/icon-512.png', top: 411, left: 119 }])
  .png()
  .toFile('public/screenshot-narrow.png');

// ──────────────── SQLite WASM ────────────────
await mkdir('public/sqlite', { recursive: true });
await cp('node_modules/@sqlite.org/sqlite-wasm/dist', 'public/sqlite', { recursive: true });

// ──────────────── Assets (selective copy, skip raw bmg) ────────────────
await mkdir('public/assets', { recursive: true });
// Copy all assets EXCEPT the raw bmg folder (we'll compress those separately)
await cp('assets', 'public/assets', {
  recursive: true,
  filter: (src) => !src.replace(/\\/g, '/').includes('assets/bmg'),
});

// ──────────────── Roca Tech Logo ────────────────
await mkdir('public/assets/rocatech', { recursive: true });
await cp('assets/rocatech/VECTOR LOGO FINAL.svg', 'public/assets/rocatech/roca-tech-logo.svg');
await sharp('assets/rocatech/LOGO-Transparente.png')
  .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true })
  .toFile('public/assets/rocatech/roca-tech-logo.png');

// ──────────────── Character Sprite Extraction → WebP ────────────────
try {
  const legacySpritePngs = [
    'character-sprite-1.png',
    'character-sprite-2.png',
    ...Array.from({ length: 6 }, (_, index) => `pili-run-${index}.png`),
    ...Array.from({ length: 2 }, (_, index) => `pili-jump-${index}.png`),
    ...Array.from({ length: 2 }, (_, index) => `pili-slide-${index}.png`),
    'pili-idle-0.png',
  ];
  await Promise.all(
    legacySpritePngs.map((file) => rm(join(resolve('public/assets'), file), { force: true })),
  );

  // Character profile sprites
  await sharp('assets/2.png')
    .extract({ left: 530, top: 13, width: 242, height: 230 })
    .webp({ quality: 80 })
    .toFile('public/assets/character-sprite-1.webp');
  await sharp('assets/2.png')
    .extract({ left: 802, top: 10, width: 218, height: 235 })
    .webp({ quality: 80 })
    .toFile('public/assets/character-sprite-2.webp');

  // Dynamic run cycle frames from row 1 of assets/2.png
  const runCoords = [
    { left: 57, top: 260, width: 193, height: 235 },
    { left: 293, top: 260, width: 208, height: 235 },
    { left: 547, top: 260, width: 203, height: 235 },
    { left: 801, top: 260, width: 198, height: 235 },
    { left: 1059, top: 260, width: 196, height: 235 },
    { left: 1320, top: 260, width: 196, height: 235 },
  ];
  for (let i = 0; i < runCoords.length; i++) {
    await sharp('assets/2.png')
      .extract(runCoords[i])
      .webp({ quality: 80 })
      .toFile(`public/assets/pili-run-${i}.webp`);
  }

  // Jump animation frames
  const jumpCoords = [
    { left: 232, top: 509, width: 229, height: 247 },
    { left: 551, top: 509, width: 227, height: 247 },
  ];
  for (let i = 0; i < jumpCoords.length; i++) {
    await sharp('assets/2.png')
      .extract(jumpCoords[i])
      .webp({ quality: 80 })
      .toFile(`public/assets/pili-jump-${i}.webp`);
  }

  // Crouching / Slide frames from row 3
  await sharp('assets/2.png')
    .extract({ left: 810, top: 760, width: 230, height: 260 })
    .webp({ quality: 80 })
    .toFile('public/assets/pili-slide-0.webp');
  await sharp('assets/2.png')
    .extract({ left: 1060, top: 760, width: 230, height: 260 })
    .webp({ quality: 80 })
    .toFile('public/assets/pili-slide-1.webp');

  // Idle frame
  await sharp('assets/2.png')
    .extract({ left: 300, top: 10, width: 180, height: 234 })
    .webp({ quality: 80 })
    .toFile('public/assets/pili-idle-0.webp');

  // ──────────────── Copito (Conejito Blanco) Extraction from SVG ────────────────
  for (let i = 0; i < 6; i++) {
    await sharp('assets/rabbit_platformer_sprite_sheet.svg')
      .extract({ left: i * 256, top: 256, width: 256, height: 256 })
      .webp({ quality: 85 })
      .toFile(`public/assets/copito-run-${i}.webp`);
  }
  await sharp('assets/rabbit_platformer_sprite_sheet.svg')
    .extract({ left: 1024, top: 0, width: 256, height: 256 })
    .webp({ quality: 85 })
    .toFile('public/assets/copito-jump-0.webp');
  await sharp('assets/rabbit_platformer_sprite_sheet.svg')
    .extract({ left: 0, top: 512, width: 256, height: 256 })
    .webp({ quality: 85 })
    .toFile('public/assets/copito-jump-1.webp');
  await sharp('assets/rabbit_platformer_sprite_sheet.svg')
    .extract({ left: 1024, top: 512, width: 256, height: 256 })
    .webp({ quality: 85 })
    .toFile('public/assets/copito-slide-0.webp');
  await sharp('assets/rabbit_platformer_sprite_sheet.svg')
    .extract({ left: 1280, top: 512, width: 256, height: 256 })
    .webp({ quality: 85 })
    .toFile('public/assets/copito-slide-1.webp');
  await sharp('assets/rabbit_platformer_sprite_sheet.svg')
    .extract({ left: 0, top: 0, width: 256, height: 256 })
    .webp({ quality: 85 })
    .toFile('public/assets/copito-idle-0.webp');
  await sharp('assets/rabbit_platformer_sprite_sheet.svg')
    .extract({ left: 0, top: 0, width: 256, height: 256 })
    .webp({ quality: 85 })
    .toFile('public/assets/copito-avatar.webp');

  // ──────────────── Posho (Pollito Dorado) Extraction ────────────────
  const poshoCols = [
    { left: 20, width: 110 },
    { left: 165, width: 108 },
    { left: 310, width: 108 },
    { left: 455, width: 108 },
    { left: 595, width: 115 },
    { left: 740, width: 110 },
  ];
  for (let i = 0; i < 6; i++) {
    await sharp('assets/PoshoAnimated-removebg-preview.png')
      .extract({ left: poshoCols[i].left, top: 10, width: poshoCols[i].width, height: 265 })
      .webp({ quality: 85 })
      .toFile(`public/assets/posho-run-${i}.webp`);
  }
  await sharp('assets/PoshoAnimated-removebg-preview.png')
    .extract({ left: poshoCols[4].left, top: 10, width: poshoCols[4].width, height: 265 })
    .webp({ quality: 85 })
    .toFile('public/assets/posho-jump-0.webp');
  await sharp('assets/PoshoAnimated-removebg-preview.png')
    .extract({ left: poshoCols[5].left, top: 10, width: poshoCols[5].width, height: 265 })
    .webp({ quality: 85 })
    .toFile('public/assets/posho-jump-1.webp');
  await sharp('assets/PoshoAnimated-removebg-preview.png')
    .extract({ left: poshoCols[2].left, top: 10, width: poshoCols[2].width, height: 265 })
    .webp({ quality: 85 })
    .toFile('public/assets/posho-slide-0.webp');
  await sharp('assets/PoshoAnimated-removebg-preview.png')
    .extract({ left: poshoCols[3].left, top: 10, width: poshoCols[3].width, height: 265 })
    .webp({ quality: 85 })
    .toFile('public/assets/posho-slide-1.webp');
  await sharp('assets/PoshoAnimated-removebg-preview.png')
    .extract({ left: poshoCols[0].left, top: 10, width: poshoCols[0].width, height: 265 })
    .webp({ quality: 85 })
    .toFile('public/assets/posho-idle-0.webp');
  await sharp('assets/PoshoAnimated-removebg-preview.png')
    .extract({ left: poshoCols[0].left, top: 10, width: poshoCols[0].width, height: 265 })
    .webp({ quality: 85 })
    .toFile('public/assets/posho-avatar.webp');

  // ──────────────── Mimi (Gatita Rosa) Extraction ────────────────
  const mimiCols = [
    { left: 75, width: 445 },
    { left: 650, width: 470 },
    { left: 1240, width: 480 },
    { left: 1845, width: 475 },
    { left: 2430, width: 515 },
    { left: 3050, width: 460 },
  ];
  for (let i = 0; i < 6; i++) {
    await sharp('assets/Pink Cat2.png')
      .extract({ left: mimiCols[i].left, top: 140, width: mimiCols[i].width, height: 320 })
      .webp({ quality: 85 })
      .toFile(`public/assets/mimi-run-${i}.webp`);
  }
  await sharp('assets/Pink Cat2.png')
    .extract({ left: mimiCols[3].left, top: 630, width: mimiCols[3].width, height: 460 })
    .webp({ quality: 85 })
    .toFile('public/assets/mimi-jump-0.webp');
  await sharp('assets/Pink Cat2.png')
    .extract({ left: mimiCols[4].left, top: 630, width: mimiCols[4].width, height: 460 })
    .webp({ quality: 85 })
    .toFile('public/assets/mimi-jump-1.webp');
  await sharp('assets/Pink Cat2.png')
    .extract({ left: mimiCols[0].left, top: 630, width: mimiCols[0].width, height: 460 })
    .webp({ quality: 85 })
    .toFile('public/assets/mimi-slide-0.webp');
  await sharp('assets/Pink Cat2.png')
    .extract({ left: mimiCols[1].left, top: 630, width: mimiCols[1].width, height: 460 })
    .webp({ quality: 85 })
    .toFile('public/assets/mimi-slide-1.webp');
  await sharp('assets/Pink Cat2.png')
    .extract({ left: mimiCols[0].left, top: 140, width: mimiCols[0].width, height: 320 })
    .webp({ quality: 85 })
    .toFile('public/assets/mimi-idle-0.webp');
  await sharp('assets/Pink Cat2.png')
    .extract({ left: mimiCols[0].left, top: 140, width: mimiCols[0].width, height: 320 })
    .webp({ quality: 85 })
    .toFile('public/assets/mimi-avatar.webp');
} catch (err) {
  console.error('Error extracting character frames:', err);
}

// ──────────────── Audio Compression (MP3 → 64 kbps mono MP3) ────────────────
const bmgSrc = resolve('assets/bmg');
const bmgDest = resolve('public/assets/bmg');
const audioManifestPath = join(bmgDest, 'asset-manifest.json');
const audioEncodingVersion = 1;
await mkdir(bmgDest, { recursive: true });

const mp3Files = (await readdir(bmgSrc))
  .filter((file) => file.toLowerCase().endsWith('.mp3'))
  .sort((left, right) => left.localeCompare(right));
if (mp3Files.length !== 11) {
  throw new Error(`Expected 11 built-in music tracks in assets/bmg, found ${mp3Files.length}.`);
}
const expectedAudioFiles = new Set([...mp3Files, 'asset-manifest.json']);
for (const file of await readdir(bmgDest)) {
  if (!expectedAudioFiles.has(file)) await rm(join(bmgDest, file), { recursive: true });
}
/** @type {{ version: number, sources: Record<string, { hash: string, size: number }> }} */
let previousAudioManifest = { version: 0, sources: {} };
try {
  previousAudioManifest = JSON.parse(await readFile(audioManifestPath, 'utf8'));
} catch {
  // A clean checkout or an older pipeline has no manifest yet.
}
/** @type {{ version: number, sources: Record<string, { hash: string, size: number }> }} */
const nextAudioManifest = { version: audioEncodingVersion, sources: {} };
console.log(`\n🎵 Compressing ${mp3Files.length} music tracks to 64 kbps mono MP3…`);
let audioTotal = 0;
for (const file of mp3Files) {
  const src = join(bmgSrc, file);
  const dest = join(bmgDest, file);
  const sourceHash = createHash('sha256')
    .update(await readFile(src))
    .digest('hex');
  const previous = previousAudioManifest.sources[file];
  let output;
  try {
    output = await stat(dest);
  } catch {
    // Missing output is generated below.
  }
  const reusable =
    previousAudioManifest.version === audioEncodingVersion &&
    previous?.hash === sourceHash &&
    previous.size === output?.size;
  if (!reusable) {
    await runFile(
      ffmpeg.path,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        src,
        '-map_metadata',
        '-1',
        '-ac',
        '1',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '64k',
        '-y',
        dest,
      ],
      { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 },
    );
  }
  const { size } = await stat(dest);
  nextAudioManifest.sources[file] = { hash: sourceHash, size };
  audioTotal += size;
  console.log(`  ${reusable ? '↻' : '✓'} ${file} → ${Math.round(size / 1024)} KB`);
}
await writeFile(audioManifestPath, `${JSON.stringify(nextAudioManifest, null, 2)}\n`);
console.log(`  Total compressed audio: ${(audioTotal / 1024 / 1024).toFixed(1)} MB\n`);

// ──────────────── Workers ────────────────
await mkdir('public/workers', { recursive: true });
await build({
  entryPoints: ['src/workers/storage.worker.ts', 'src/workers/image.worker.ts'],
  outdir: 'public/workers',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['@sqlite.org/sqlite-wasm'],
  plugins: [
    {
      name: 'local-sqlite',
      setup(b) {
        b.onResolve({ filter: /^@sqlite.org\/sqlite-wasm$/ }, () => ({
          path: '../sqlite/index.mjs',
          external: true,
        }));
      },
    },
  ],
});

// Development must also replace stale build-specific precache manifests.
if (process.env.npm_lifecycle_event === 'dev') {
  await writeFile(
    'public/sw.js',
    `// Development Service Worker: satisfies PWA installability with a pass-through fetch handler.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  // Pass-through fetch handler ensures Chrome identifies the PWA as installable in dev
  event.respondWith(fetch(event.request));
});
`,
  );
}
