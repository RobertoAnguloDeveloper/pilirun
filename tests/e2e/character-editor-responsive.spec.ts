import { test, expect, type Page } from '@playwright/test';

/**
 * Regression coverage for the responsive design of the "Mis personajes"
 * character editor drawer. Verifies that from "Modo de creación" through
 * the bottom (palette tabs, transform toolbar, sidebar preview) nothing
 * overflows the panel horizontally on phone-class viewports.
 */

const PIXEL_ART_TAB = /Pixel Art/i;
const PALETTE_TABS = ['Tierra & Bosque', 'Neón & Fantasía', 'Pieles, Pelajes & Sombras', 'Monocromo & Metales'];
const TRANSFORM_BUTTONS = ['90° Izq', '90° Der', 'Espejo H', 'Espejo V'];

async function openEditor(page: Page) {
  await expect(page.getByRole('button', { name: /JUGAR AHORA|Vamos a correr/i })).toBeEnabled({ timeout: 30000 });
  // Mobile viewport hides the desktop pill nav and exposes the dock button.
  await page.locator('button[title="Personalizar corredores"]').first().click({ force: true });
  await expect(page.getByText('VISTA PREVIA ANIMADA')).toBeVisible({ timeout: 10000 });
  // Switch to Pixel Art mode so all of the editor content is present.
  await page.getByRole('button', { name: PIXEL_ART_TAB }).first().click();
}

test.describe('character editor responsive layout', () => {
  test('mobile 320px viewport has no horizontal overflow inside the editor card', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await openEditor(page);

    const card = page.locator('.editor-card');
    await expect(card).toBeVisible();
    const overflow = await card.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test('mobile portrait 375px palette category tabs fit without truncation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await openEditor(page);

    const panel = page.locator('.in-game-drawer-panel');
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();

    for (const label of PALETTE_TABS) {
      const tab = page.locator('.palette-tab-btn', { hasText: label });
      await expect(tab).toBeVisible();
      const box = await tab.boundingBox();
      expect(box).not.toBeNull();
      // Left edge never sits to the left of the panel's content area.
      expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      // Right edge never sits past the panel's right edge.
      expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }
  });

  test('mobile portrait 375px transform toolbar (90°/Espejo) fits the panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await openEditor(page);

    const panelBox = await page.locator('.in-game-drawer-panel').boundingBox();
    expect(panelBox).not.toBeNull();

    for (const label of TRANSFORM_BUTTONS) {
      const btn = page.locator('.transform-toolbar-buttons button', { hasText: label });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }
  });

  test('mobile portrait 375px Modo de creación h2 is fully visible and not clipped', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await openEditor(page);

    const h2 = page.getByRole('heading', { name: 'Modo de creación', level: 2 });
    await expect(h2).toBeVisible();
    const panelBox = await page.locator('.in-game-drawer-panel').boundingBox();
    const h2Box = await h2.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(h2Box).not.toBeNull();
    expect(h2Box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
    expect(h2Box!.x + h2Box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
  });

  test('mobile portrait 375px sprite-movement segmented control fits the panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await openEditor(page);

    const panelBox = await page.locator('.in-game-drawer-panel').boundingBox();
    expect(panelBox).not.toBeNull();
    for (const label of ['Reposo (1)', 'Carrera (6)', 'Salto (2)', 'Agachado (2)']) {
      const btn = page.locator('.sprite-movement-shelf .segmented button', { hasText: label });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }
  });

  test('mobile tablet 414/768/1024 viewports have no horizontal overflow inside the editor card', async ({ page }) => {
    for (const w of [414, 768, 1024]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/');
      await openEditor(page);
      const card = page.locator('.editor-card');
      const overflow = await card.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(overflow.scrollWidth, `viewport ${w}px`).toBeLessThanOrEqual(overflow.clientWidth + 1);
    }
  });
});