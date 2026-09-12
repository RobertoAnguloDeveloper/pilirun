import { describe, expect, it } from 'vitest';
import { POWERS, type PowerId } from '../src/lib/combat';
import { obstacleDamage, segmentHit } from '../src/lib/obstacles';
import { mergeTracks, resolveLevelMusic, validateAudio, MAX_AUDIO_BYTES } from '../src/lib/music';
import { frameScale } from '../src/lib/sprite-geometry';
import { Simulation, STEP } from '../src/game/simulation';
import { DEFAULT_PREFERENCES, type Track, type AudioTrack, type TrackItem } from '../src/lib/types';
const track: Track = { id: 'test', name: 'Test', world: 'forest', length: 9000, items: [] };
const song = (id: string): AudioTrack => ({ id, name: id, mime: 'audio/wav', size: 10, duration: 3600, loopStart: 0, loopEnd: 3600 });
const bossTrack = (): Track => ({ ...track, boss: { id: 'boss', name: 'Boss', health: 1000, maxHealth: 1000, damage: 20, element: 'fire', size: 1, attackFrequency: 1, projectileSpeed: 300, projectileType: 'fireball', speed: 145, weakness: 'water', resistance: 'fire' } });
describe('music selection and compatibility', () => {
  it('explicit assignments outrank shuffle/category and saved worlds replace originals', () => {
    const saved = { ...track, levelMusicId: 'assigned' };
    expect(mergeTracks([track], [saved], [])).toEqual([saved]);
    const library = [song('assigned'), { ...song('random'), category: 'boss' as const }];
    expect(resolveLevelMusic(saved, library, { ...DEFAULT_PREFERENCES, jukeboxMode: 'shuffle', jukeboxCategory: 'boss' })?.id).toBe('assigned');
    expect(resolveLevelMusic(track, library, { ...DEFAULT_PREFERENCES, jukeboxMode: 'sequential' }, 1)?.id).toBe('random');
    expect(resolveLevelMusic({ ...track, levelMusicId: 'missing' }, library)).toBeUndefined();
  });
  it('accepts long audio without a duration cap and rejects invalid loops and excessive file size', () => {
    expect(() => validateAudio(song('hour'), new Blob(['test']))).not.toThrow();
    expect(() => validateAudio({ ...song('invalid'), loopEnd: 3601 }, new Blob(['test']))).toThrow();
    expect(() => validateAudio(song('huge'), { size: MAX_AUDIO_BYTES + 1 } as Blob)).toThrow(/100 MB/);
  });
});
describe('boss arena and obstacle combat', () => {
  it('allows both directions, latches pursuit on retreat, stops on release and protects checkpoint rewards', () => {
    const game = new Simulation(bossTrack()); game.start(); game.distance = 8300; game.update(STEP);
    const entry = game.distance; const time = game.time; const checkpoint = game.checkpoint;
    game.setMoveAxis(-1);
    for (let i = 0; i < 240; i++) game.update(STEP);
    expect(game.distance).toBeLessThan(entry - 500); expect(game.inBossFight).toBe(true);
    expect(game.checkpoint).toBe(checkpoint); expect(game.time).toBeLessThan(time);
    game.setMoveAxis(0); const stopped = game.distance; game.update(STEP); expect(game.distance).toBe(stopped);
    game.setMoveAxis(1); game.update(STEP); expect(game.distance).toBeGreaterThan(stopped);
    game.togglePause(); expect(game.moveAxis).toBe(0);
  });
  it('boss pursuit can close to contact and damage a stationary player', () => {
    const game = new Simulation(bossTrack()); game.start(); game.distance = 8300;
    const initialGap = game.bossEntity!.x - game.distance;
    for (let i = 0; i < 600 && game.lives === 3; i++) game.update(STEP);
    expect(Math.abs(game.bossEntity!.x - game.distance)).toBeLessThan(initialGap);
    expect(game.lives).toBeLessThan(3);
  });
  for (const material of ['wood', 'stone', 'indestructible'] as const) for (const power of Object.keys(POWERS) as PowerId[]) {
    it(`${power} obeys ${material} effectiveness`, () => {
      const allowed = material === 'wood' ? power !== 'aqua_shield' : material === 'stone' && ['thunder_dash', 'starlight_beam'].includes(power);
      expect(obstacleDamage({ id: 'obstacle', kind: 'log', x: 500, material }, power)).toBe(allowed ? POWERS[power].damage : 0);
    });
  }
  it.each([-1, 1])('sweeps fast projectiles in direction %s, accumulates damage and destroys once', (direction) => {
    const obstacle: TrackItem = { id: 'wood', kind: 'log', x: 400, width: 30, health: 60 };
    const game = new Simulation({ ...track, items: [obstacle] }); game.start();
    for (let shot = 0; shot < 3; shot++) {
      game.projectiles.push({ id: String(shot), sender: 'player', x: direction === 1 ? 200 : 600, y: 20, vx: direction * 50000, vy: 0, damage: 35, element: 'fire', type: 'flame_burst', size: 16, color: '#f00', life: 2 });
      game.update(STEP);
    }
    expect(game.destroyed.has('wood')).toBe(true);
    expect(game.destroyedObstacles.filter((item) => item.id === 'wood')).toHaveLength(1);
    expect(game.obstacleDurability.get('wood')).toBe(0);
  });
  it('does not hit a vertically separated obstacle', () => {
    expect(segmentHit(0, 100, 1000, 100, 100, 200, 0, 40)).toBe(Infinity);
  });
  it('frame scale is occurrence-specific and never changes collision scale', () => {
    const character = { id: 'sprite', name: 'Sprite', color: '#fff', frames: { run: ['same', 'same'] }, frameScales: { run: [0.25, 3] } };
    expect(frameScale(character, 'run', 0)).toBe(0.25); expect(frameScale(character, 'run', 1)).toBe(3);
    expect(frameScale(character, 'jump', 0)).toBe(1);
    const game = new Simulation(track); expect(game.characterScale).toBe(1);
  });
});
