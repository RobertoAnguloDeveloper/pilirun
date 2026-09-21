// scripts/debug/dump-green-only.cjs
// Take canvas screenshot directly
const { chromium } = require('playwright');
const fs = require('fs');

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
  await page.waitForTimeout(2500);

  // Get canvas data URL via toDataURL directly (with the game still running)
  // We capture multiple frames to ensure we get one
  let dataUrl = null;
  for (let i = 0; i < 10 && !dataUrl; i++) {
    dataUrl = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.game-canvas');
      try {
        return canvas.toDataURL('image/png');
      } catch (e) {
        return null;
      }
    });
    if (!dataUrl) await page.waitForTimeout(100);
  }

  if (!dataUrl) {
    console.error('Failed to capture canvas');
    process.exit(1);
  }

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync('F:\\ROCATECH Projects\\VIDEOGAMES\\PiliRun\\scripts\\debug\\canvas-raw.png', Buffer.from(base64, 'base64'));

  // Now filter via PIL
  const { spawnSync } = require('child_process');
  // Use ImageMagick to extract green pixels
  const result = spawnSync('magick', [
    'F:\\ROCATECH Projects\\VIDEOGAMES\\PiliRun\\scripts\\debug\\canvas-raw.png',
    '-fuzz', '15%',
    '-fill', 'red',
    '-opaque', '#22c55e',
    '-fill', 'black',
    '+opaque', 'red',
    'F:\\ROCATECH Projects\\VIDEOGAMES\\PiliRun\\scripts\\debug\\green-strict-NOW.png',
  ], { shell: true });

  console.log('Saved. Magick result:', result.stdout?.toString(), result.status);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});