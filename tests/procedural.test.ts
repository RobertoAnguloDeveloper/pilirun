import { describe, expect, it } from 'vitest';
import {
  createRNG,
  hashString,
  OFFICIAL_LEVELS,
  generateProceduralLevel,
  validateLevelPlayability,
} from '../src/lib/procedural';
import { validateTrack } from '../src/lib/worlds';
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
