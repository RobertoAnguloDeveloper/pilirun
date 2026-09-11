import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('camp, game controls, character and track persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await page.screenshot({ path: 'test-results/camp-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Vamos a correr' }).click();
  const canvas = page.locator('.game-canvas');
  await expect(canvas).toBeVisible();
  await canvas.press('Space');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByText('Un respiro en el camino.')).toBeVisible();
  const before = await page.locator('.game-hud').innerText();
  await page.screenshot({ path: 'test-results/game-paused.png' });
  expect(await page.locator('.game-hud').innerText()).toBe(before);
  await page.getByRole('button', { name: 'Seguir corriendo' }).click();
  await page.getByRole('button', { name: 'Salir de la carrera' }).click();
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await page.getByLabel('Nombre del personaje').fill('Pili QA');
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await expect(page.getByText('Tu personaje está listo para correr.')).toBeVisible();
  await page.getByRole('button', { name: /Pili QA Elegir personaje/ }).click();
  await page.getByRole('button', { name: /Crear una pista/ }).click();
  await page.getByLabel('Nombre de la pista').fill('Sendero QA');
  await page.getByRole('button', { name: 'Añadir tronco' }).click();
  await page.getByRole('button', { name: 'Guardar pista' }).click();
  await expect(page.getByText('Tu pista ya forma parte de la aventura.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await expect(page.locator('.companion-name')).toContainText('Pili QA');
  await page.getByRole('button', { name: /Crear una pista/ }).click();
  await expect(page.getByRole('heading', { name: 'Sendero QA', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('photo crop and audio BLOB survive reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await page.getByRole('button', { name: 'Fotografía', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('public/icon-192.png');
  await page.getByLabel('Nombre del personaje').fill('Photo explorer');
  await expect(page.getByRole('button', { name: 'Guardar personaje' })).toBeEnabled();
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await expect(page.getByText('Tu personaje está listo para correr.')).toBeVisible();
  await page.getByRole('button', { name: 'Mi música', exact: true }).click();
  const sampleRate = 8000,
    samples = sampleRate * 2,
    wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(Math.round(Math.sin((i / sampleRate) * Math.PI * 440) * 500), 44 + i * 2);
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Forest test.wav', mimeType: 'audio/wav', buffer: wav });
  await page.getByRole('button', { name: 'Guardar audio', exact: true }).click();
  await expect(page.getByText('Tu música está guardada. Dale al play.')).toBeVisible();
  await page.getByRole('button', { name: 'Reproducir Forest test' }).click();
  await expect(page.getByRole('button', { name: 'Pausar Forest test' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await expect(page.getByRole('button', { name: /Photo explorer Elegir personaje/ })).toBeVisible();
  await page.getByRole('button', { name: 'Mi música', exact: true }).click();
  await page.getByRole('button', { name: 'Reproducir Forest test' }).click();
  await expect(page.getByRole('button', { name: 'Pausar Forest test' })).toBeVisible();
});
test('offline shell includes previously unopened editors and the game', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardar personaje' })).toBeVisible();
  await page.getByRole('button', { name: 'Campamento', exact: true }).click();
  await page.getByRole('button', { name: 'Vamos a correr' }).click();
  await expect(page.locator('.game-canvas')).toBeVisible();
});
test('a completed attempt is saved in the adventure diary', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Vamos a correr' }).click();
  await expect(page.getByText('Carrera guardada en este dispositivo')).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Volver al campamento', exact: true }).click();
  await page.getByRole('button', { name: 'Mis aventuras', exact: true }).click();
  await expect(page.locator('.run-list article')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis aventuras', exact: true }).click();
  await expect(page.locator('.run-list article')).toHaveCount(1);
});
test('primary pages meet automated accessibility checks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of [
      'Campamento',
      'Mis personajes',
      'Crear una pista',
      'Mi música',
      'Mis aventuras',
    ]) {
      await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
      await expect(page.locator('h1').first()).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map((v) => ({
          page: name,
          id: v.id,
          nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
        })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (name === 'Crear una pista' || name === 'Mis personajes' || name === 'Mi música')
        await page.screenshot({
          path: `test-results/${name.replaceAll(' ', '-')}-${width}.png`,
          fullPage: true,
        });
    }
  }
});
test('fallback SQLite persists a character across reload in IndexedDB', async ({ page }) => {
  await page.route('**/workers/storage.worker.js', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        "Object.defineProperty(navigator.storage, 'getDirectory', { value: undefined });\n" +
        (await response.text()),
    });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: /Ajustes/ }).click();
  await expect(page.getByText('SQLite · IndexedDB')).toBeVisible();
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await page.getByLabel('Nombre del personaje').fill('IDB Explorer');
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await expect(page.getByText('Tu personaje está listo para correr.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await expect(page.getByRole('button', { name: /IDB Explorer Elegir personaje/ })).toBeVisible();
});
test('mobile layout and touch race', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/camp-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Vamos a correr' }).click();
  await expect(page.locator('.game-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Saltar', exact: true }).click();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.screenshot({ path: 'test-results/game-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('another tab cannot overwrite the active save', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('.error-banner')).toContainText('otra pestaña', { timeout: 30000 });
  await page.close();
  await second.reload();
  await expect(second.getByRole('button', { name: 'Vamos a correr' })).toBeEnabled({
    timeout: 30000,
  });
});
