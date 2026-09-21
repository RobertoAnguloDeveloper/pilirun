// scripts/debug/crop-bigger.cjs
// Get a high-res crop of just the green ellipse area
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

  await page.screenshot({ path: 'scripts/debug/green-ellipse.png', clip: { x: 30, y: 540, width: 280, height: 200 } });
  console.log('Saved cropped green-ellipse.png');

  // Also get canvas pixel data
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // Sample pixels around the ellipse to see colors
    const samples = [];
    const cx = 130, cy = 605;
    for (let r = 0; r < 50; r += 3) {
      for (let theta = 0; theta < Math.PI * 2; theta += Math.PI / 8) {
        const x = Math.round(cx + r * Math.cos(theta));
        const y = Math.round(cy + r * 0.8 * Math.sin(theta));
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
        const data = ctx.getImageData(x, y, 1, 1).data;
        samples.push({ x, y, r, theta: Math.round(theta * 10) / 10, rgba: [data[0], data[1], data[2], data[3]] });
      }
    }
    return samples;
  });
  console.log(JSON.stringify(info.slice(0, 40), null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
