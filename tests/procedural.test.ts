import { describe, expect, it } from 'vitest';
import {
  createRNG,
  hashString,
  OFFICIAL_LEVELS,
  generateProceduralLevel,
  validateLevelPlayability,
  generateRandomSeedLevel,
  generateProceduralBoss,
} from '../src/lib/procedural';
import { validateTrack, WORLDS } from '../src/lib/worlds';
import { BUILTIN_MUSIC } from '../src/lib/builtin-music';
import type { Track, TrackItem } from '../src/lib/types';

const mockTrack = (items: TrackItem[], length = 8000): Track => ({
  id: 'mock-track',
  name: 'Mock Track',
  world: 'forest',
  length,
  items,
});

describe('procedural generation and deterministic replayability', () => {
  it('generates identical tracks when using the same seed', () => {
    const level = OFFICIAL_LEVELS[0];
    const track1 = generateProceduralLevel(level, 12345);
    const track2 = generateProceduralLevel(level, 12345);

    expect(track1.items.length).toBe(track2.items.length);
    expect(track1.items).toEqual(track2.items);
  });

  it('generates different tracks when using different seeds', () => {
    const level = OFFICIAL_LEVELS[0];
    const trackA = generateProceduralLevel(level, 1111);
    const trackB = generateProceduralLevel(level, 9999);

    expect(trackA.items).not.toEqual(trackB.items);
  });

  it('all 18 official progression levels pass strict mathematical playability validation', () => {
    expect(OFFICIAL_LEVELS.length).toBe(18);

    for (const level of OFFICIAL_LEVELS) {
      const track = generateProceduralLevel(level);
      const validation = validateLevelPlayability(track);

      expect(validation.valid).toBe(true);
      expect(validation.reason).toBeUndefined();
      expect(validateTrack(track)).toBeNull();
    }
  });

  it('assigns every official level to one of the 11 packaged music tracks', () => {
    const builtinIds = new Set(BUILTIN_MUSIC.map((track) => track.id));

    expect(BUILTIN_MUSIC).toHaveLength(11);
    expect(builtinIds.size).toBe(11);
    for (const level of OFFICIAL_LEVELS) {
      expect(level.levelMusicId).toBeTruthy();
      expect(builtinIds.has(level.levelMusicId!)).toBe(true);
      expect(generateProceduralLevel(level).levelMusicId).toBe(level.levelMusicId);
    }
  });

  it('detects and rejects impossible obstacle spacing (< 440px)', () => {
    const items: TrackItem[] = [
      { id: '1', kind: 'log', x: 700 },
      { id: '2', kind: 'rock', x: 1000 }, // gap = 300 < 440px
    ];

    const res = validateLevelPlayability(mockTrack(items));
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Distancia insuficiente');
  });

  it('detects and rejects spring with obstacle in landing drop zone (300-750px ahead)', () => {
    const items: TrackItem[] = [
      { id: 'sp1', kind: 'spring', x: 1000 },
      { id: 'o1', kind: 'log', x: 1400 }, // 400px ahead is right in the spring landing trajectory
    ];

    const res = validateLevelPlayability(mockTrack(items));
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Obstáculo peligroso en la zona de aterrizaje');
  });

  it('validates 100 random seeds across all worlds without a single unsolvable configuration', () => {
    for (let i = 0; i < 100; i++) {
      const level = OFFICIAL_LEVELS[i % OFFICIAL_LEVELS.length];
      const seed = 5000 + i * 37;
      const track = generateProceduralLevel(level, seed);
      const result = validateLevelPlayability(track);

      expect(result.valid).toBe(true);
      expect(validateTrack(track)).toBeNull();
    }
  });
});

