// scripts/debug/dom-debug.cjs
// Inspect DOM around the canvas
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

  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const rect = canvas.getBoundingClientRect();
    const parent = canvas.parentElement;
    const parentRect = parent.getBoundingClientRect();
    const parentStyles = getComputedStyle(parent);
    const canvasStyles = getComputedStyle(canvas);

    // Check if canvas size matches its drawing buffer size
    const dpr = window.devicePixelRatio;
    const bufferW = canvas.width;
    const bufferH = canvas.height;
    const displayW = rect.width;
    const displayH = rect.height;

    // Sample all canvases
    const allCanvases = Array.from(document.querySelectorAll('canvas')).map((c) => ({
      className: c.className,
      buffer: { w: c.width, h: c.height },
      display: { w: c.getBoundingClientRect().width, h: c.getBoundingClientRect().height },
    }));

    // Sample all green elements
    const allEls = Array.from(document.querySelectorAll('*'));
    const greenEls = allEls.filter((el) => {
      const s = getComputedStyle(el);
      const bg = s.backgroundColor;
      const c = s.color;
      return /22c55e|rgb\(34,\s*197,\s*94\)/.test(bg) || /22c55e|rgb\(34,\s*197,\s*94\)/.test(c);
    }).slice(0, 20).map((el) => ({
      tag: el.tagName,
      cls: el.className?.toString?.().slice(0, 100),
      bg: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
    }));

    return {
      dpr,
      canvas: {
        buffer: { w: bufferW, h: bufferH },
        display: { w: displayW, h: displayH },
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      },
      parent: {
        tag: parent.tagName,
        cls: parent.className?.toString?.().slice(0, 100),
        rect: { x: parentRect.x, y: parentRect.y, width: parentRect.width, height: parentRect.height },
        bg: parentStyles.backgroundColor,
        overflow: parentStyles.overflow,
        position: parentStyles.position,
      },
      canvasStyles: {
        bg: canvasStyles.backgroundColor,
        position: canvasStyles.position,
      },
      allCanvases,
      greenElements: greenEls,
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});