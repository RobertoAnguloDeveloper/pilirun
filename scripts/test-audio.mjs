import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { execSync } from 'node:child_process';
import { statSync, unlinkSync, existsSync } from 'node:fs';

const input = 'assets/bmg/A_Window_Facing_West.mp3';
const outOpus = 'assets/bmg/test.opus';
const outM4a = 'assets/bmg/test.m4a';
const outMp3 = 'assets/bmg/test.mp3';

console.log('Original size:', statSync(input).size);

try {
  execSync(`"${ffmpeg.path}" -y -i "${input}" -c:a libopus -b:a 64k -vbr on "${outOpus}"`, { stdio: 'inherit' });
  console.log('Opus 64k size:', statSync(outOpus).size);
} catch (e) {
  console.log('Opus error:', e.message);
}

try {
  execSync(`"${ffmpeg.path}" -y -i "${input}" -c:a aac -b:a 64k "${outM4a}"`, { stdio: 'inherit' });
  console.log('AAC 64k size:', statSync(outM4a).size);
} catch (e) {
  console.log('AAC error:', e.message);
}

try {
  execSync(`"${ffmpeg.path}" -y -i "${input}" -c:a libmp3lame -b:a 80k -joint_stereo 1 "${outMp3}"`, { stdio: 'inherit' });
  console.log('MP3 80k size:', statSync(outMp3).size);
} catch (e) {
  console.log('MP3 error:', e.message);
}

for (const f of [outOpus, outM4a, outMp3]) {
  if (existsSync(f)) unlinkSync(f);
}
