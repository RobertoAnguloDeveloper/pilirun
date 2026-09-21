// scripts/debug/inspect-all-sprites.cjs
// Check ALL sprites for #22c55e green pixels
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');

  const spritePaths = [
      'obstacle-branch.webp', 'obstacle-log.webp', 'obstacle-rock.webp',
      'enemy-drone.webp', 'enemy-golem.webp', 'enemy-magma-fiend.webp',
      'environment-pine.webp', 'environment-oak.webp', 'environment-foliage.webp', 'environment-spire.webp',
      'character-sprite-1.webp', 'character-sprite-2.webp',
      'pili-idle-0.webp', 'pili-jump-0.webp', 'pili-jump-1.webp',
      'pili-slide-0.webp', 'pili-slide-1.webp',
      'pili-run-0.webp', 'pili-run-1.webp', 'pili-run-2.webp',
      'pili-run-3.webp', 'pili-run-4.webp', 'pili-run-5.webp',
      'copito-run-0.webp', 'mimi-run-0.webp', 'posho-run-0.webp', 'kuro-run-0.webp',
    ];

  const results = await page.evaluate(async (paths) => {
    function checkSrc(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = img.naturalWidth;
          cv.height = img.naturalHeight;
          const ctx = cv.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
          let greenCount = 0;
          let greenLikeCount = 0;
          let bbox = null;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (let y = 0; y < cv.height; y++) {
            for (let x = 0; x < cv.width; x++) {
              const i = (y * cv.width + x) * 4;
              const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
              if (a < 100) continue;
              if (r < 60 && g > 170 && b > 70 && b < 130) {
                greenCount++;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
              } else if (g > r + 20 && g > b + 20 && g > 100) {
                greenLikeCount++;
              }
            }
          }
          if (greenCount > 0) {
            bbox = { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
          }
          resolve({ src: src.split('/').pop(), w: cv.width, h: cv.height, greenCount, greenLikeCount, bbox });
        };
        img.onerror = () => resolve({ src: src.split('/').pop(), error: 'load failed' });
        img.src = src.startsWith('pili-') || src.startsWith('copito-') || src.startsWith('mimi-') || src.startsWith('posho-') || src.startsWith('kuro-') || src.startsWith('character-')
              ? `/assets/${src}`
              : `/assets/generated/${src}`;
      });
    }
    const out = [];
    for (const p of paths) {
      out.push(await checkSrc(p));
    }
    return out;
  }, spritePaths);

  console.log(JSON.stringify(results.filter(r => r.greenCount > 0 || r.greenLikeCount > 500 || r.error), null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});