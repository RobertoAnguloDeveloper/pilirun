// scripts/debug/dump-engine.cjs
// Dump the engine's simulation state
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => console.log(`[BROWSER]`, msg.text()));

  await page.goto('http://localhost:3000');
  await page.locator('text=JUGAR AHORA').click();
  await page.waitForTimeout(1500);
  await page.locator('text=Ráfaga de Fuego').click();
  await page.waitForTimeout(300);
  await page.locator('text=Comenzar Carrera').click();
  await page.waitForTimeout(2000);

  // Hook into the canvas to log drawing context
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // Track gradient color stops by patching createRadialGradient
    const origCreate = ctx.createRadialGradient.bind(ctx);
    const gradientLog = [];
    ctx.createRadialGradient = function(x0, y0, r0, x1, y1, r1) {
      const grad = origCreate(x0, y0, r0, x1, y1, r1);
      const origAddStop = grad.addColorStop.bind(grad);
      const stops = [];
      grad.addColorStop = function(offset, color) {
        stops.push({ offset, color });
        return origAddStop(offset, color);
      };
      grad._stops = stops;
      gradientLog.push(grad);
      return grad;
    };

    // Wrap arc() to log when 30-45 radius circles are drawn at player position
    const origArc = ctx.arc.bind(ctx);
    ctx.arc = function(x, y, radius, ...rest) {
      if (radius > 30 && radius < 45) {
        const m = ctx.getTransform();
        const screenX = m.a * x + m.c * y + m.e;
        const screenY = m.b * x + m.d * y + m.f;
        // If we're at the player position and there's a recent gradient
        if (screenX < 200 && screenY > 500) {
          const recentGrad = gradientLog[gradientLog.length - 1];
          console.log(`[PLAYER ARC r=${radius.toFixed(1)}] screen=(${screenX.toFixed(1)},${screenY.toFixed(1)}) stops=${JSON.stringify(recentGrad?._stops)}`);
        }
      }
      return origArc(x, y, radius, ...rest);
    };
  });
  await page.waitForTimeout(2000);

  // Save screenshot
  await page.screenshot({ path: 'scripts/debug/green-ellipse-final.png', clip: { x: 30, y: 540, width: 280, height: 200 } });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
