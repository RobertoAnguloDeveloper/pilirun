// scripts/debug/ascii-player.cjs
// Render ASCII map of pixels around the player
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

  const ascii = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.game-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Render ASCII map of 200x150 area around player center (127, 604)
    const cx = 127, cy = 604;
    const W = 80, H = 60;
    const stepX = 200 / W, stepY = 150 / H;
    let out = '';
    for (let row = 0; row < H; row++) {
      for (let col = 0; col < W; col++) {
        const sx = Math.round(cx - 100 + col * stepX);
        const sy = Math.round(cy - 130 + row * stepY);
        if (sx < 0 || sx >= canvas.width || sy < 0 || sy >= canvas.height) {
          out += ' ';
          continue;
        }
        const i = (sy * canvas.width + sx) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Color buckets
        if (r < 60 && g > 170 && g - r > 100 && b > 70 && b < 130) out += '#';  // bright green
        else if (r > 200 && g > 200 && b > 200) out += 'W';  // white
        else if (r < 80 && g < 80 && b < 80) out += '.';  // dark
        else if (r > 150 && g < 100 && b < 100) out += 'R';  // red
        else if (r > 200 && g > 100 && g < 200 && b < 100) out += 'Y';  // yellow
        else if (g > 100 && g - r > 30 && g - b > 30) out += 'g';  // generic green
        else if (r > 100 && g > 50 && b < 80) out += 'b';  // brown
        else if (r > 100 && r - g > 30 && r - b > 30) out += 'p';  // pink
        else out += '~';  // other
      }
      out += '\n';
    }
    return out;
  });

  console.log('ASCII map around player (127, 604):');
  console.log('  # = bright green, W = white, . = dark, R = red, Y = yellow');
  console.log('  g = generic green, b = brown, p = pink, ~ = other');
  console.log('---');
  console.log(ascii);

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
