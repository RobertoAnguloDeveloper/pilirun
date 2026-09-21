// scripts/debug/check-dpr.cjs
// Check device pixel ratio and canvas size
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');

  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    if (!canvas) return { error: 'no canvas' };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    return {
      dpr,
      canvasAttrWidth: canvas.width,
      canvasAttrHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      // Check what device pixel ratio is reported
    };
  });

  console.log(JSON.stringify(info, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
