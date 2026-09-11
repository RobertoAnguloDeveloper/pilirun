import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
const files = await readdir('.next/static', { recursive: true });
const assets = files
  .filter((file) => /\.(js|css|woff2)$/.test(file))
  .map((file) => '/_next/static/' + file.split(path.sep).join('/'));
const template = await readFile('scripts/sw-template.js', 'utf8');
await writeFile(
  'public/sw.js',
  template
    .replace('pilirun-shell-v1', `pilirun-shell-${buildId}`)
    .replace(
      "self.addEventListener('install'",
      `CORE.push(...${JSON.stringify(assets)});\nself.addEventListener('install'`,
    ),
);
