// scripts/debug/crop-ellipse.cjs
// Crop the green ellipse area from the canvas and save as image
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

  // Crop the area where the green ellipse appears
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    // Crop the bottom-left area where the green ellipse is
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = 250;
    cropCanvas.height = 150;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(canvas, 0, 600, 250, 150, 0, 0, 250, 150);

    // Try to inspect the engine state
    const debugInfo = {};
    try {
      // Access window globals if exposed
      debugInfo.hasGameEngine = !!window.gameEngine;
      debugInfo.canvasInfo = {
        width: canvas.width,
        height: canvas.height,
      };
    } catch(e) {
      debugInfo.error = e.message;
    }

    return JSON.stringify({ debugInfo, dataUrl: cropCanvas.toDataURL('image/png') });
  });

  // Save the cropped image
  const fs = require('fs');
  const json = JSON.parse(dataUrl);
  console.log('Debug info:', JSON.stringify(json.debugInfo, null, 2));
  const base64 = json.dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync('scripts/debug/ellipse-crop.png', Buffer.from(base64, 'base64'));
  console.log('Saved ellipse-crop.png');

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
