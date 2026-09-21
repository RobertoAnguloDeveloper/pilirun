// scripts/debug/inspect-pili.cjs
// Check pili-run sprite for green content
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');

  for (let i = 0; i <= 5; i++) {
    const result = await page.evaluate(async (idx) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `/assets/pili-run-${idx}.webp`;
      await new Promise((r) => {
        if (img.complete) r();
        else img.onload = r;
      });
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;

      let greenCount = 0;
      let greenLikeCount = 0;
      let bbox = null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const colors = new Map();

      for (let y = 0; y < cv.height; y++) {
        for (let x = 0; x < cv.width; x++) {
          const p = (y * cv.width + x) * 4;
          const r = data[p], gg = data[p + 1], b = data[p + 2], a = data[p + 3];
          if (a < 100) continue;
          // Key color key
          const key = `${Math.round(r / 32) * 32},${Math.round(gg / 32) * 32},${Math.round(b / 32) * 32}`;
          colors.set(key, (colors.get(key) || 0) + 1);
          if (r < 60 && gg > 170 && b > 70 && b < 130) {
            greenCount++;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          } else if (gg > r && gg > b) {
            greenLikeCount++;
          }
        }
      }
      if (greenCount > 0) {
        bbox = { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
      }
      const topColors = Array.from(colors.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      return {
        size: { w: cv.width, h: cv.height },
        greenCount,
        greenLikeCount,
        bbox,
        topColors,
      };
    }, i);

    console.log(`pili-run-${i}.webp:`, JSON.stringify(result, null, 2));
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});