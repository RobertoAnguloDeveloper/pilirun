// scripts/debug/hook-canvas-time.cjs
// Hook canvas continuously and save all green-related operations
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

  const events = await page.evaluate(async () => {
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
    const ctx2d = canvas.getContext('2d', { willReadFrequently: true });

    const matches = [];
    let frames = 0;
    const origFill = ctx2d.fill.bind(ctx2d);
    const origFillRect = ctx2d.fillRect.bind(ctx2d);
    const origRoundRect = ctx2d.roundRect?.bind(ctx2d);

    function check(op, extra) {
      const c = parseColor(ctx2d.fillStyle);
      if (c && c.r < 60 && c.g > 170 && c.b > 70 && c.b < 130 && c.a > 0.5) {
        const m = ctx2d.getTransform();
        // Only log if near player area
        if (m.e > 50 && m.e < 200 && m.f > 540 && m.f < 660) {
          matches.push({
            frame: frames,
            op,
            fillStyle: ctx2d.fillStyle,
            transform: { x: m.e, y: m.f },
            ...extra,
          });
        }
      }
    }

    ctx2d.fill = function (...args) {
      check('fill');
      return origFill(...args);
    };
    ctx2d.fillRect = function (x, y, w, h) {
      check('fillRect', { x, y, w, h });
      return origFillRect(x, y, w, h);
    };
    if (origRoundRect) {
      ctx2d.roundRect = function (...args) {
        check('roundRect', { args });
        return origRoundRect(...args);
      };
    }

    return new Promise((res) => {
      function tick() {
        frames++;
        if (frames < 240) {
          requestAnimationFrame(tick);
        } else {
          res(matches);
        }
      }
      requestAnimationFrame(tick);
    });
  });

  console.log('Green ops near player:', events.length);
  console.log(JSON.stringify(events.slice(0, 30), null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});