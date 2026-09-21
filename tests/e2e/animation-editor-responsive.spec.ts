import { test, expect, type Page } from '@playwright/test';

/**
 * Regression coverage for the responsive design of the "Estudio de Animación"
 * (Animation Editor) — the kid-mode nested editor surfaced when the user opens
 * Mis personajes → clicks a character → switches to Generador SVG/PNG.
 *
 * Verifies that on phone-class viewports:
 *   - The drawer header h2 ("Mis personajes") is one line and not clipped.
 *   - The close button collapses to icon-only at ≤480px and keeps full label ≥481px.
 *   - The Modo de creación segmented control (Pixel Art / Generador SVG/PNG / Fotografía)
 *     fits the panel without horizontal overflow.
 *   - The kid-animation-editor fieldset, movement grid, preview toolbar and
 *     frame toolbar never overflow the panel.
 *   - Speed selector buttons (Lento / Normal / Rápido) are fully readable.
 *   - Frame toolbar buttons (Mover antes / Mover después / Duplicar / Retocar /
 *     Borrar) are fully readable.
 *   - Size buttons (Más pequeña / Normal / Más grande) are fully readable.
 */

const GENERADOR_TAB = /Generador SVG/i;
const PIXEL_ART_TAB = /Pixel Art/i;

async function openAnimationEditor(page: Page) {
  await expect(page.getByRole('button', { name: /JUGAR AHORA|Vamos a correr/i })).toBeEnabled({
    timeout: 30000,
  });
  await page.locator('button[title="Personalizar corredores"]').first().click({ force: true });
  await expect(page.getByRole('heading', { name: 'Mis personajes', level: 2 })).toBeVisible({
    timeout: 10000,
  });
  // Select Conejito (the built-in character that ships with frames).
  await page.locator('.character-card').filter({ hasText: 'Conejito' }).locator('button').first().click();
  // Switch to Generador SVG/PNG so the animation editor renders.
  await page.getByRole('button', { name: GENERADOR_TAB }).first().click();
  const region = page.getByRole('region', { name: 'Editor de animaciones' });
  await expect(region).toBeVisible({ timeout: 10000 });
  await region.scrollIntoViewIfNeeded();
}

