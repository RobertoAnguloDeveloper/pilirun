// scripts/debug/inspect-boss-sprites.cjs
// Sample colors of boss sprites to find green pixels
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  const spriteColors = await page.evaluate(async () => {
    const urls = [
      '/assets/generated/boss-treant-idle-0.webp',
      '/assets/generated/boss-treant-attack-1.webp',
      '/assets/generated/boss-treant-hurt-2.webp',
      '/assets/generated/boss-sphinx-idle-0.webp',
      '/assets/generated/boss-void-dragon-idle-0.webp',
      '/assets/generated/boss-cyber-titan-idle-0.webp',
      '/assets/generated/boss-frost-behemoth-idle-0.webp',
      '/assets/generated/boss-magma-dragon-idle-0.webp',
    ];
    const results = {};
    for (const url of urls) {
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
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        let greenPixels = 0;
        let greenSample = null;
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        for (let y = 0; y < H; y += 2) {
          for (let x = 0; x < W; x += 2) {
            const data = ctx.getImageData(x, y, 1, 1).data;
            const r = data[0], g = data[1], b = data[2], a = data[3];
            // Match exact #22c55e
            if (r < 50 && g > 170 && g < 210 && b > 70 && b < 110 && a > 200) {
              greenPixels++;
              if (!greenSample) greenSample = { x, y, rgba: [r, g, b, a] };
            }
          }
        }
        results[url] = {
          width: W,
          height: H,
          greenPixels,
          greenSample,
        };
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
