import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

test('gameplay sprite feet and collision top agree across scale, zoom, crouch and jump', async ({
  page,
}) => {
  // Exercise the actual renderer and simulation in a browser without production debug hooks.
  const bundle = await build({
    stdin: {
      contents: `export { Renderer } from './src/game/renderer'; export { Simulation } from './src/game/simulation';`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'GroundingTest',
  });
  await page.goto('/');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const values = await page.evaluate(async () => {
    const api = (
      window as unknown as {
        GroundingTest: {
          Renderer: typeof import('../../src/game/renderer').Renderer;
          Simulation: typeof import('../../src/game/simulation').Simulation;
        };
      }
    ).GroundingTest;
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 500;
    const ctx = canvas.getContext('2d')!;
    const source = document.createElement('canvas');
    source.width = 80;
    source.height = 100;
    const brush = source.getContext('2d')!;
    brush.fillStyle = '#ff00ff';
    brush.fillRect(30, 10, 20, 60);
    const url = source.toDataURL();
    const game = new api.Simulation(
      { id: 'ground', name: 'Ground', world: 'forest', length: 9000, items: [] },
      undefined,
      undefined,
      undefined,
      2,
    );
    const renderer = new api.Renderer(ctx, {
      id: 'sprite',
      name: 'Sprite',
      color: '#ff00ff',
      image: url,
      scale: 2,
    });
    game.start();
    game.stats.auraLevel = 0;
    // Wait on image readiness, not a fixed delay.
    const image = (renderer as unknown as { image: HTMLImageElement }).image;
    await image.decode();
    const results = [];
    for (const [scale, zoom, slide, height] of [
      [1, 1, 0, 0],
      [2, 1, 0, 0],
      [0.5, 1.5, 0.3, 0],
      [1.5, 1, 0, 100],
    ]) {
      game.setCharacterScale(scale);
      game.setCameraZoom(zoom);
      game.slide = slide;
      game.height = height;
      renderer.render(game, 960, 500, true);
      const pixels = ctx.getImageData(0, 0, 960, 500).data;
      let top = 500,
        bottom = -1;
      for (let y = 0; y < 500; y++)
        for (let x = 0; x < 960; x++) {
          const i = (y * 960 + x) * 4;
          if (pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 255) {
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      const baseline = 500 * 0.79 - height * zoom;
      results.push({
        top,
        bottom: bottom + 1,
        baseline,
        expectedTop: baseline - (slide > 0 ? 32 : 58) * scale * zoom,
      });
    }
    renderer.destroy();
    // Small displays and minimum zoom used to produce a negative boss core radius,
    // throwing from Canvas and terminating the animation loop.
    const bossGame = new api.Simulation({ id: 'boss', name: 'Boss', world: 'forest', length: 1000, items: [], boss: {
      id: 'boss', name: 'Boss', health: 100, maxHealth: 100, damage: 20, element: 'fire', size: 0.5,
      attackFrequency: 1, projectileSpeed: 300, projectileType: 'fireball', speed: 145, weakness: 'water', resistance: 'fire',
    } });
    const bossRenderer = new api.Renderer(ctx, { id: 'test', name: 'Test', color: '#fff' });
    bossGame.start();
    bossGame.setCameraZoom(0.5);
    for (let frame = 0; frame < 120; frame++) {
      bossGame.elapsed = frame / 60;
      bossRenderer.render(bossGame, 320, 100, true);
    }
    bossRenderer.destroy();
    return results;
  });
  for (const result of values) {
    expect(Math.abs(result.bottom - result.baseline)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.top - result.expectedTop)).toBeLessThanOrEqual(1);
  }
});
