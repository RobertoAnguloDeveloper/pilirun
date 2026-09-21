// scripts/debug/inspect-sprite.cjs
// Dump actual pixel content of pili-run-0.webp
const sharp = require('sharp');
const path = require('path');

(async () => {
  const filePath = path.join(__dirname, '..', '..', 'public', 'assets', 'pili-run-0.webp');
  const img = sharp(filePath);
  const metadata = await img.metadata();
  console.log('Image metadata:', JSON.stringify(metadata, null, 2));

  // Get pixel data
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  console.log('Pixel info:', JSON.stringify(info, null, 2));

  const W = info.width;
  const H = info.height;
  // Find the dominant colors
  const colorMap = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      // Bin colors (reduce to nearest 16)
      const key = `${Math.floor(r / 16) * 16},${Math.floor(g / 16) * 16},${Math.floor(b / 16) * 16}`;
      if (a > 100) {
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }
    }
  }
  const sortedColors = [...colorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('Top 10 colors (binned):');
  for (const [c, count] of sortedColors) {
    console.log(`  rgb(${c}): ${count} px`);
  }

  // Save as PNG for visual inspection
  await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile('scripts/debug/pili-run-0-decoded.png');
  console.log('Saved decoded PNG');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
