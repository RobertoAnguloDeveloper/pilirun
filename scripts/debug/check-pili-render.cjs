// Quick debug script to check the actual rendered canvas state of the running game
// Usage: not really for CLI use, this is to be invoked manually
const fs = require('fs');
const path = require('path');

const assetPath = path.join(__dirname, '..', 'public', 'assets', 'pili-run-0.webp');
const stat = fs.statSync(assetPath);
console.log('pili-run-0.webp size:', stat.size, 'bytes');

// Use Node's WebP support if available, otherwise read the first few bytes
const header = fs.readFileSync(assetPath).slice(0, 16);
console.log('Header:', header.toString('hex'));

// Read all 6 run frames
for (let i = 0; i < 6; i++) {
  const p = path.join(__dirname, '..', 'public', 'assets', `pili-run-${i}.webp`);
  const s = fs.statSync(p);
  console.log(`pili-run-${i}.webp: ${s.size} bytes`);
}
