// scripts/debug/inspect-golem.cjs
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  const spriteColors = await page.evaluate(async () => {
    const img = new Image();
    img.src = '/assets/generated/enemy-golem.webp';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    let greenPixels = 0;
    let greenSample = null;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const data = ctx.getImageData(x, y, 1, 1).data;
        const r = data[0], g = data[1], b = data[2], a = data[3];
        // Match #22c55e
        if (r < 50 && g > 170 && g < 210 && b > 70 && b < 110 && a > 200) {
          greenPixels++;
          if (!greenSample) greenSample = { x, y, rgba: [r, g, b, a] };
        }
      }
    }
    return { width: W, height: H, greenPixels, greenSample };
  });

  console.log(JSON.stringify(spriteColors, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
