import { writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function wav(seconds: number) {
  const rate = 8000, samples = rate * seconds;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
test('long music imports fully, overrides a built-in world, resumes and remains offline', async ({ page, context }, testInfo) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const state = window as unknown as { media: HTMLAudioElement[]; fullDecodes: number };
    state.media = []; state.fullDecodes = 0;
    const OriginalAudio = window.Audio;
    window.Audio = new Proxy(OriginalAudio, { construct(target, args) {
      const audio = Reflect.construct(target, args) as HTMLAudioElement; state.media.push(audio); return audio;
    } });
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (...args: Parameters<typeof decode>) {
      state.fullDecodes++; return decode.apply(this, args);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /JUGAR AHORA|Vamos a correr/i })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Mi música', exact: true }).click();
  for (const duration of [181, 600, 3600]) {
    const file = testInfo.outputPath(`Long ${duration}.wav`);
    await writeFile(file, wav(duration));
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.getByLabel('Fin (s)', { exact: true })).toHaveValue(String(duration), { timeout: 30000 });
    await page.getByRole('button', { name: 'Guardar audio', exact: true }).click();
    await expect(page.getByRole('button', { name: `Reproducir Long ${duration}`, exact: true })).toBeVisible({ timeout: 30000 });
  }
  expect(await page.evaluate(() => (window as unknown as { fullDecodes: number }).fullDecodes)).toBe(0);
  await page.getByRole('button', { name: 'Explorar mundos', exact: true }).click();
  const worldCount = await page.locator('.world-card').count();
  await page.getByTitle('Configurar música para este nivel y jefe').first().click();
  const value = await page.getByLabel('Música del Nivel (Recorrido)', { exact: true }).locator('option').filter({ hasText: 'Long 600' }).getAttribute('value');
  await page.getByLabel('Música del Nivel (Recorrido)', { exact: true }).selectOption(value!);
  const violations = await new AxeBuilder({ page }).include('.modal-backdrop').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations.violations).toEqual([]);
  await page.getByRole('button', { name: 'Guardar y Cerrar', exact: true }).click();
  await expect(page.getByText('Configuración musical del nivel guardada.')).toBeVisible();
  await expect(page.locator('.world-card')).toHaveCount(worldCount);
  await page.reload();
  await expect(page.getByRole('button', { name: /JUGAR AHORA|Vamos a correr/i })).toBeEnabled({ timeout: 30000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /JUGAR AHORA|Vamos a correr/i })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: /JUGAR AHORA|Vamos a correr/i }).click();
  await page.getByRole('button', { name: '¡Comenzar Carrera!', exact: true }).click();
  const current = () => page.evaluate(() => {
    const media = (window as unknown as { media: HTMLAudioElement[] }).media.find((audio) => !audio.paused && audio.currentSrc.startsWith('blob:'));
    return media ? { duration: media.duration, time: media.currentTime } : null;
  });
  await expect.poll(async () => (await current())?.duration).toBe(600);
  await expect.poll(async () => (await current())?.time ?? 0).toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const paused = await page.evaluate(() => (window as unknown as { media: HTMLAudioElement[] }).media.find((audio) => audio.duration === 600 && audio.src.startsWith('blob:'))?.currentTime ?? 0);
  await page.getByRole('button', { name: /Reanudar \[P\]/ }).click();
  await expect.poll(async () => (await current())?.duration).toBe(600);
  expect((await current())!.time).toBeGreaterThanOrEqual(paused);
  expect(errors).toEqual([]);
});
