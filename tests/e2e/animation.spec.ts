import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('custom animation review, reorder, replace and individual save survive reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Vamos a correr|JUGAR AHORA/i })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await page.getByRole('button', { name: /Generador SVG/i }).click();
  await page.getByLabel('Nombre del personaje').fill('Frames QA');
  const editor = page.getByRole('region', { name: 'Editor de animaciones' });
  const upload = editor.getByLabel('Añadir fotograma', { exact: true });
  const sprite = (color: string) => ({
    name: 'frame.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect x="30" y="10" width="20" height="60" fill="${color}"/></svg>`,
    ),
  });
  await upload.setInputFiles(sprite('#ff0000'));
  await expect(editor.getByRole('button', { name: 'Fotograma 1', exact: true })).toBeVisible();
  await upload.setInputFiles(sprite('#0000ff'));
  const frames = editor.locator('.animation-frames img');
  await expect(frames).toHaveCount(2);
  const original = await frames.evaluateAll((images) =>
    images.map((image) => image.getAttribute('src')),
  );
  await editor.getByRole('button', { name: 'Mover antes', exact: true }).click();
  await expect(frames.first()).toHaveAttribute('src', original[1]!);
  await editor.getByLabel('Reemplazar fotograma seleccionado').setInputFiles(sprite('#00ff00'));
  await expect(frames.first()).not.toHaveAttribute('src', original[1]!);
  await editor.getByRole('button', { name: 'Fotograma 1', exact: true }).click();
  // The padded sprite's opaque feet finish at the preview's ground boundary.
  await expect
    .poll(() =>
      editor.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d')!;
        const feet = ctx.getImageData(80, 144, 1, 1).data;
        const below = ctx.getImageData(80, 146, 1, 1).data;
        return feet[1] > 200 && feet[0] < 20 && below[3] === 0;
      }),
    )
    .toBe(true);
  await editor.getByLabel('Posición de los pies (% de altura de la imagen)').fill('70');
  await editor.getByLabel('Tamaño del fotograma (%)', { exact: true }).fill('150');
  await editor.getByRole('button', { name: 'Guardar animación: Carrera', exact: true }).click();
  await expect(
    page.getByText('Animación guardada. Los otros movimientos conservan su secuencia.'),
  ).toBeVisible();
  const saved = await frames.first().getAttribute('src');
  // Keep a draft change in Carrera; saving Salto must not persist it.
  await editor.getByRole('button', { name: 'Mover después', exact: true }).click();
  await editor.getByLabel('Movimiento', { exact: true }).selectOption('jump');
  await upload.setInputFiles(sprite('#ffff00'));
  await editor
    .getByRole('button', { name: 'Guardar animación: Salto / caída', exact: true })
    .click();
  await expect(
    page.getByText('Animación guardada. Los otros movimientos conservan su secuencia.'),
  ).toBeVisible();
  for (const [movement, label] of [['idle', 'Reposo'], ['slide', 'Agachado / deslizamiento']]) {
    await editor.getByLabel('Movimiento', { exact: true }).selectOption(movement);
    await upload.setInputFiles(sprite('#ff00ff'));
    await editor.getByRole('button', { name: `Guardar animación: ${label}`, exact: true }).click();
    await expect(editor.getByRole('button', { name: `Guardar animación: ${label}`, exact: true })).toBeEnabled();
  }
  await page.reload();
  await expect(page.getByRole('button', { name: /Vamos a correr|JUGAR AHORA/i })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Frames QA', exact: true }).click();
  await expect(frames).toHaveCount(2);
  await expect(frames.first()).toHaveAttribute('src', saved!);
  await expect(editor.getByLabel('Tamaño del fotograma (%)', { exact: true })).toHaveValue('150');
  await editor.getByRole('button', { name: 'Fotograma 2', exact: true }).click();
  await expect(editor.getByLabel('Tamaño del fotograma (%)', { exact: true })).toHaveValue('100');
  await editor.getByRole('button', { name: 'Fotograma 1', exact: true }).click();
  await expect(editor.getByLabel('Posición de los pies (% de altura de la imagen)')).toHaveValue('70');
  for (const movement of ['idle', 'slide']) {
    await editor.getByLabel('Movimiento', { exact: true }).selectOption(movement);
    await expect(frames).toHaveCount(1);
  }
  await editor.getByLabel('Movimiento', { exact: true }).selectOption('jump');
  await expect(frames).toHaveCount(1);
  await editor.getByLabel('Movimiento', { exact: true }).selectOption('run');
  await editor.getByRole('heading', { name: 'Editar animaciones' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/animation-editor-desktop.png', fullPage: true });
  const accessibility = await new AxeBuilder({ page }).include('.animation-editor').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await editor.getByRole('heading', { name: 'Editar animaciones' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/animation-editor-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
