// scripts/debug/hide-canvas.cjs
// Hide the canvas and screenshot to see what's behind
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

  // Hide the canvas
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    canvas.style.display = 'none';
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'scripts/debug/no-canvas.png', clip: { x: 0, y: 540, width: 600, height: 260 } });
  console.log('Saved no-canvas.png');

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
