// scripts/debug/trace-arcs.cjs
// Trace arc calls to find what creates the green ellipse
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
  await page.waitForTimeout(2000);

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

    const events = [];
    let frames = 0;

    const origArc = ctx2d.arc.bind(ctx2d);
    const origEllipse = ctx2d.ellipse.bind(ctx2d);
    const origFill = ctx2d.fill.bind(ctx2d);
    const origDrawImage = ctx2d.drawImage.bind(ctx2d);

    function isBugColor(c) {
      return c && c.r < 60 && c.g > 170 && c.b > 70 && c.b < 130 && c.a > 0.5;
    }

    // Track last path command for fill context
    let lastPathCmd = null;
    let lastPathArgs = null;

    function checkFill(op) {
      const c = parseColor(ctx2d.fillStyle);
      if (isBugColor(c)) {
        const m = ctx2d.getTransform();
        events.push({
          frame: frames,
          op,
          fillStyle: ctx2d.fillStyle,
          transform: { x: m.e, y: m.f },
          lastPathCmd,
          lastPathArgs,
          fillRule: ctx2d.fillRule,
        });
      }
    }

    ctx2d.arc = function (...args) {
      lastPathCmd = 'arc';
      lastPathArgs = args.slice(0, 5);
      return origArc(...args);
    };
    ctx2d.ellipse = function (...args) {
      lastPathCmd = 'ellipse';
      lastPathArgs = args.slice(0, 7);
      return origEllipse(...args);
    };
    ctx2d.fill = function (...args) {
      checkFill('fill');
      return origFill(...args);
    };
    ctx2d.drawImage = function (img, ...rest) {
      const m = ctx2d.getTransform();
      if (m.e > 50 && m.e < 200 && m.f > 540 && m.f < 660) {
        events.push({
          frame: frames,
          op: 'drawImage',
          img: img?.src ?? '?',
          naturalW: img?.naturalWidth,
          naturalH: img?.naturalHeight,
          transform: { x: m.e, y: m.f },
          args: rest,
        });
      }
      return origDrawImage(img, ...rest);
    };

    return new Promise((res) => {
      function tick() {
        frames++;
        if (frames < 240) {
          requestAnimationFrame(tick);
        } else {
          res({ events, frameCount: frames });
        }
      }
      requestAnimationFrame(tick);
    });
  });

  console.log(`Frames: ${result.frameCount}, Events: ${result.events.length}`);
  console.log(JSON.stringify(result.events.slice(0, 30), null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});