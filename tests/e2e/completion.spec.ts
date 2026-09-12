import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

test('saving a completed result cannot recreate the game; explicit retry can', async ({ page }) => {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'tsx',
      contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { GameView } from './src/components/game-view';
      const track = { id: 'finish', name: 'Finish', world: 'forest', length: 100, items: [] };
      function Harness() {
        const [saved, setSaved] = useState(0);
        return <><output aria-label="Saved results">{saved}</output><GameView track={track}
          character={{ id: 'test', name: 'Test', color: '#fff', scale: 1 + saved * 0.1 }}
          reduced={true} onClose={() => {}} onResult={async () => { setSaved(n => n + 1); }} /></>;
      }
      createRoot(document.getElementById('fixture')).render(<Harness />);
    `,
    },
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    plugins: [
      {
        name: 'controlled-engine',
        setup(builder) {
          builder.onResolve({ filter: /^@\/game\/engine$/ }, () => ({
            path: 'engine',
            namespace: 'fixture',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: `
        export class GameEngine {
          simulation = { phase: 'PLAYING' };
          constructor(canvas, track, character, reduced, onHud, onEnd) {
            window.finishRun = () => { this.simulation.phase = 'GAME_OVER'; onEnd({ id: 'result', trackId: track.id,
              trackName: track.name, distance: 10, coins: 0, perfects: 0, score: 10, won: true, date: 0 }); };
          }
          start() { window.runStarts = (window.runStarts || 0) + 1; }
          setMoveAxis() {} destroy() {} pause() {} jump() {} slide() {} castPower() {}
        }
      `,
          }));
        },
      },
    ],
  });
  await page.goto('/');
  await page.setContent('<div id="fixture"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole('button', { name: '¡Comenzar Carrera!', exact: true }).click();
  const starts = () => page.evaluate(() => (window as unknown as { runStarts: number }).runStarts);
  await expect.poll(starts).toBe(1);
  await page.evaluate(() => (window as unknown as { finishRun: () => void }).finishRun());
  await expect(page.getByLabel('Saved results')).toHaveText('1');
  await expect(page.getByText('Carrera guardada', { exact: true })).toBeVisible();
  expect(await starts()).toBe(1);
  await page.getByRole('button', { name: 'Otra aventura', exact: true }).click();
  await expect.poll(starts).toBe(2);
});
