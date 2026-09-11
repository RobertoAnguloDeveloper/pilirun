import { mkdir, cp } from 'node:fs/promises';
import { build } from 'esbuild';
import sharp from 'sharp';
for (const size of [192, 512])
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/icon-${size}.png`);
await mkdir('public/sqlite', { recursive: true });
await cp('node_modules/@sqlite.org/sqlite-wasm/dist', 'public/sqlite', { recursive: true });
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
