import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const playButton = /Vamos a correr|JUGAR AHORA/i;
test('camp, game controls, character and track persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  await page.screenshot({ path: 'test-results/camp-desktop.png', fullPage: true });
  await page.getByRole('button', { name: playButton }).click();
  await page.getByRole('button', { name: '¡Comenzar Carrera!', exact: true }).click();
  const canvas = page.locator('.game-canvas');
  await expect(canvas).toBeVisible();
  await canvas.press('Space');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Juego en Pausa' })).toBeVisible();
  const before = await page.locator('.game-hud').innerText();
  await page.screenshot({ path: 'test-results/game-paused.png' });
  expect(await page.locator('.game-hud').innerText()).toBe(before);
  await page.getByRole('button', { name: /Reanudar \[P\]/ }).click();
  await page.getByRole('button', { name: 'Salir de la carrera' }).click();
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await page.getByLabel('Nombre del personaje').fill('Pili QA');
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await expect(page.getByText(/Tu personaje está listo para correr/)).toBeVisible();
  await page.getByRole('button', { name: /Pili QA Elegir personaje/ }).click();
  await page.getByRole('button', { name: /Crear una pista/ }).click();
  await page.getByLabel('Nombre de la pista').fill('Sendero QA');
  await page.getByRole('button', { name: 'Añadir tronco' }).click();
  await page.getByRole('button', { name: 'Guardar pista' }).click();
  await expect(page.getByText('Tu pista ya forma parte de la aventura.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await expect(page.getByRole('button', { name: /Pili QA.*En tu equipo/ })).toBeVisible();
  await page.getByRole('button', { name: /Crear una pista/ }).click();
  await expect(page.getByRole('heading', { name: 'Sendero QA', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('photo crop and audio BLOB survive reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await page.getByRole('button', { name: 'Fotografía', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('public/icon-192.png');
  await page.getByLabel('Nombre del personaje').fill('Photo explorer');
  await expect(page.getByRole('button', { name: 'Guardar personaje' })).toBeEnabled();
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await expect(page.getByText(/Tu personaje está listo para correr/)).toBeVisible();
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
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
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
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardar personaje' })).toBeVisible();
  await page.getByRole('button', { name: 'Campamento', exact: true }).click();
  await page.getByRole('button', { name: playButton }).click();
  await page.getByRole('button', { name: '¡Comenzar Carrera!', exact: true }).click();
  await expect(page.locator('.game-canvas')).toBeVisible();
});
test('a completed attempt is saved in the adventure diary', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: playButton }).click();
  await page.getByRole('button', { name: '¡Comenzar Carrera!', exact: true }).click();
  await expect(page.getByText('Carrera guardada en este dispositivo')).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Volver al campamento', exact: true }).click();
  await page.getByRole('button', { name: 'Mis aventuras', exact: true }).click();
  await expect(page.locator('.run-list article')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis aventuras', exact: true }).click();
  await expect(page.locator('.run-list article')).toHaveCount(1);
});
test('primary pages meet automated accessibility checks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  const destinations: Array<[string, string | null]> = [
    ['Campamento', null],
    ['Mis personajes', 'Personajes'],
    ['Crear una pista', 'Taller'],
    ['Mi música', 'Música'],
    ['Mis aventuras', 'Récords'],
  ];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(page.getByRole('button', { name: playButton })).toBeEnabled({ timeout: 30000 });
    for (const [name, shortcut] of destinations) {
      const close = page.getByRole('button', { name: 'Cerrar y volver al juego' });
      if (await close.isVisible().catch(() => false)) await close.click();
      if (shortcut) {
        await page.getByRole('button', { name: shortcut, exact: true }).click();
        const drawer = page.locator('.in-game-drawer-backdrop');
        await expect(drawer).toBeVisible();
        await expect
          .poll(() => drawer.evaluate((element) => getComputedStyle(element).opacity))
          .toBe('1');
      }
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
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: /Ajustes/ }).click();
  await expect(page.getByText('SQLite · IndexedDB')).toBeVisible();
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await page.getByLabel('Nombre del personaje').fill('IDB Explorer');
  await page.getByRole('button', { name: 'Guardar personaje' }).click();
  await expect(page.getByText(/Tu personaje está listo para correr/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();
  await expect(page.getByRole('button', { name: /IDB Explorer Elegir personaje/ })).toBeVisible();
});
test('mobile layout and touch race', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/camp-mobile.png', fullPage: true });
  await page.getByRole('button', { name: playButton }).click();
  await page.getByRole('button', { name: '¡Comenzar Carrera!', exact: true }).click();
  await expect(page.locator('.game-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Saltar', exact: true }).click();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.screenshot({ path: 'test-results/game-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('another tab cannot overwrite the active save', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('.error-banner')).toContainText('otra pestaña', { timeout: 30000 });
  await page.close();
  await second.reload();
  await expect(second.getByRole('button', { name: playButton })).toBeEnabled({
    timeout: 30000,
  });
});

test('PiliRun branding, about panel and portrait race are complete', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('MODO ARCADE 3D · PILIRUN')).toBeVisible({ timeout: 30000 });
  const developer = page.getByRole('link', { name: 'Developed by Roca Tech Solutions' });
  await expect(developer).toHaveAttribute('href', 'https://www.rocatechsolutions.com/');
  await expect(developer).toHaveAttribute('target', '_blank');
  await page.getByRole('button', { name: /Ajustes/ }).click();
  await expect(page.getByRole('heading', { name: 'Acerca de PiliRun' })).toBeVisible();
  await expect(page.getByAltText('Roca Tech Solutions')).toBeVisible();
  await expect(page.getByText('Roca Tech Solutions S.A.S.')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar y volver al juego' }).click();

  await page.getByRole('button', { name: playButton }).click();
  await page.getByRole('button', { name: '¡Comenzar Carrera!', exact: true }).click();
  const stage = page.locator('.game-stage');
  await expect(stage).toBeVisible();
  const height = await stage.evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(height - 844)).toBeLessThanOrEqual(3);
  await expect(page.locator('.arcade-header')).toBeHidden();
  await expect(page.locator('.arcade-bottom-credit')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Saltar', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/game-side-portrait.png' });
  await page.getByRole('button', { name: 'Alternar cámara 1ª persona / lateral' }).click();
  await page.screenshot({ path: 'test-results/game-first-person-portrait.png' });
});

