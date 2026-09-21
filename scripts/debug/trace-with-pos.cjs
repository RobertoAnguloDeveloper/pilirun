// scripts/debug/trace-with-pos.cjs
// Trace fillStyle setter with stack info AND log all #22c55e operations with their position
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
  await page.waitForTimeout(500);

  // Capture frame at t=1500ms and trace
  const result = await page.evaluate(async () => {
    function parseColor(str) {
      if (!str) return null;
      const s = String(str).trim();
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(',').map((x) => parseFloat(x.trim()));
        return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
      }
      const hex = s.match(/^#([0-9a-f]{3,8})$/i);
      if (hex) {
        const h = hex[1];
        if (h.length === 6) {
          return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
        }
        if (h.length === 3) {
          return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
        }
      }
      return null;
    }

    const canvas = document.querySelector('canvas.game-canvas');
    const ctx2d = canvas.getContext('2d');

    // Hook fill operations that would touch canvas (87-171, 564-643)
    const origFill = ctx2d.fill.bind(ctx2d);
    const origFillRect = ctx2d.fillRect.bind(ctx2d);
    const origRoundRect = ctx2d.roundRect?.bind(ctx2d);
    const origDrawImage = ctx2d.drawImage.bind(ctx2d);

    const hits = [];
    ctx2d.fill = function (...args) {
      const c = parseColor(ctx2d.fillStyle);
      const m = ctx2d.getTransform();
      // Check if THIS fill would paint at canvas (87-171, 564-643)
      // For roundRect the path is set already, but we can check transform
      if (c && c.r < 60 && c.g > 170 && c.b > 70 && c.b < 130 && c.a > 0.5) {
        if (m.e > 60 && m.e < 200 && m.f > 540 && m.f < 660) {
          hits.push({ op: 'fill', t: { x: m.e, y: m.f }, color: ctx2d.fillStyle });
        }
      }
      return origFill(...args);
    };
    ctx2d.fillRect = function (x, y, w, h) {
      const c = parseColor(ctx2d.fillStyle);
      if (c && c.r < 60 && c.g > 170 && c.b > 70 && c.b < 130 && c.a > 0.5) {
        const m = ctx2d.getTransform();
        const absX = m.e + x;
        const absY = m.f + y;
        if (absX + w > 60 && absX < 200 && absY + h > 540 && absY < 660) {
          hits.push({ op: 'fillRect', t: { x: m.e, y: m.f }, args: { x, y, w, h }, abs: { x: absX, y: absY }, color: ctx2d.fillStyle });
        }
      }
      return origFillRect(x, y, w, h);
    };
    if (origRoundRect) {
      ctx2d.roundRect = function (...args) {
        const c = parseColor(ctx2d.fillStyle);
        if (c && c.r < 60 && c.g > 170 && c.b > 70 && c.b < 130 && c.a > 0.5) {
          const m = ctx2d.getTransform();
          const [x, y, w, h] = args;
          const absX = m.e + x;
          const absY = m.f + y;
          if (absX + w > 60 && absX < 200 && absY + h > 540 && absY < 660) {
            hits.push({ op: 'roundRect', t: { x: m.e, y: m.f }, args, abs: { x: absX, y: absY }, color: ctx2d.fillStyle });
          }
        }
        return origRoundRect(...args);
      };
    }

    return new Promise((res) => {
      let frames = 0;
      function tick() {
        frames++;
        if (frames < 240) {
          requestAnimationFrame(tick);
        } else {
          res({ hits, frameCount: frames });
        }
      }
      requestAnimationFrame(tick);
    });
  });

  console.log(`Frames: ${result.frameCount}, Hits: ${result.hits.length}`);
  console.log(JSON.stringify(result.hits, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});