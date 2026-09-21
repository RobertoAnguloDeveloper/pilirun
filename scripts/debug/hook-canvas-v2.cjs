// scripts/debug/hook-canvas-v2.cjs
// Better hook: parse hex colors, hook arc/ellipse, capture multiple frames
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  page.on('pageerror', (err) => console.log(`[PAGE ERROR]`, err.message));

  await page.goto('http://localhost:3000');
  await page.locator('text=JUGAR AHORA').click();
  await page.waitForTimeout(1500);
  await page.locator('text=Ráfaga de Fuego').click();
  await page.waitForTimeout(300);
  await page.locator('text=Comenzar Carrera').click();
  await page.waitForTimeout(2500);

  const result = await page.evaluate(() => {
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
    function isGreenish(c) {
      if (!c) return false;
      return c.r < 80 && c.g > 150 && c.b < 130 && c.a > 0.5;
    }

    const canvas = document.querySelector('canvas.game-canvas');
    const ctx2d = canvas.getContext('2d', { willReadFrequently: true });

    const events = [];
    let frameIdx = 0;

    function pushOp(op, extra) {
      const c = parseColor(ctx2d.fillStyle);
      const sc = parseColor(ctx2d.strokeStyle);
      if (isGreenish(c) || isGreenish(sc)) {
        const m = ctx2d.getTransform();
        events.push({
          frame: frameIdx,
          op,
          fillStyle: ctx2d.fillStyle,
          strokeStyle: ctx2d.strokeStyle,
          transform: { x: m.e, y: m.f },
          globalAlpha: ctx2d.globalAlpha,
          ...extra,
        });
      }
    }

    const origFill = ctx2d.fill.bind(ctx2d);
    const origFillRect = ctx2d.fillRect.bind(ctx2d);
    const origStroke = ctx2d.stroke.bind(ctx2d);
    const origDrawImage = ctx2d.drawImage.bind(ctx2d);
    const origRoundRect = ctx2d.roundRect?.bind(ctx2d);
    const origArc = ctx2d.arc.bind(ctx2d);
    const origEllipse = ctx2d.ellipse.bind(ctx2d);
    const origFillText = ctx2d.fillText.bind(ctx2d);

    ctx2d.fill = function (...args) {
      pushOp('fill');
      return origFill(...args);
    };
    ctx2d.fillRect = function (x, y, w, h) {
      pushOp('fillRect', { x, y, w, h });
      return origFillRect(x, y, w, h);
    };
    ctx2d.stroke = function () {
      pushOp('stroke');
      return origStroke();
    };
    ctx2d.fillText = function (text, x, y) {
      pushOp('fillText', { text, x, y });
      return origFillText(text, x, y);
    };
    if (origRoundRect) {
      ctx2d.roundRect = function (...args) {
        pushOp('roundRect', { args });
        return origRoundRect(...args);
      };
    }
    ctx2d.arc = function (x, y, r2, sA, eA, ccw) {
      pushOp('arc-set', { x, y, r: r2 });
      return origArc(x, y, r2, sA, eA, ccw);
    };
    ctx2d.ellipse = function (x, y, rx, ry, rot, sA, eA, ccw) {
      pushOp('ellipse-set', { x, y, rx, ry });
      return origEllipse(x, y, rx, ry, rot, sA, eA, ccw);
    };
    ctx2d.drawImage = function (img, ...rest) {
      const m = ctx2d.getTransform();
      if (m.e > 80 && m.e < 170 && m.f > 560 && m.f < 640) {
        events.push({
          frame: frameIdx,
          op: 'drawImage',
          img: img?.src ?? 'unknown',
          naturalW: img?.naturalWidth,
          naturalH: img?.naturalHeight,
          transform: { x: m.e, y: m.f },
          args: rest,
        });
      }
      return origDrawImage(img, ...rest);
    };

    return new Promise((res2) => {
      let frames = 0;
      function tick() {
        frameIdx = frames;
        frames++;
        if (frames < 20) {
          requestAnimationFrame(tick);
        } else {
          res2({
            canvasSize: { w: canvas.width, h: canvas.height },
            eventCount: events.length,
            events: events.slice(0, 100),
          });
        }
      }
      requestAnimationFrame(tick);
    });
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});