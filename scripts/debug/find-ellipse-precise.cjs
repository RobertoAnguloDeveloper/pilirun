// scripts/debug/find-ellipse-precise.cjs
// Find the exact location and extent of the green ellipse
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000');
  await page.locator('text=JUGAR AHORA').click();
  await page.waitForTimeout(1500);
  await page.locator('text=Ráfaga de Fuego').click();
  await page.waitForTimeout(300);
  await page.locator('text=Comenzar Carrera').click();
  await page.waitForTimeout(2000);

  // Listen for console messages
  page.on('console', (msg) => console.log(`[BROWSER ${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log(`[PAGE ERROR]`, err.message));

  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Find a CLUSTER of bright green pixels (filter out background)
    const points = [];
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Strict bright green matching user-reported color
        if (r < 60 && g > 170 && b > 70 && b < 130) {
          points.push({ x, y });
        }
      }
    }

    // Find connected components using simple flood-fill on a coarse grid
    const cellSize = 10;
    const grid = new Map();
    for (const p of points) {
      const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`;
      grid.set(key, (grid.get(key) || 0) + 1);
    }

    // Group nearby cells into clusters
    const clusters = [];
    const seen = new Set();
    for (const [key, count] of grid) {
      if (seen.has(key)) continue;
      const [cx, cy] = key.split(',').map(Number);
      const cluster = { count: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      const queue = [key];
      while (queue.length) {
        const k = queue.shift();
        if (seen.has(k)) continue;
        seen.add(k);
        const [x, y] = k.split(',').map(Number);
        // Sample points in this cell
        const cellPts = points.filter(p => Math.floor(p.x / cellSize) === x && Math.floor(p.y / cellSize) === y);
        for (const p of cellPts) {
          cluster.count++;
          cluster.minX = Math.min(cluster.minX, p.x);
          cluster.minY = Math.min(cluster.minY, p.y);
          cluster.maxX = Math.max(cluster.maxX, p.x);
          cluster.maxY = Math.max(cluster.maxY, p.y);
        }
        // Check neighbors (8-connected)
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nk = `${x + dx},${y + dy}`;
            if (grid.has(nk) && !seen.has(nk)) queue.push(nk);
          }
        }
      }
      if (cluster.count > 50) {
        clusters.push({
          ...cluster,
          width: cluster.maxX - cluster.minX + 1,
          height: cluster.maxY - cluster.minY + 1,
          centerX: Math.round((cluster.minX + cluster.maxX) / 2),
          centerY: Math.round((cluster.minY + cluster.maxY) / 2),
        });
      }
    }

    // Also check the player render area specifically
    const playerPixels = [];
    const px = 127;
    const py = 604;
    for (let dx = -40; dx <= 40; dx += 5) {
      for (let dy = -40; dy <= 40; dy += 5) {
        const i = ((py + dy) * canvas.width + (px + dx)) * 4;
        playerPixels.push({ dx, dy, rgba: [data[i], data[i+1], data[i+2], data[i+3]] });
      }
    }

    return {
      canvasSize: { width: canvas.width, height: canvas.height },
      totalGreenPixels: points.length,
      clusters: clusters.sort((a, b) => b.count - a.count),
      playerPixels: playerPixels.slice(0, 60),
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
