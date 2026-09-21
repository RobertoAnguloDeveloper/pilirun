// scripts/debug/dom-inspect.cjs
// Check what's at the green circle position in the DOM
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

  // Use elementsFromPoint at the green circle position
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + 175;
    const y = rect.top + 660;
    const elements = document.elementsFromPoint(x, y);
    return {
      point: { x, y },
      elements: elements.map(el => ({
        tag: el.tagName,
        className: el.className,
        id: el.id,
        style: el.getAttribute('style'),
        bgColor: window.getComputedStyle(el).backgroundColor,
        visibility: window.getComputedStyle(el).visibility,
        display: window.getComputedStyle(el).display,
      })),
    };
  });

  console.log(JSON.stringify(info, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