test('scenario editor creates, saves and reloads a playable scenario', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Editor de escenarios', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Editor de escenarios' });
  await expect(editor).toBeVisible();
  await page.getByLabel('Nombre del escenario').fill('Escenario QA');
  const canvas = page.getByLabel(/Lienzo del escenario/);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.click({ position: { x: box!.width * 0.55, y: box!.height * 0.7 } });
  await expect(page.locator('.scenario-status')).toContainText('1 objetos');
  await page.getByRole('button', { name: /Guardar$/ }).click();
  await expect(page.getByText('Escenario guardado en este dispositivo.')).toBeVisible();
  await page.screenshot({ path: 'test-results/scenario-editor-desktop.png' });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  await page.reload();
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Editor de escenarios', exact: true }).click();
  await expect(page.getByRole('button', { name: /Escenario QA/ })).toBeVisible();
});

test('mobile scenario editor exposes touch panels and saves', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: playButton })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Escenarios', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Editor de escenarios' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Objetos', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Propiedades', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Capas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Objetos', exact: true }).click();
  await page.getByRole('button', { name: 'Tronco', exact: true }).click();
  const canvas = page.getByLabel(/Lienzo del escenario/);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.click({ position: { x: box!.width * 0.55, y: box!.height * 0.68 } });
  await page.getByRole('button', { name: 'Propiedades', exact: true }).click();
  await expect(page.getByLabel('Posición X')).toBeVisible();
  await page.getByLabel('Nombre del escenario').fill('Escenario táctil QA');
  await page.getByRole('button', { name: /Guardar$/ }).click();
  await expect(page.getByText('Escenario guardado en este dispositivo.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/scenario-editor-mobile.png' });
});