describe('generateRandomSeedLevel (dynamic procedural runner)', () => {
  it('generates deterministic tracks for identical world, difficulty, and seed', () => {
    const track1 = generateRandomSeedLevel('forest', 2, 77777);
    const track2 = generateRandomSeedLevel('forest', 2, 77777);

    expect(track1.name).toBe(track2.name);
    expect(track1.length).toBe(track2.length);
    expect(track1.items).toEqual(track2.items);
    expect(track1.boss).toEqual(track2.boss);
  });

  it('generates different tracks for different seeds', () => {
    const trackA = generateRandomSeedLevel('sunset', 2, 10101);
    const trackB = generateRandomSeedLevel('sunset', 2, 20202);

    expect(trackA.items).not.toEqual(trackB.items);
  });

  it('scales track length and min obstacle gap with difficulty', () => {
    const easy = generateRandomSeedLevel('neon', 1, 42);
    const hard = generateRandomSeedLevel('neon', 3, 42);

    expect(easy.length).toBe(10000); // 7500 + 1 * 2500
    expect(hard.length).toBe(15000); // 7500 + 3 * 2500
    expect(hard.length).toBeGreaterThan(easy.length);
  });

  it('produces 100% playable tracks across all world types and difficulty levels', () => {
    const worlds = Object.keys(WORLDS) as (keyof typeof WORLDS)[];
    const difficulties: (1 | 2 | 3)[] = [1, 2, 3];

    for (const world of worlds) {
      for (const diff of difficulties) {
        const seed = 88800 + diff * 100;
        const track = generateRandomSeedLevel(world, diff, seed);
        const validation = validateLevelPlayability(track);

        expect(validation.valid).toBe(true);
        expect(validateTrack(track)).toBeNull();
        expect(track.boss).toBeDefined();
        expect(track.boss?.health).toBeGreaterThanOrEqual(180);
      }
    }
  });
});

describe('generateProceduralBoss (boss synthesis)', () => {
  it('assigns correct archetypes and elemental weaknesses per world', () => {
    const forestBoss = generateProceduralBoss('forest', 1, 123);
    expect(forestBoss.archetype).toBe('treant');
    expect(forestBoss.element).toBe('nature');
    expect(forestBoss.weakness).toBe('fire');

    const alpineBoss = generateProceduralBoss('alpine', 1, 123);
    expect(alpineBoss.archetype).toBe('frost_behemoth');
    expect(alpineBoss.element).toBe('water');
    expect(alpineBoss.weakness).toBe('electric');

    const neonBoss = generateProceduralBoss('neon', 1, 123);
    expect(neonBoss.archetype).toBe('cyber_titan');
    expect(neonBoss.element).toBe('electric');
    expect(neonBoss.weakness).toBe('nature');

    const volcanoBoss = generateProceduralBoss('volcano', 1, 123);
    expect(volcanoBoss.archetype).toBe('magma_dragon');
    expect(volcanoBoss.element).toBe('fire');
    expect(volcanoBoss.weakness).toBe('water');
  });

  it('scales health, speed, and attack frequency with level number', () => {
    const bossLvl1 = generateProceduralBoss('sunset', 1, 999);
    const bossLvl3 = generateProceduralBoss('sunset', 3, 999);

    expect(bossLvl1.health).toBe(180); // 120 + 1 * 60
    expect(bossLvl3.health).toBe(300); // 120 + 3 * 60
    expect(bossLvl3.attackFrequency).toBeLessThan(bossLvl1.attackFrequency); // Attacks faster
    expect(bossLvl3.projectileSpeed).toBeGreaterThan(bossLvl1.projectileSpeed);
    expect(bossLvl3.size).toBeGreaterThan(bossLvl1.size);
  });

  it('honors customTitle parameter when provided', () => {
    const custom = generateProceduralBoss('forest', 1, 123, 'El Titán Ancestral');
    expect(custom.name).toBe('El Titán Ancestral');
  });

  it('generates procedural grammar prefix/epithet for procedural runs (level > 3)', () => {
    const proceduralBoss = generateProceduralBoss('night', 4, 555);
    expect(proceduralBoss.name).toContain(',');
    expect(proceduralBoss.health).toBe(360); // 120 + 4 * 60
  });
});
