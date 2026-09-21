// scripts/debug/fresh-screenshot.cjs
// Take fresh screenshot to see current bug state
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
  await page.waitForTimeout(2500);

  // Full page screenshot (will include UI overlays)
  await page.screenshot({ path: 'scripts/debug/FULL-PAGE-NOW.png', fullPage: false });

  // Just the canvas
  const canvas = await page.locator('canvas.game-canvas');
  await canvas.screenshot({ path: 'scripts/debug/CANVAS-ONLY-NOW.png' });

  // Just the player region
  await canvas.screenshot({
    path: 'scripts/debug/PLAYER-CROP-NOW.png',
    clip: { x: 60, y: 540, width: 180, height: 130 },
  });

  console.log('Screenshots saved');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});