test.describe('PWA Tablet Installation & Manifest Suite', () => {
  test('manifest meets Chromium and tablet installability criteria', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();

    expect(manifest.name).toBe('PiliRun — Tu mundo, tu ritmo');
    expect(manifest.short_name).toBe('PiliRun');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('any');

    // Verify icons
    const icons = manifest.icons || [];
    const has192 = icons.some((i: any) => i.sizes === '192x192');
    const has512 = icons.some((i: any) => i.sizes === '512x512');
    const hasMaskable = icons.some((i: any) => i.purpose === 'maskable');

    expect(has192).toBeTruthy();
    expect(has512).toBeTruthy();
    expect(hasMaskable).toBeTruthy();

    // Verify tablet & mobile screenshots
    const screenshots = manifest.screenshots || [];
    const hasWide = screenshots.some((s: any) => s.form_factor === 'wide');
    const hasNarrow = screenshots.some((s: any) => s.form_factor === 'narrow');
    expect(hasWide).toBeTruthy();
    expect(hasNarrow).toBeTruthy();
  });

  test('tablet viewport renders install button and settings panel', async ({ page }) => {
    // Emulate tablet viewport (1024x768 landscape)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');

    await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
      timeout: 30000,
    });

    // Check header install button exists and is accessible
    const installHeaderBtn = page.getByRole('button', {
      name: 'Instalar PiliRun en tu tableta o dispositivo',
    });
    await expect(installHeaderBtn).toBeVisible();

    // Check home banner chip exists
    const homeBannerChip = page.locator('.pwa-home-banner-chip');
    await expect(homeBannerChip).toBeVisible();
    await expect(homeBannerChip).toContainText('Instalar como App en esta Tableta');

    // Navigate to settings and verify Tablet Installation panel
    await page.getByRole('button', { name: 'Ajustes de juego' }).click();
    await expect(page.getByRole('heading', { name: 'Instalación y Modo Tableta' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Instalar PiliRun en este Dispositivo' }),
    ).toBeVisible();
  });

  test('beforeinstallprompt event triggers install flow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: playButton })).toBeEnabled({
      timeout: 30000,
    });

    // Dispatch simulated beforeinstallprompt
    await page.evaluate(() => {
      let promptCalled = false;
      const event = new Event('beforeinstallprompt', { bubbles: true, cancelable: true });
      Object.assign(event, {
        prompt: () => {
          promptCalled = true;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
      (window as any).__pwaPromptCalled = () => promptCalled;
      window.dispatchEvent(event);
    });

    // Header install button should now pulse
    const installHeaderBtn = page.getByRole('button', {
      name: 'Instalar PiliRun en tu tableta o dispositivo',
    });
    await expect(installHeaderBtn).toHaveClass(/can-install-pulse/);

    // Clicking it triggers the native prompt
    await installHeaderBtn.click();
    const wasCalled = await page.evaluate(() => (window as any).__pwaPromptCalled?.());
    expect(wasCalled).toBe(true);

    // Simulating appinstalled updates UI to standalone
    await page.evaluate(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    // In standalone mode, install button is hidden from header
    await expect(installHeaderBtn).not.toBeVisible();
  });

  test('power selection modal is fully visible and clickable in tablet landscape', async ({ page }) => {
    // Standard tablet landscape viewports (e.g. 1024x600, 960x540, 1280x800)
    await page.setViewportSize({ width: 1024, height: 560 });
    await page.goto('/');

    const playBtn = page.getByRole('button', { name: playButton });
    await expect(playBtn).toBeEnabled({ timeout: 30000 });
    await playBtn.click();

    // Power selector modal should be visible
    const modalHeading = page.getByRole('heading', { name: '¡Elige tu Poder Mágico!' });
    await expect(modalHeading).toBeVisible();

    // The start race button must be visible in viewport without being cut off
    const startBtn = page.getByRole('button', { name: '¡Comenzar Carrera!' });
    await expect(startBtn).toBeVisible();

    // Verify it is completely within the viewport bounds
    const box = await startBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.y + box.height).toBeLessThanOrEqual(560);
      expect(box.y).toBeGreaterThanOrEqual(0);
    }

    // Clicking it starts the race
    await startBtn.click();
    await expect(modalHeading).not.toBeVisible();
  });

  test('character creator features: clear canvas, freehand mode, palettes, and photo bg removal', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: playButton })).toBeEnabled({ timeout: 30000 });
    await page.getByRole('button', { name: 'Mis personajes', exact: true }).click();

    // 1. Verify Clear Canvas button exists
    const clearBtn = page.getByRole('button', { name: /Limpiar lienzo/i });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // 2. Verify Expanded Color Palettes
    await expect(page.getByRole('button', { name: 'Neón & Fantasía' })).toBeVisible();
    await page.getByRole('button', { name: 'Neón & Fantasía' }).click();
    await expect(page.getByTitle('#d8f36a')).toBeVisible();

    // 3. Verify Freehand Mode toggle & Black brush non-destructive behavior
    const freehandToggle = page.getByRole('button', { name: /Trazo a mano alzada/i });
    await expect(freehandToggle).toBeVisible();
    await freehandToggle.click();
    const freehandCanvas = page.locator('canvas.freehand-editor');
    await expect(freehandCanvas).toBeVisible();

    // Select black color from Monocromo & Metales
    await page.getByRole('button', { name: 'Monocromo & Metales' }).click();
    await page.getByTitle('#000000').click();
    const box = await freehandCanvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 40, box.y + 40);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + 80);
      await page.mouse.up();
    }
    // Verify contour isolation button exists
    await expect(page.getByRole('button', { name: /Aislar contorno negro/i })).toBeVisible();

    // 4. Verify Sprite Movement Classification shelf in Pixel Art mode
    const pixelToggle = page.getByRole('button', { name: /Píxel por píxel/i });
    await pixelToggle.click();
    await expect(page.getByText('Clasificar para movimiento:')).toBeVisible();
    await expect(page.getByRole('button', { name: /Carrera/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Salto/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Agachado/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\+ Nuevo sprite/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Duplicar/i })).toBeVisible();

    // 5. Verify Photo Mode & Background removal tools
    await page.getByRole('button', { name: 'Fotografía', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles('public/icon-192.png');
    await expect(page.getByRole('button', { name: /Quitar fondo automático/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Varita Mágica/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Borrador/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Restaurar/i })).toBeVisible();
  });
});



