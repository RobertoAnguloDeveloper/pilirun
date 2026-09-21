// scripts/debug/find-green-sprites.cjs
// Scan ALL sprites for #22c55e pixels
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  // Get all sprite URLs from generated and assets folders
  const dirs = [
    'public/assets/generated',
    'public/assets',
  ];
  const urls = [];
  for (const dir of dirs) {
    const fullDir = path.join('F:', 'ROCATECH Projects', 'VIDEOGAMES', 'PiliRun', dir);
    if (fs.existsSync(fullDir)) {
      for (const f of fs.readdirSync(fullDir)) {
        if (f.endsWith('.webp') || f.endsWith('.png')) {
          urls.push('/' + path.join('assets', path.basename(dir), f).replace(/\\/g, '/'));
          // For generated folder, structure differently
          if (dir.includes('generated')) {
            urls.push('/assets/generated/' + f);
          }
        }
      }
    }
  }

  const greenSprites = await page.evaluate(async (urls) => {
    const results = [];
    for (const url of urls) {
      try {
        const img = new Image();
        img.src = url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => resolve(); // skip on error
        });
        if (!img.complete || !img.naturalWidth) continue;
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        let greenCount = 0;
        let greenCenterCount = 0;
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const cx = Math.floor(W / 2);
        const cy = Math.floor(H / 2);
        const r = 30;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const data = ctx.getImageData(x, y, 1, 1).data;
            const rr = data[0], g = data[1], bb = data[2], a = data[3];
            if (rr < 50 && g > 170 && g < 210 && bb > 70 && bb < 110 && a > 200) {
              greenCount++;
              const dx = x - cx, dy = y - cy;
              if (dx*dx + dy*dy < r*r) greenCenterCount++;
            }
          }
        }
        if (greenCount > 50) {
          results.push({ url, width: W, height: H, greenCount, greenCenterCount });
        }
      } catch (e) {}
    }
    return results.sort((a, b) => b.greenCount - a.greenCount);
  }, urls);

  console.log(JSON.stringify(greenSprites, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
