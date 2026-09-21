import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateRunStars,
  DEFAULT_LEVEL_PROGRESS,
  mergeLevelProgress,
  applyRunProgression,
  loadCachedLevelProgress,
  saveCachedLevelProgress,
  PROGRESSION_CACHE_KEY,
} from '../src/lib/progression';
import type { LevelProgress, RunResult } from '../src/lib/types';

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
};

(globalThis as any).window = {
  localStorage: localStorageMock,
};

describe('Level Progression & Cache Persistence', () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it('calculates stars correctly based on win, boss defeat, and score thresholds', () => {
    const loss: RunResult = {
      id: 'run-1',
      trackId: 'forest-1',
      trackName: 'Primeros Senderos',
      distance: 3000,
      coins: 20,
      perfects: 2,
      score: 800,
      won: false,
      date: Date.now(),
    };
    expect(calculateRunStars(loss)).toBe(0);

    const simpleWin: RunResult = {
      ...loss,
      won: true,
      score: 1100,
    };
    expect(calculateRunStars(simpleWin)).toBe(1);

    const bossWin: RunResult = {
      ...loss,
      won: true,
      score: 1400,
      bossDefeated: true,
    };
    expect(calculateRunStars(bossWin)).toBe(2);

    const highScoreWin: RunResult = {
      ...loss,
      won: true,
      score: 1600,
    };
    expect(calculateRunStars(highScoreWin)).toBe(2);

    const masteryWin: RunResult = {
      ...loss,
      won: true,
      score: 2900,
    };
    expect(calculateRunStars(masteryWin)).toBe(3);

    const bossMasteryWin: RunResult = {
      ...loss,
      won: true,
      score: 1900,
      bossDefeated: true,
    };
    expect(calculateRunStars(bossMasteryWin)).toBe(3);
  });

  it('applies run progression, increments character level, and advances campaign index', () => {
    const initial: LevelProgress = { ...DEFAULT_LEVEL_PROGRESS };
    const sequence = ['forest-1', 'forest-2', 'forest-3'];

    const winRun: RunResult = {
      id: 'run-win',
      trackId: 'forest-1',
      trackName: 'Primeros Senderos',
      distance: 7000,
      coins: 45,
      perfects: 5,
      score: 2100,
      won: true,
      date: Date.now(),
      bossDefeated: true,
    };

    const updated = applyRunProgression(initial, winRun, sequence, ['aqua_shield']);

    expect(updated.completedLevelIds).toContain('forest-1');
    expect(updated.currentLevelIndex).toBe(1);
    expect(updated.characterLevel).toBe(2);
    expect(updated.totalStars).toBeGreaterThanOrEqual(2);
    expect(updated.unlockedPowers).toContain('flame_burst');
    expect(updated.unlockedPowers).toContain('aqua_shield');
    expect(updated.levelScores['forest-1']?.completed).toBe(true);
  });

  it('persists and loads level progression synchronously from localStorage', () => {
    const progress: LevelProgress = {
      currentLevelIndex: 2,
      completedLevelIds: ['forest-1', 'forest-2'],
      levelScores: {
        'forest-1': {
          completed: true,
          stars: 3,
          highScore: 3200,
          bestDistance: 7000,
          bossDefeated: true,
        },
      },
      characterLevel: 5,
      unlockedPowers: ['flame_burst', 'thunder_dash'],
      totalStars: 3,
    };

    saveCachedLevelProgress(progress);

    const reloaded = loadCachedLevelProgress();
    expect(reloaded.currentLevelIndex).toBe(2);
    expect(reloaded.completedLevelIds).toEqual(['forest-1', 'forest-2']);
    expect(reloaded.characterLevel).toBe(5);
    expect(reloaded.unlockedPowers).toContain('thunder_dash');
    expect(reloaded.levelScores['forest-1']?.stars).toBe(3);
  });

  it('merges local and remote progress keeping the highest records', () => {
    const local: LevelProgress = {
      currentLevelIndex: 1,
      completedLevelIds: ['forest-1'],
      levelScores: {
        'forest-1': {
          completed: true,
          stars: 2,
          highScore: 2000,
          bestDistance: 7000,
        },
      },
      characterLevel: 3,
      unlockedPowers: ['flame_burst', 'aqua_shield'],
      totalStars: 2,
    };

    const remote: LevelProgress = {
      currentLevelIndex: 3,
      completedLevelIds: ['forest-1', 'forest-2', 'forest-3'],
      levelScores: {
        'forest-1': {
          completed: true,
          stars: 3,
          highScore: 2500,
          bestDistance: 7000,
        },
        'forest-2': {
          completed: true,
          stars: 2,
          highScore: 1800,
          bestDistance: 8000,
        },
      },
      characterLevel: 6,
      unlockedPowers: ['flame_burst', 'thunder_dash'],
      totalStars: 5,
    };

    const merged = mergeLevelProgress(local, remote);
    expect(merged.characterLevel).toBe(6);
    expect(merged.currentLevelIndex).toBe(3);
    expect(merged.completedLevelIds).toContain('forest-1');
    expect(merged.completedLevelIds).toContain('forest-2');
    expect(merged.completedLevelIds).toContain('forest-3');
    expect(merged.levelScores['forest-1']?.stars).toBe(3);
    expect(merged.levelScores['forest-1']?.highScore).toBe(2500);
    expect(merged.unlockedPowers).toContain('aqua_shield');
    expect(merged.unlockedPowers).toContain('thunder_dash');
  });
});
