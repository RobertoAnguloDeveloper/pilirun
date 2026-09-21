// scripts/debug/pause-and-check.cjs
// Pause the game using window.requestAnimationFrame = () => 0, then verify pixels
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

  // Wait until we're sure the bug is showing
  await page.waitForTimeout(2000);

  // Now PAUSE the game by overriding requestAnimationFrame
  await page.evaluate(() => {
    window.__origRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => 0; // no more frames
  });

  // Wait a moment for things to settle
  await page.waitForTimeout(200);

  // Now check pixels - they should be frozen
  const result = await page.evaluate(() => {
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

  console.log('After pause:', JSON.stringify(result, null, 2));

  // Save canvas state as PNG for inspection
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    return canvas.toDataURL('image/png');
  });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  require('fs').writeFileSync('F:\\ROCATECH Projects\\VIDEOGAMES\\PiliRun\\scripts\\debug\\paused-state.png', Buffer.from(base64, 'base64'));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});