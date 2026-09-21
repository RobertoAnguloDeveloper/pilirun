// scripts/debug/check-green-pixel.cjs
// Find where the green ellipse is being drawn — sample canvas at exact time
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');

  // Install hook AFTER the canvas appears
  page.on('console', (msg) => {
    console.log('BROWSER>', msg.text());
  });

  await page.locator('text=JUGAR AHORA').click();
  await page.waitForTimeout(1500);

  // Now the power select screen has canvas
  await page.waitForSelector('canvas.game-canvas', { timeout: 30000 });
  await page.locator('text=Ráfaga de Fuego').click();
  await page.waitForTimeout(300);

  // Install hooks ONCE game canvas is created
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    if (!canvas) { console.log('NO CANVAS'); return; }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let count = 0;
    const fillDesc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
    Object.defineProperty(ctx, 'fillStyle', {
      get: fillDesc.get,
      set(v) {
        if (typeof v === 'string') {
          const m = ctx.getTransform();
          // Log EVERY fill
          if (count < 200) {
            console.log(`[FILL #${count}] at (${m.e.toFixed(0)},${m.f.toFixed(0)}): ${v.substring(0, 80)}`);
          }
          count++;
        }
        fillDesc.set.call(this, v);
      },
    });
    // Hook drawImage
    const origDrawImage = ctx.drawImage.bind(ctx);
    let diCount = 0;
    ctx.drawImage = function(...args) {
      const img = args[0];
      if (img && img.src) {
        const m = ctx.getTransform();
        const sx = m.e, sy = m.f;
        // Log all boss-related draws
        if (img.src.includes('boss-')) {
          console.log(`[BOSS DRAW ${img.src.split('/').pop()} at (${sx.toFixed(0)},${sy.toFixed(0)}) w=${img.naturalWidth} h=${img.naturalHeight}]`);
        }
        if (img.naturalWidth > 50 && sx < 1000) {
          console.log(`[DRAWIMAGE ${img.src.split('/').pop()} at (${sx.toFixed(0)},${sy.toFixed(0)}) w=${img.naturalWidth} h=${img.naturalHeight} complete=${img.complete}]`);
          diCount++;
        }
      }
      return origDrawImage(...args);
    };
    console.log('Hooks installed');
  });
  await page.waitForTimeout(500);

  await page.locator('text=Comenzar Carrera').click();
  await page.waitForTimeout(2000);

  // Sample the actual pixel at the green ellipse center
  const px = await page.evaluate(() => {
    const samples = { canvases: [] };
    const canvases = document.querySelectorAll('canvas');
    for (const canvas of canvases) {
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        const w = canvas.width;
        const h = canvas.height;
        // Sample 5 pixels around (130, 605)
        const points = {};
        for (const [name, x, y] of [
          ['center', 130, 605],
          ['left', 100, 605],
          ['right', 160, 605],
          ['top', 130, 580],
          ['bottom', 130, 625],
        ]) {
          if (x < w && y < h) {
            const data = ctx.getImageData(x, y, 1, 1).data;
            points[name] = [data[0], data[1], data[2], data[3]];
          }
        }
        samples.canvases.push({
          className: canvas.className,
          width: w,
          height: h,
          points,
        });
      } catch (e) {
        samples.canvases.push({ className: canvas.className, error: e.message });
      }
    }
    return samples;
  });
  console.log('Pixel samples around green ellipse center:');
  console.log(JSON.stringify(px, null, 2));

  // Sample the actual image colors of pili-run-0.webp and boss-treant.webp
  const spriteColors = await page.evaluate(async () => {
    const result = {};
    for (const url of ['/assets/pili-run-0.webp', '/assets/generated/boss-treant.webp', '/assets/generated/boss-treant-idle-0.webp']) {
      try {
        const img = new Image();
        img.src = url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        // Check center pixel
        const cx = Math.floor(img.naturalWidth / 2);
        const cy = Math.floor(img.naturalHeight / 2);
        const data = ctx.getImageData(cx, cy, 1, 1).data;
        result[url] = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          centerPixel: [data[0], data[1], data[2], data[3]],
        };
      } catch (e) {
        result[url] = { error: e.message };
      }
    }
    return result;
  });
  console.log('Sprite colors:');
  console.log(JSON.stringify(spriteColors, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
