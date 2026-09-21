// scripts/debug/final-screenshot.cjs
// Take a final screenshot and crop the green ellipse area
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

  // Hook fillStyle with full logging
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let count = 0;
    const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
    Object.defineProperty(ctx, 'fillStyle', {
      get: desc.get,
      set(v) {
        if (typeof v === 'string' && v === '#22c55e') {
          const m = ctx.getTransform();
          console.log(`[22C55E FILL] transform=(${m.a.toFixed(2)},${m.b.toFixed(2)},${m.c.toFixed(2)},${m.d.toFixed(2)},${m.e.toFixed(2)},${m.f.toFixed(2)}) stack=${new Error().stack.split('\n').slice(2, 6).join(' / ')}`);
        }
        desc.set.call(this, v);
      },
    });
  });
  await page.waitForTimeout(500);

  await page.locator('text=Comenzar Carrera').click();
  await page.waitForTimeout(2500);

  // Take a high-res screenshot of the player area
  await page.screenshot({ path: 'scripts/debug/player-area-final.png', clip: { x: 30, y: 540, width: 280, height: 200 } });
  console.log('Saved player-area-final.png');

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