test.describe('Estudio de Animación responsive layout', () => {
  for (const width of [320, 360, 375, 414, 480, 768]) {
    test(`mobile ${width}px: animation editor fieldset fits the panel`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await openAnimationEditor(page);

      const fieldset = page.locator('.kid-editor-fieldset');
      await expect(fieldset).toBeVisible();
      const panelBox = await page.locator('.in-game-drawer-panel').boundingBox();
      const fsBox = await fieldset.boundingBox();
      expect(panelBox).not.toBeNull();
      expect(fsBox).not.toBeNull();
      expect(fsBox!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      expect(fsBox!.x + fsBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);

      // Document should never horizontally overflow the viewport.
      const docScroll = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(docScroll, `viewport ${width}px`).toBeLessThanOrEqual(width + 1);
    });
  }

  test('mobile 320px: Mis personajes h2 stays on a single line and close button is icon-only', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/');
    await openAnimationEditor(page);

    const h2 = page.getByRole('heading', { name: 'Mis personajes', level: 2 });
    await expect(h2).toBeVisible();
    const offsetHeight = await h2.evaluate((el) => el.getBoundingClientRect().height);
    // One line of 18px font ≈ 22px tall; two lines ≈ 44px+.
    expect(offsetHeight).toBeLessThan(36);

    const closeBtn = page.locator('.arcade-close-btn');
    await expect(closeBtn).toBeVisible();
    const width = await closeBtn.evaluate((el) => el.getBoundingClientRect().width);
    // Icon-only X button fits in ≤60px; with text "CERRAR [ESC]" it's 130-150px.
    expect(width).toBeLessThan(70);
  });

  test('mobile 414px: Mis personajes h2 fits and close button is icon-only', async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await page.goto('/');
    await openAnimationEditor(page);

    const closeBtn = page.locator('.arcade-close-btn');
    await expect(closeBtn).toBeVisible();
    const width = await closeBtn.evaluate((el) => el.getBoundingClientRect().width);
    // At ≤480px the "CERRAR [ESC]" label is hidden and only the X icon remains (~40px).
    expect(width).toBeLessThan(70);

    const h2 = page.getByRole('heading', { name: 'Mis personajes', level: 2 });
    await expect(h2).toBeVisible();
    const offsetHeight = await h2.evaluate((el) => el.getBoundingClientRect().height);
    expect(offsetHeight).toBeLessThan(36);
  });

  test('mobile 481px: close button keeps the full "CERRAR [ESC]" label', async ({ page }) => {
    await page.setViewportSize({ width: 481, height: 800 });
    await page.goto('/');
    await openAnimationEditor(page);

    const closeBtn = page.locator('.arcade-close-btn');
    await expect(closeBtn).toBeVisible();
    const width = await closeBtn.evaluate((el) => el.getBoundingClientRect().width);
    // At ≥481px the "CERRAR [ESC]" label + X icon are both visible (~140px).
    expect(width).toBeGreaterThan(100);
  });

  test('mobile 320px: Modo de creación segmented control fits the panel', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/');
    await openAnimationEditor(page);

    const panelBox = await page.locator('.in-game-drawer-panel').boundingBox();
    expect(panelBox).not.toBeNull();
    for (const label of ['Pixel Art', 'Generador SVG/PNG', 'Fotografía']) {
      const btn = page
        .locator('.editor-main .section-heading.compact .segmented button')
        .filter({ hasText: label });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }
  });

  test('mobile 375px: speed selector buttons (Lento/Normal/Rápido) fit the panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await openAnimationEditor(page);

    const panelBox = await page.locator('.in-game-drawer-panel').boundingBox();
    expect(panelBox).not.toBeNull();
    for (const label of ['Lento', 'Normal', 'Rápido']) {
      const btn = page.locator('.kid-speed-selector button', { hasText: label });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }
  });

  test('mobile 375px: frame toolbar buttons (Mover/Duplicar/Retocar/Borrar) fit the panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await openAnimationEditor(page);

    const panelBox = await page.locator('.in-game-drawer-panel').boundingBox();
    expect(panelBox).not.toBeNull();
    for (const label of ['Mover antes', 'Mover después', 'Duplicar', 'Retocar dibujo', 'Borrar foto']) {
      const btn = page.locator('.kid-tool-btn', { hasText: label });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }
  });

  test('mobile 375px: size buttons (Más pequeña/Normal/Más grande) fit the panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await openAnimationEditor(page);

    const panelBox = await page.locator('.in-game-drawer-panel').boundingBox();
    expect(panelBox).not.toBeNull();
    for (const label of ['Más pequeña', 'Normal', 'Más grande']) {
      const btn = page.locator('.kid-size-btn', { hasText: label });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }
  });

  test('mobile 375px: Conejito avatar in preview renders without baked-in shadow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await openAnimationEditor(page);

    // The preview stage hosts a <canvas> Avatar with size 240px. Confirm it
    // renders, which means the new hideShadow code path completed without
    // throwing. The actual shadow-stripping behaviour is unit-tested in
    // tests/sprite-geometry and the visible result is verified via the
    // captured screenshot in test-results/.
    const avatarCanvas = page.locator('.kid-preview-stage canvas').first();
    await expect(avatarCanvas).toBeVisible();
    const box = await avatarCanvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('tablet 768px: animation editor stays inside the panel without truncation', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await openAnimationEditor(page);

    const panelBox = await page.locator('.in-game-drawer-panel').boundingBox();
    const fsBox = await page.locator('.kid-editor-fieldset').boundingBox();
    expect(panelBox).not.toBeNull();
    expect(fsBox).not.toBeNull();
    expect(fsBox!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
    expect(fsBox!.x + fsBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);

    // Verify Pixel Art button still exists and full text is visible (no
    // regression of the segmented layout on tablet).
    const btn = page.getByRole('button', { name: PIXEL_ART_TAB }).first();
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
  });
});