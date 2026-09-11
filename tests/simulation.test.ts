import { describe, expect, it } from 'vitest';
import { Simulation, STEP, SPEED } from '../src/game/simulation';
import { TRACKS, validateTrack } from '../src/lib/worlds';
import type { Track } from '../src/lib/types';
const empty = (): Track => ({ id: 'test', name: 'Test', world: 'forest', length: 9000, items: [] });
function advance(game: Simulation, seconds: number) {
  for (let n = 0; n < Math.round(seconds / STEP); n++) game.update(STEP);
}
describe('runner physics and progression', () => {
  it('covers equal distance at 30, 60 and 120 display frames per second', () => {
    const distances = [30, 60, 120].map((fps) => {
      const game = new Simulation(empty());
      game.start();
      let accumulator = 0;
      for (let n = 0; n < fps * 10; n++) {
        accumulator += 1 / fps;
        while (accumulator + 1e-10 >= STEP) {
          game.update(STEP);
          accumulator -= STEP;
        }
      }
      return game.distance;
    });
    distances.forEach((distance) => expect(distance).toBeCloseTo(SPEED * 10, 6));
  });
  it('allows two jumps, rejects a third, then resets on landing', () => {
    const game = new Simulation(empty());
    game.start();
    game.jump();
    advance(game, 0.2);
    game.jump();
    expect(game.jumps).toBe(2);
    const velocity = game.velocity;
    game.jump();
    expect(game.velocity).toBe(velocity);
    advance(game, 2);
    expect(game.height).toBe(0);
    expect(game.jumps).toBe(0);
  });
  it('does not consume time or move while paused', () => {
    const game = new Simulation(empty());
    game.start();
    advance(game, 1);
    game.togglePause();
    const before = game.hud();
    advance(game, 8);
    expect(game.hud()).toEqual(before);
  });
  it('hits a log once, but clears it when jumping', () => {
    const track = { ...empty(), items: [{ id: 'log', x: 600, kind: 'log' as const }] };
    const hit = new Simulation(track);
    hit.start();
    advance(hit, 3);
    expect(hit.lives).toBe(2);
    expect(hit.perfects).toBe(0);
    const safe = new Simulation(track);
    safe.start();
    advance(safe, 1.8);
    safe.jump();
    advance(safe, 1.2);
    expect(safe.lives).toBe(3);
    expect(safe.perfects).toBe(1);
  });
  it('ducks under branches without losing a heart', () => {
    const game = new Simulation({ ...empty(), items: [{ id: 'branch', x: 600, kind: 'branch' }] });
    game.start();
    advance(game, 1.95);
    game.duck();
    advance(game, 1);
    expect(game.lives).toBe(3);
    expect(game.perfects).toBe(1);
  });
  it('grants five seconds exactly once at a checkpoint', () => {
    const game = new Simulation(empty());
    game.start();
    const initial = game.time;
    advance(game, 11);
    expect(game.checkpoint).toBe(1);
    expect(game.time).toBeCloseTo(initial - 11 + 5, 5);
  });
  it('shield absorbs collisions and expires with simulation time', () => {
    const game = new Simulation({
      ...empty(),
      items: [
        { id: 'shield', x: 450, kind: 'shield' },
        { id: 'log', x: 600, kind: 'log' },
      ],
    });
    game.start();
    advance(game, 3);
    expect(game.lives).toBe(3);
    expect(game.shield).toBeGreaterThan(0);
    advance(game, 6);
    expect(game.shield).toBe(0);
  });
  it('finishes at the exact endpoint and stops moving', () => {
    const game = new Simulation({ ...empty(), length: 3000 });
    game.start();
    advance(game, 12);
    expect(game.phase).toBe('GAME_OVER');
    expect(game.result().won).toBe(true);
    expect(game.distance).toBe(3000);
    const time = game.time;
    advance(game, 3);
    expect(game.time).toBe(time);
  });
  it('expires a run when its timer runs out', () => {
    const game = new Simulation(empty());
    game.start();
    game.time = 0.1;
    advance(game, 1);
    expect(game.phase).toBe('GAME_OVER');
    expect(game.result().won).toBe(false);
  });
  it('breaks the shield streak after damage without erasing career perfects', () => {
    const game = new Simulation({ ...empty(), items: [{ id: 'log', x: 600, kind: 'log' }] });
    game.perfects = 2;
    game.streak = 2;
    game.start();
    advance(game, 3);
    expect(game.streak).toBe(0);
    expect(game.perfects).toBe(2);
    expect(game.shield).toBe(0);
  });
  it('keeps cleared obstacles in the world without consuming them when safely avoided', () => {
    const track = { ...empty(), items: [{ id: 'passed-rock', x: 500, kind: 'rock' as const }] };
    const game = new Simulation(track);
    game.start();
    advance(game, 1.5);
    game.jump();
    advance(game, 1.5);
    // Character jumped over rock and is far past it
    expect(game.distance).toBeGreaterThan(600);
    // Obstacle must NOT be consumed, staying permanently in the 3D world
    expect(game.consumed.has('passed-rock')).toBe(false);
    expect(game.cleared.has('passed-rock')).toBe(true);
    expect(game.lives).toBe(3);
  });
  it('decreases health and energy and triggers hit recoil when colliding with an obstacle', () => {
    const track = { ...empty(), items: [{ id: 'log-hit', x: 500, kind: 'log' as const }] };
    const game = new Simulation(track);
    game.start();
    const initialEnergy = game.energy;
    advance(game, 1.8); // Hits log around 1.7s
    expect(game.lives).toBe(2);
    expect(game.energy).toBeLessThan(initialEnergy);
    expect(game.consumed.has('log-hit')).toBe(true);
    expect(game.hurt).toBeGreaterThan(0);
    expect(game.shake).toBeGreaterThan(0);
  });
  it('propels player vertically when hitting a vertical spring pad', () => {
    const track = { ...empty(), items: [{ id: 'spring-1', x: 450, kind: 'spring' as const }] };
    const game = new Simulation(track);
    game.start();
    advance(game, 1.58);
    expect(game.consumed.has('spring-1')).toBe(true);
    expect(game.height).toBeGreaterThan(0);
  });
  it('toggles camera mode between side and first-person view', () => {
    const game = new Simulation(empty());
    expect(game.cameraView).toBe('side');
    game.toggleCameraView();
    expect(game.cameraView).toBe('first_person');
    game.toggleCameraView();
    expect(game.cameraView).toBe('side');
  });
});
describe('playable track validation', () => {
  it('accepts all 6 built-in worlds', () => {
    expect(TRACKS.length).toBe(6);
    TRACKS.forEach((track) => expect(validateTrack(track)).toBeNull());
  });
  it('rejects impossible obstacle spacing and invalid positions', () => {
    expect(
      validateTrack({
        ...empty(),
        items: [
          { id: 'a', kind: 'rock', x: 600 },
          { id: 'b', kind: 'branch', x: 700 },
        ],
      }),
    ).toContain('Separa');
    expect(validateTrack({ ...empty(), items: [{ id: 'a', kind: 'coin', x: NaN }] })).toContain(
      'espacio',
    );
  });
  it('allows coins around obstacles while enforcing safe start and finish', () => {
    expect(
      validateTrack({
        ...empty(),
        items: [
          { id: 'a', kind: 'log', x: 600 },
          { id: 'b', kind: 'coin', x: 620 },
        ],
      }),
    ).toBeNull();
    expect(validateTrack({ ...empty(), items: [{ id: 'a', kind: 'rock', x: 50 }] })).not.toBeNull();
    expect(validateTrack({ ...empty(), name: '' })).not.toBeNull();
  });
});
