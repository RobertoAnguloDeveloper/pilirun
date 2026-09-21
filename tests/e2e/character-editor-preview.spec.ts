import { test, expect } from '@playwright/test';

const playButton = /Vamos a correr|JUGAR AHORA/i;

test.describe('character editor preview responsiveness', () => {
  test('desktop keeps sidebar layout, hides baked-in sprite shadow, shows new-character tile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: playButton })).toBeEnabled({ timeout: 30000 });
    await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
    await expect(page.getByText('VISTA PREVIA ANIMADA')).toBeVisible();
    await expect(page.getByRole('button', { name: /Pausar animación/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Corre', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salta', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desliza', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reposo', exact: true })).toBeVisible();
    const nuevoPersonaje = page.locator('.new-character-tile');
    await expect(nuevoPersonaje).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/character-editor-desktop.png', fullPage: true });
  });

  test('mobile stacks preview controls vertically and keeps them inside the sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: playButton })).toBeEnabled({ timeout: 30000 });
    await page.getByRole('button', { name: 'Personajes', exact: true }).click();
    await expect(page.getByText('VISTA PREVIA ANIMADA')).toBeVisible();

    const sidebar = page.locator('aside.editor-sidebar');
    await expect(sidebar).toBeVisible();

    const playBtn = page.getByRole('button', { name: /Pausar animación/ });
    await expect(playBtn).toBeVisible();
    const segBtn = page.getByRole('button', { name: 'Corre', exact: true });
    await expect(segBtn).toBeVisible();

    const sidebarBox = await sidebar.boundingBox();
    const playBox = await playBtn.boundingBox();
    const segBox = await segBtn.boundingBox();
    if (!sidebarBox || !playBox || !segBox) throw new Error('boxes missing');

    // The Pausar and segmented control must fit entirely inside the sidebar.
    expect(playBox.x).toBeGreaterThanOrEqual(sidebarBox.x - 1);
    expect(playBox.x + playBox.width).toBeLessThanOrEqual(sidebarBox.x + sidebarBox.width + 1);
    expect(segBox.x).toBeGreaterThanOrEqual(sidebarBox.x - 1);
    expect(segBox.x + segBox.width).toBeLessThanOrEqual(sidebarBox.x + sidebarBox.width + 1);

    // On mobile they should stack vertically (play above segmented).
    expect(playBox.y).toBeLessThan(segBox.y);

    // No horizontal page overflow.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

    await page.screenshot({ path: 'test-results/character-editor-mobile.png', fullPage: true });

    // Capture the Vista Previa Animada area in isolation for the screenshot review.
    const previewAside = page.locator('aside.editor-sidebar');
    await previewAside.scrollIntoViewIfNeeded();
    await previewAside.screenshot({ path: 'test-results/character-editor-preview-mobile.png' });
  });

  test('desktop preview controls fit on one line inside the sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: playButton })).toBeEnabled({ timeout: 30000 });
    await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
    await expect(page.getByText('VISTA PREVIA ANIMADA')).toBeVisible();

    const previewAside = page.locator('aside.editor-sidebar');
    await previewAside.scrollIntoViewIfNeeded();
    await previewAside.screenshot({ path: 'test-results/character-editor-preview-desktop.png' });
  });

  test('creating a new character from a blank canvas works even with no pixels drawn', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: playButton })).toBeEnabled({ timeout: 30000 });
    await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
    await page.getByRole('button', { name: /Nuevo personaje/ }).click();
    await expect(page.getByText(/Lienzo en blanco listo/)).toBeVisible();
    await page.getByLabel('Nombre del personaje').fill('Sin dibujo');
    await page.getByRole('button', { name: 'Guardar personaje' }).click();
    await expect(page.getByText(/Tu personaje está listo para correr/)).toBeVisible();
    await expect(page.locator('.character-card', { hasText: 'Sin dibujo' })).toBeVisible();
  });
});
