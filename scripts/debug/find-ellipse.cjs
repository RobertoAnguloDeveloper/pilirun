// scripts/debug/find-ellipse.cjs
// Find all bright green pixels in the saved screenshot
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');
  await page.locator('text=JUGAR AHORA').click();
  await page.waitForTimeout(1500);
  await page.locator('text=Ráfaga de Fuego').click();
  await page.waitForTimeout(300);
  await page.locator('text=Comenzar Carrera').click();
  await page.waitForTimeout(2000);

  // Use getImageData on the actual canvas to find the green ellipse bounds
  // Then sample around its bounding box
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Bright vivid lime green matching #22c55e family
    const greens = [];
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Pure vivid green: g >> r AND g >> b
        if (g > 170 && g - r > 100 && g - b > 50 && r < 100) {
          greens.push({ x, y, r, g, b });
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      count: greens.length,
      bbox: { minX, minY, maxX, maxY },
      samples: greens.slice(0, 10),
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  });

  console.log('BRIGHT GREEN ELLIPSE:');
  console.log(JSON.stringify(info, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
