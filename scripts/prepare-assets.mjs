import { mkdir, cp, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import sharp from 'sharp';
for (const size of [192, 512])
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/icon-${size}.png`);
const maskInner = await sharp('public/icon.svg').resize(410, 410).png().toBuffer();
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 24, g: 63, b: 53, alpha: 1 },
  },
})
  .composite([{ input: maskInner, top: 51, left: 51 }])
  .png()
  .toFile('public/icon-maskable-512.png');
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
await mkdir('public/sqlite', { recursive: true });
await cp('node_modules/@sqlite.org/sqlite-wasm/dist', 'public/sqlite', { recursive: true });
await mkdir('public/assets', { recursive: true });
await cp('assets', 'public/assets', { recursive: true });
await mkdir('public/assets/rocatech', { recursive: true });
await cp('assets/rocatech/VECTOR LOGO FINAL.svg', 'public/assets/rocatech/roca-tech-logo.svg');
await sharp('assets/rocatech/LOGO-Transparente.png')
  .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true })
  .toFile('public/assets/rocatech/roca-tech-logo.png');
try {
  await sharp('assets/2.png')
    .extract({ left: 530, top: 13, width: 242, height: 230 })
    .toFile('public/assets/character-sprite-1.png');
  await sharp('assets/2.png')
    .extract({ left: 802, top: 10, width: 218, height: 235 })
    .toFile('public/assets/character-sprite-2.png');

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
    await sharp('assets/2.png').extract(runCoords[i]).toFile(`public/assets/pili-run-${i}.png`);
  }

  // Jump animation frames
  const jumpCoords = [
    { left: 232, top: 509, width: 229, height: 247 },
    { left: 551, top: 509, width: 227, height: 247 },
  ];
  for (let i = 0; i < jumpCoords.length; i++) {
    await sharp('assets/2.png').extract(jumpCoords[i]).toFile(`public/assets/pili-jump-${i}.png`);
  }

  // Crouching / Slide frames from row 3
  await sharp('assets/2.png')
    .extract({ left: 810, top: 760, width: 230, height: 260 })
    .toFile('public/assets/pili-slide-0.png');
  await sharp('assets/2.png')
    .extract({ left: 1060, top: 760, width: 230, height: 260 })
    .toFile('public/assets/pili-slide-1.png');

  // Idle frame
  await sharp('assets/2.png')
    .extract({ left: 300, top: 10, width: 180, height: 234 })
    .toFile('public/assets/pili-idle-0.png');
} catch (err) {
  console.error('Error extracting character frames:', err);
}
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
  await writeFile('public/sw.js', `// Development: retire production caching without intercepting requests.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.registration.unregister()));
`);
}
