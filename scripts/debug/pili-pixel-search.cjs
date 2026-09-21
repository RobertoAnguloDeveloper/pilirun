// scripts/debug/pili-pixel-search.cjs
// Search pili sprite for ANY green pixels (not just #22c55e)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  const spriteColors = await page.evaluate(async () => {
    const results = {};
    for (const url of ['/assets/pili-run-0.webp', '/assets/pili-run-1.webp', '/assets/pili-idle-0.webp', '/assets/pili-jump-0.webp']) {
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
        const cctx = c.getContext('2d', { willReadFrequently: true });
        cctx.drawImage(img, 0, 0);

        // Find all green pixels (G dominant)
        const greens = [];
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const data = cctx.getImageData(x, y, 1, 1).data;
            const r = data[0], g = data[1], b = data[2], a = data[3];
            if (g > 100 && g - r > 30 && g - b > 30 && a > 200) {
              greens.push({ x, y, rgba: [r, g, b, a] });
            }
          }
        }
        results[url] = { width: W, height: H, greenCount: greens.length, sample: greens.slice(0, 5) };
      } catch (e) {
        results[url] = { error: e.message };
      }
    }
    return results;
  });

  console.log(JSON.stringify(spriteColors, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
