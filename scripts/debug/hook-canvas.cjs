// scripts/debug/hook-canvas.cjs
// Hook ALL Canvas API methods to trace EXACTLY what draws #22c55e at player position
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'log') console.log(`[BROWSER]`, msg.text());
  });
  page.on('pageerror', (err) => console.log(`[PAGE ERROR]`, err.message));

  await page.goto('http://localhost:3000');
  await page.locator('text=JUGAR AHORA').click();
  await page.waitForTimeout(1500);
  await page.locator('text=Ráfaga de Fuego').click();
  await page.waitForTimeout(300);
  await page.locator('text=Comenzar Carrera').click();
  await page.waitForTimeout(2500);

  // Inject hooks into canvas context AFTER game starts
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    if (!canvas) return { error: 'no canvas' };
    const ctx2d = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx2d) return { error: 'no 2d ctx' };

    const fills = [];
    const draws = [];

    // Wrap fillRect, fill, and drawImage
    const origFillRect = ctx2d.fillRect.bind(ctx2d);
    const origFill = ctx2d.fill.bind(ctx2d);
    const origDrawImage = ctx2d.drawImage.bind(ctx2d);

    ctx2d.fillRect = function (x, y, w, h) {
      const fs = this.fillStyle;
      // Parse color string to RGB
      let r = 0, g = 0, b = 0, a = 1;
      const m = String(fs).match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
        r = parts[0]; g = parts[1]; b = parts[2]; a = parts[3] ?? 1;
      }
      // Check if it would touch the green ellipse region (90-163 x, 571-636 y)
      if (r < 80 && g > 150 && b < 130 && a > 0.5) {
        fills.push({ op: 'fillRect', x, y, w, h, color: fs });
      }
      return origFillRect(x, y, w, h);
    };

    ctx2d.fill = function (...args) {
      const fs = this.fillStyle;
      let r = 0, g = 0, b = 0, a = 1;
      const m = String(fs).match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
        r = parts[0]; g = parts[1]; b = parts[2]; a = parts[3] ?? 1;
      }
      // Get current transform to know where we are
      const m0 = this.getTransform();
      const px = m0.e, py = m0.f;
      if (r < 80 && g > 150 && b < 130 && a > 0.5) {
        if (px > 80 && px < 170 && py > 560 && py < 640) {
          fills.push({ op: 'fill', transform: { x: px, y: py }, color: fs });
        }
      }
      return origFill(...args);
    };

    ctx2d.drawImage = function (img, x, y, w, h) {
      const m0 = this.getTransform();
      const px = m0.e, py = m0.f;
      // Log when drawImage is called near player region
      if (px > 80 && px < 170 && py > 560 && py < 640) {
        draws.push({
          op: 'drawImage',
          x, y, w, h,
          img: img?.src ?? img?.currentSrc ?? 'unknown',
          transform: { x: px, y: py },
          complete: img?.complete,
          naturalWidth: img?.naturalWidth,
          naturalHeight: img?.naturalHeight,
        });
      }
      return origDrawImage(img, x, y, w, h);
    };

    // Wait one frame and capture
    return new Promise((res) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          res({
            canvasSize: { width: canvas.width, height: canvas.height },
            fillsCount: fills.length,
            drawsCount: draws.length,
            fills: fills.slice(0, 30),
            draws: draws.slice(0, 30),
          });
        });
      });
    });
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});