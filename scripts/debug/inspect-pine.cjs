// scripts/debug/inspect-pine.cjs
// Check if the pine sprite has #22c55e pixels
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');

  const result = await page.evaluate(async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/assets/generated/environment-pine.webp';
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

    // Count green pixels similar to #22c55e
    let greenCount = 0;
    let greenBounds = null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const sample = [];

    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (r < 60 && g > 170 && b < 70 && a > 200) {
          greenCount++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (sample.length < 10) sample.push({ x, y, rgba: [r, g, b, a] });
        }
      }
    }

    if (greenCount > 0) {
      greenBounds = {
        minX, minY, maxX, maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        totalPixels: greenCount,
        totalSpritePixels: cv.width * cv.height,
        pctOfSprite: (greenCount / (cv.width * cv.height) * 100).toFixed(2) + '%',
      };
    }

    return {
      size: { w: cv.width, h: cv.height },
      greenCount,
      greenBounds,
      sample,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});