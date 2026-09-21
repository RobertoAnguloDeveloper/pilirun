// scripts/debug/inspect-rabbit.cjs
// Sample colors throughout the pili sprite
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  const spriteColors = await page.evaluate(async () => {
    const img = new Image();
    img.src = '/assets/pili-run-0.webp';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    // Sample pixels at various positions
    const samples = {};
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    // Sample at strategic points
    const points = [
      ['top-left', 5, 5],
      ['top-center', Math.floor(W/2), 5],
      ['top-right', W-5, 5],
      ['center', Math.floor(W/2), Math.floor(H/2)],
      ['bottom-left', 5, H-5],
      ['bottom-center', Math.floor(W/2), H-5],
      ['bottom-right', W-5, H-5],
      ['left-middle', 5, Math.floor(H/2)],
      ['right-middle', W-5, Math.floor(H/2)],
      // Quarter points
      ['q1', Math.floor(W/4), Math.floor(H/4)],
      ['q2', Math.floor(3*W/4), Math.floor(H/4)],
      ['q3', Math.floor(W/4), Math.floor(3*H/4)],
      ['q4', Math.floor(3*W/4), Math.floor(3*H/4)],
    ];
    for (const [name, x, y] of points) {
      const data = ctx.getImageData(x, y, 1, 1).data;
      samples[name] = [data[0], data[1], data[2], data[3]];
    }

    // Find the brightest green pixels in the sprite (search for any)
    let greenCount = 0;
    let greenSample = null;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const data = ctx.getImageData(x, y, 1, 1).data;
        const r = data[0], g = data[1], b = data[2], a = data[3];
        if (g > 200 && g - r > 100 && g - b > 50 && a > 200) {
          greenCount++;
          if (!greenSample) greenSample = { x, y, rgba: [r, g, b, a] };
        }
      }
    }

    return { width: W, height: H, samples, greenCount, greenSample };
  });

  console.log(JSON.stringify(spriteColors, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
