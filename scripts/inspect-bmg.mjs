import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';

const files = readdirSync('assets/bmg').filter((f) => f.endsWith('.mp3'));
let totalBytes = 0;
for (const file of files) {
  const fullPath = `assets/bmg/${file}`;
  const size = statSync(fullPath).size;
  totalBytes += size;
  let dur = 'unknown';
  try {
    execSync(`"${ffmpeg.path}" -i "${fullPath}"`, { stdio: 'pipe' });
  } catch (err) {
    const output = (err.stderr || err.stdout || '').toString();
    const m = output.match(/Duration:\s*(\d+:\d+:[\d.]+)/);
    if (m) dur = m[1];
  }
  console.log(`${file.padEnd(38)} | ${(size / 1024 / 1024).toFixed(2)} MB | ${dur}`);
}
console.log(`Total MP3 Size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
