import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

async function fixture(page: import('@playwright/test').Page, failedSave: boolean) {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React, { useState } from 'react'; import { createRoot } from 'react-dom/client';
    import { GameView } from './src/components/game-view';
    const tracks = [0, 1].map(n => ({ id: 'level-' + n, name: 'Level ' + n, world: 'forest', length: 100, items: [] }));
    function Harness() {
      const [level, setLevel] = useState(0);
      return <GameView key={level} sessionId={String(level)} track={tracks[level]} autoStart={level > 0}
        campaign hasNextLevel={level === 0} character={{ id: 'test', name: 'Test', color: '#fff' }} reduced
        onClose={() => {}} onResult={async () => { ${failedSave ? "throw new Error('disk full');" : "await new Promise(resolve => setTimeout(resolve, 15000));"} }}
        onNextLevel={(power, collected) => { window.transitions = (window.transitions || 0) + 1; window.carried = { power, collected }; setLevel(1); }} />;
    }
    createRoot(document.getElementById('fixture')).render(<Harness />);
  ` }, bundle: true, write: false, format: 'iife', jsx: 'automatic', plugins: [{ name: 'engine-fixture', setup(builder) {
    builder.onResolve({ filter: /^@\/game\/engine$/ }, () => ({ path: 'engine', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export class GameEngine {
        simulation = { phase: 'PLAYING', activePowerId: 'leaf_storm' };
        constructor(canvas, track, character, reduced, onHud, onEnd) {
          window.finishRun = () => { this.simulation.phase = 'GAME_OVER'; onEnd({ id: track.id, trackId: track.id,
            trackName: track.name, distance: 10, coins: 0, perfects: 0, score: 10, won: true, date: 0, collectedPowers: ['leaf_storm'] }); };
        }
        start() { window.starts = (window.starts || 0) + 1; }
        setMoveAxis() {} destroy() {} pause() {} jump() {} slide() {} castPower() {}
      }
    ` }));
  } }] });
  await page.goto('/'); await page.setContent('<div id="fixture"></div>');
  await page.clock.install();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole('button', { name: '¡Comenzar Carrera!', exact: true }).click();
  await page.evaluate(() => (window as unknown as { finishRun: () => void }).finishRun());
  await expect(page.getByRole('heading', { name: '¡Nivel completado!', exact: true })).toBeVisible();
}
test('countdown advances once despite a slow save and stops at the final level', async ({ page }) => {
  await fixture(page, false);
  await page.clock.runFor(2900);
  expect(await page.evaluate(() => (window as unknown as { transitions?: number }).transitions ?? 0)).toBe(0);
  await page.clock.runFor(200);
  await expect.poll(() => page.evaluate(() => (window as unknown as { starts: number }).starts)).toBe(2);
  expect(await page.evaluate(() => (window as unknown as { carried: unknown }).carried)).toEqual({ power: 'leaf_storm', collected: ['leaf_storm'] });
  await expect(page.getByRole('button', { name: '¡Comenzar Carrera!', exact: true })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { finishRun: () => void }).finishRun());
  await expect(page.getByRole('heading', { name: '¡Aventura completada!', exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  expect(await page.evaluate(() => (window as unknown as { transitions: number }).transitions)).toBe(1);
});
test('cancel prevents automatic progression after a failed save', async ({ page }) => {
  await fixture(page, true);
  await expect(page.getByText('Error al guardar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.clock.runFor(5000);
  expect(await page.evaluate(() => (window as unknown as { transitions?: number }).transitions ?? 0)).toBe(0);
  await page.getByRole('button', { name: 'Otra aventura', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { starts: number }).starts)).toBe(2);
});
