// scripts/debug/visualize-green.cjs
// Save a visualization of just the bright green pixels in the canvas
const { chromium } = require('playwright');

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

  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Replace all non-green pixels with transparent to visualize
    const out = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r < 60 && g > 170 && g - r > 100 && b > 70 && b < 130) {
          out.data[i] = r;
          out.data[i + 1] = g;
          out.data[i + 2] = b;
          out.data[i + 3] = 255;
        } else {
          out.data[i + 3] = 0;
        }
      }
    }

    // Save to overlay canvas
    const overlay = document.createElement('canvas');
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.zIndex = '9999';
    overlay.style.pointerEvents = 'none';
    overlay.getContext('2d').putImageData(out, 0, 0);
    document.body.appendChild(overlay);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scripts/debug/green-only.png' });
  console.log('Saved green-only.png');

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
