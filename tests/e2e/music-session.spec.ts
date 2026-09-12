import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

test('delayed music cannot block movement or replace newer sessions; boss music restores level music', async ({ page }) => {
  const bundle = await build({ stdin: { contents: `export { GameEngine } from './src/game/engine';`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', globalName: 'MusicSession', plugins: [{ name: 'controlled-music', setup(builder) {
    builder.onResolve({ filter: /lib\/(storage|audio)$/ }, args => ({ path: args.path.endsWith('storage') ? 'storage' : 'audio', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'storage' ? `
      export const localStore = { request: ({ id }) => new Promise((resolve, reject) => {
        window.pendingMusic ??= {}; window.pendingMusic[id] = { resolve: () => resolve(new Blob(['test'])), reject };
      }) };
    ` : `export const audioEngine = { stop() {}, pause() {}, resume: async () => {}, effect() {},
      play: async source => { (window.playedMusic ??= []).push(source?.track.id ?? 'default'); } };` }));
  } }] });
  await page.goto('/');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const state = window as unknown as {
      MusicSession: { GameEngine: typeof import('../../src/game/engine').GameEngine };
      pendingMusic: Record<string, { resolve: () => void; reject: (e: Error) => void }>;
      playedMusic: string[];
    };
    const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:960px;height:430px'; document.body.append(canvas);
    const track: import('../../src/lib/types').Track = { id: 'test', name: 'Test', world: 'forest', length: 9000, items: [], boss: {
      id: 'boss', name: 'Boss', health: 100, maxHealth: 100, damage: 20, element: 'fire', size: 1, attackFrequency: 3, projectileSpeed: 300, projectileType: 'fireball', speed: 145, weakness: 'water', resistance: 'fire',
    } };
    const song = (id: string) => ({ id, name: id, mime: 'audio/wav', size: 4, duration: 600, loopStart: 0, loopEnd: 600 });
    const errors: string[] = [];
    const create = (id: string) => new state.MusicSession.GameEngine(canvas, track, { id: 'test', name: 'Test', color: '#fff' }, true, () => {}, () => {}, undefined, undefined, [], undefined, undefined, undefined, undefined, [], song(id), song('boss'), message => errors.push(message));
    const wait = async (condition: () => boolean) => {
      const deadline = performance.now() + 4000;
      while (!condition()) { if (performance.now() > deadline) throw new Error('Music transition did not occur'); await new Promise(requestAnimationFrame); }
    };
    const old = create('old'); old.start(); old.destroy();
    const current = create('level'); current.start();
    await wait(() => current.simulation.distance > 10);
    const movedWhileLoading = current.simulation.distance > 0;
    state.pendingMusic.level.resolve(); await wait(() => state.playedMusic?.includes('level'));
    state.pendingMusic.old.resolve(); await new Promise(requestAnimationFrame);
    current.simulation.distance = 8300;
    await wait(() => !!state.pendingMusic.boss);
    state.pendingMusic.boss.resolve(); await wait(() => state.playedMusic.includes('boss'));
    current.simulation.bossEntity!.defeated = true;
    const previousRequest = state.pendingMusic.level;
    await wait(() => state.pendingMusic.level !== previousRequest);
    state.pendingMusic.level.resolve(); await wait(() => state.playedMusic.length === 3);
    current.destroy();
    return { movedWhileLoading, music: state.playedMusic, errors };
  });
  expect(result).toEqual({ movedWhileLoading: true, music: ['level', 'boss', 'level'], errors: [] });
});
