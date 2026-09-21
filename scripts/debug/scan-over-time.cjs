// scripts/debug/scan-over-time.cjs
// Scan the canvas at multiple time points to find when green appears
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');
  await page.locator('text=JUGAR AHORA').click();
  await page.waitForTimeout(1500);
  await page.locator('text=Ráfaga de Fuego').click();
  await page.waitForTimeout(300);
  await page.locator('text=Comenzar Carrera').click();

  // Sample at multiple time points
  for (let t = 500; t <= 5000; t += 250) {
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.game-canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (r < 60 && g > 170 && b > 70 && b < 130 && a > 200) {
            count++;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      return { count, minX, minY, maxX, maxY };
    });
    console.log(`t=${t}ms: count=${r.count}, bounds=(${r.minX},${r.minY})-(${r.maxX},${r.maxY})`);
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});