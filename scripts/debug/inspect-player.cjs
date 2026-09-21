// scripts/debug/inspect-player.cjs
// Quick debug: open game, navigate to canvas, sample pixels at player position
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', (m) => console.log('PAGE>', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('PAGE ERR>', e.message));

  await page.goto('http://localhost:3000');
  // Click JUGAR AHORA
  await page.locator('text=JUGAR AHORA').click();
  await page.waitForTimeout(1500);
  // Click power "Ráfaga de Fuego"
  await page.locator('text=Ráfaga de Fuego').click();
  await page.waitForTimeout(300);
  // Click Comenzar Carrera
  await page.locator('text=Comenzar Carrera').click();
  await page.waitForTimeout(2000);

  // Take screenshot during play (no pause)
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'scripts/debug/player-play.png' });
  console.log('Play screenshot saved.');

  // Pause the game so we can sample a stable frame
  await page.keyboard.press('p');
  await page.waitForTimeout(500);

  // Sample pixels at the player position (lower-left)
  await page.screenshot({ path: 'scripts/debug/player-sample.png' });
  console.log('Screenshot saved.');

  const pixels = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    if (!canvas) return { error: 'no canvas' };
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Sample the player area: lower-left at roughly 23% width
    const samples = [];
    for (let dx = -50; dx <= 50; dx += 10) {
      for (let dy = -80; dy <= 20; dy += 10) {
        const cx = canvas.width * 0.23 + dx * dpr;
        const cy = canvas.height * 0.85 + dy * dpr;
        const data = ctx.getImageData(cx, cy, 1, 1).data;
        samples.push({ x: Math.round(dx), y: Math.round(dy), rgba: [data[0], data[1], data[2], data[3]] });
      }
    }
    // Also dump the WHOLE canvas and find bounding box of bright lime pixels (close to #22c55e)
    const fullData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const brightGreen = [];
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = fullData[i], g = fullData[i + 1], b = fullData[i + 2];
        // Match #22c55e family: g > 180, r < 80, b ~ 80-130
        if (g > 180 && r < 90 && b > 50 && b < 160 && (g - r) > 100 && (g - b) > 50) {
          brightGreen.push({ x, y, r, g, b });
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    const regionSummary = brightGreen.slice(0, 30);
    const regionTotalPixels = brightGreen.length;
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      dpr,
      playerArea: { px: canvas.width * 0.23, py: canvas.height * 0.79 },
      greenBoundingBox: { minX, minY, maxX, maxY, count: brightGreen.length },
      samples: regionSummary,
    };
  });
  console.log(JSON.stringify(pixels, null, 2));

  await page.screenshot({ path: 'scripts/debug/player-sample.png' });
  console.log('Screenshot saved.');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
