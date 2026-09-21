// scripts/debug/trace-fillStyle.cjs
// Trace where #22c55e fillStyle is set in the renderer
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => console.log(`[${msg.type()}]`, msg.text()));

  await page.goto('http://localhost:3000');
  await page.locator('text=JUGAR AHORA').click();
  await page.waitForTimeout(1500);
  await page.locator('text=Ráfaga de Fuego').click();
  await page.waitForTimeout(300);
  await page.locator('text=Comenzar Carrera').click();
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const ctx2d = canvas.getContext('2d');

    // Hook the setter for fillStyle
    const proto = Object.getPrototypeOf(ctx2d);
    const desc = Object.getOwnPropertyDescriptor(proto, 'fillStyle');
    if (!desc || !desc.set) {
      console.log('No setter for fillStyle found');
      return;
    }
    const origSet = desc.set;
    Object.defineProperty(proto, 'fillStyle', {
      get() { return desc.get.call(this); },
      set(v) {
        if (v === '#22c55e' || (typeof v === 'string' && v.includes('22c55e'))) {
          const m = this.getTransform();
          const stack = new Error().stack;
          console.log(`#22c55e set at canvas (${m.e.toFixed(1)}, ${m.f.toFixed(1)}), stack: ${stack.split('\n').slice(2, 5).join(' | ')}`);
        }
        origSet.call(this, v);
      },
      configurable: true,
    });
  });

  await page.waitForTimeout(5000);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});