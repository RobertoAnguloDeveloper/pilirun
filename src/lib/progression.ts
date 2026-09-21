import type { LevelProgress, LevelScoreRecord, RunResult, Track } from './types';
import type { PowerId } from './combat';

export const PROGRESSION_CACHE_KEY = 'pilirun_level_progress_v1';

export const DEFAULT_POWER_CHARGES: Record<PowerId, number> = {
  flame_burst: 10,
  aqua_shield: 5,
  leaf_storm: 5,
  thunder_dash: 5,
  starlight_beam: 5,
};

export const DEFAULT_LEVEL_PROGRESS: LevelProgress = {
  currentLevelIndex: 0,
  completedLevelIds: [],
  levelScores: {},
  characterLevel: 1,
  unlockedPowers: ['flame_burst'],
  totalStars: 0,
  coins: 50,
  powerCharges: { ...DEFAULT_POWER_CHARGES },
};

export interface StorePackage {
  id: string;
  powerId: PowerId;
  charges: number;
  cost: number;
  label: string;
}

export const POWER_STORE_CATALOG: StorePackage[] = [
  { id: 'flame_5', powerId: 'flame_burst', charges: 5, cost: 15, label: '+5 Ráfagas' },
  { id: 'flame_15', powerId: 'flame_burst', charges: 15, cost: 35, label: '+15 Ráfagas' },
  { id: 'aqua_5', powerId: 'aqua_shield', charges: 5, cost: 20, label: '+5 Burbujas' },
  { id: 'aqua_15', powerId: 'aqua_shield', charges: 15, cost: 45, label: '+15 Burbujas' },
  { id: 'leaf_5', powerId: 'leaf_storm', charges: 5, cost: 20, label: '+5 Tormentas' },
  { id: 'leaf_15', powerId: 'leaf_storm', charges: 15, cost: 45, label: '+15 Tormentas' },
  { id: 'thunder_5', powerId: 'thunder_dash', charges: 5, cost: 25, label: '+5 Rayos' },
  { id: 'thunder_15', powerId: 'thunder_dash', charges: 15, cost: 60, label: '+15 Rayos' },
  { id: 'star_5', powerId: 'starlight_beam', charges: 5, cost: 30, label: '+5 Haces' },
  { id: 'star_15', powerId: 'starlight_beam', charges: 15, cost: 75, label: '+15 Haces' },
];

export const POWER_UNLOCK_COSTS: Record<PowerId, number> = {
  flame_burst: 0,
  aqua_shield: 80,
  leaf_storm: 120,
  thunder_dash: 180,
  starlight_beam: 250,
};

/**
 * Calculates star rating (1 to 3) earned on a run.
 * 1 Star: Reaching the finish line / completing level
 * 2 Stars: High score (>= 1,500) OR defeating the boss
 * 3 Stars: Flawless/Mastery: (Boss defeated AND >= 1,800 score) OR (>= 2,800 score)
 */
export function calculateRunStars(run: RunResult): number {
  if (!run.won) return 0;
  let stars = 1;
  const hasBossBonus = Boolean(run.bossDefeated);
  const isHighScore = run.score >= 1500;
  const isFlawless = run.score >= 2800 || (hasBossBonus && run.score >= 1800);

  if (isFlawless) {
    stars = 3;
  } else if (hasBossBonus || isHighScore) {
    stars = 2;
  }
  return stars;
}

/**
 * Loads level progression synchronously from localStorage cache.
 * Falls back safely to DEFAULT_LEVEL_PROGRESS if cache is empty or corrupt.
 */
export function loadCachedLevelProgress(): LevelProgress {
  if (typeof window === 'undefined') return { ...DEFAULT_LEVEL_PROGRESS };
  try {
    const raw = window.localStorage.getItem(PROGRESSION_CACHE_KEY);
    if (!raw) return { ...DEFAULT_LEVEL_PROGRESS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_LEVEL_PROGRESS };

    const completedLevelIds = Array.isArray(parsed.completedLevelIds)
      ? parsed.completedLevelIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    const levelScores: Record<string, LevelScoreRecord> = {};
    if (parsed.levelScores && typeof parsed.levelScores === 'object') {
      for (const [key, val] of Object.entries(parsed.levelScores)) {
        if (val && typeof val === 'object') {
          const rec = val as Partial<LevelScoreRecord>;
          levelScores[key] = {
            completed: Boolean(rec.completed),
            stars: Math.max(0, Math.min(3, Number(rec.stars) || 0)),
            highScore: Math.max(0, Number(rec.highScore) || 0),
            bestDistance: Math.max(0, Number(rec.bestDistance) || 0),
            bossDefeated: Boolean(rec.bossDefeated),
            completedAt: typeof rec.completedAt === 'number' ? rec.completedAt : undefined,
          };
        }
      }
    }

    const characterLevel = Math.max(1, Math.min(20, Number(parsed.characterLevel) || 1));
    const currentLevelIndex = Math.max(0, Number(parsed.currentLevelIndex) || 0);
    const unlockedPowers = Array.isArray(parsed.unlockedPowers) && parsed.unlockedPowers.length > 0
      ? parsed.unlockedPowers.filter((p: unknown): p is string => typeof p === 'string')
      : ['flame_burst'];

    const totalStars = Object.values(levelScores).reduce((acc, cur) => acc + (cur.stars || 0), 0);
    const coins = typeof parsed.coins === 'number' && !Number.isNaN(parsed.coins)
      ? Math.max(0, parsed.coins)
      : 50;

    const powerCharges: Record<string, number> = { ...DEFAULT_POWER_CHARGES };
    if (parsed.powerCharges && typeof parsed.powerCharges === 'object') {
      for (const [k, v] of Object.entries(parsed.powerCharges)) {
        if (typeof v === 'number' && !Number.isNaN(v)) {
          powerCharges[k] = Math.max(0, v);
        }
      }
    }

    return {
      currentLevelIndex,
      completedLevelIds,
      levelScores,
      characterLevel,
      unlockedPowers,
      totalStars,
      coins,
      powerCharges,
    };
  } catch {
    return { ...DEFAULT_LEVEL_PROGRESS };
  }
}

/**
 * Persists level progression synchronously into localStorage cache.
 */
export function saveCachedLevelProgress(progress: LevelProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROGRESSION_CACHE_KEY, JSON.stringify(progress));
  } catch {
    // Storage quota or private browsing exceptions handled silently
  }
}

/**
 * Merges local and remote progression, preserving the highest records,
 * completed levels, stars, highest character level, and merged wallet & charges.
 */
export function mergeLevelProgress(
  local: LevelProgress,
  remote?: LevelProgress | null,
): LevelProgress {
  if (!remote) return local;

  const completedSet = new Set([...local.completedLevelIds, ...remote.completedLevelIds]);
  const levelScores: Record<string, LevelScoreRecord> = { ...local.levelScores };

  for (const [trackId, remoteRecord] of Object.entries(remote.levelScores || {})) {
    const localRecord = levelScores[trackId];
    if (!localRecord) {
      levelScores[trackId] = { ...remoteRecord };
    } else {
      levelScores[trackId] = {
        completed: localRecord.completed || remoteRecord.completed,
        stars: Math.max(localRecord.stars, remoteRecord.stars),
        highScore: Math.max(localRecord.highScore, remoteRecord.highScore),
        bestDistance: Math.max(localRecord.bestDistance, remoteRecord.bestDistance),
        bossDefeated: localRecord.bossDefeated || remoteRecord.bossDefeated,
        completedAt: Math.max(localRecord.completedAt || 0, remoteRecord.completedAt || 0) || undefined,
      };
    }
  }

  const characterLevel = Math.max(local.characterLevel || 1, remote.characterLevel || 1);
  const currentLevelIndex = Math.max(local.currentLevelIndex || 0, remote.currentLevelIndex || 0);
  const unlockedPowers = Array.from(new Set([
    ...(local.unlockedPowers || []),
    ...(remote.unlockedPowers || []),
  ]));
  if (!unlockedPowers.includes('flame_burst')) unlockedPowers.unshift('flame_burst');

  const totalStars = Object.values(levelScores).reduce((acc, cur) => acc + (cur.stars || 0), 0);
  const coins = Math.max(local.coins ?? 0, remote.coins ?? 0);

  const powerCharges: Record<string, number> = {
    ...DEFAULT_POWER_CHARGES,
    ...(local.powerCharges ?? {}),
  };
  if (remote.powerCharges) {
    for (const [k, v] of Object.entries(remote.powerCharges)) {
      powerCharges[k] = Math.max(powerCharges[k] ?? 0, v);
    }
  }

  return {
    currentLevelIndex,
    completedLevelIds: Array.from(completedSet),
    levelScores,
    characterLevel,
    unlockedPowers,
    totalStars,
    coins,
    powerCharges,
  };
}

/**
 * Updates progression when a run concludes (either victory or defeat).
 */
export function applyRunProgression(
  current: LevelProgress,
  run: RunResult,
  campaignSequence: string[],
  currentCumulativePowers: PowerId[] = [],
): LevelProgress {
  const starsEarned = calculateRunStars(run);
  const prevRecord = current.levelScores[run.trackId];

  const updatedRecord: LevelScoreRecord = {
    completed: Boolean(prevRecord?.completed || run.won),
    stars: Math.max(prevRecord?.stars || 0, starsEarned),
    highScore: Math.max(prevRecord?.highScore || 0, run.score),
    bestDistance: Math.max(prevRecord?.bestDistance || 0, run.distance),
    bossDefeated: Boolean(prevRecord?.bossDefeated || run.bossDefeated),
    completedAt: run.won ? Date.now() : prevRecord?.completedAt,
  };

  const newScores = {
    ...current.levelScores,
    [run.trackId]: updatedRecord,
  };

  const completedSet = new Set(current.completedLevelIds);
  if (run.won) {
    completedSet.add(run.trackId);
  }

  let nextIndex = current.currentLevelIndex;
  const seqIdx = campaignSequence.indexOf(run.trackId);
  if (run.won && seqIdx !== -1) {
    nextIndex = Math.max(current.currentLevelIndex, seqIdx + 1);
    if (nextIndex >= campaignSequence.length) {
      nextIndex = campaignSequence.length - 1;
    }
  }

  // Level up character on wins up to cap of 20
  let newCharLevel = current.characterLevel;
  if (run.won) {
    newCharLevel = Math.min(20, newCharLevel + 1);
  }

  // Retain all cumulative unlocked powers
  const combinedPowers = Array.from(new Set([
    ...current.unlockedPowers,
    ...currentCumulativePowers,
  ]));

  const totalStars = Object.values(newScores).reduce((acc, r) => acc + (r.stars || 0), 0);
  const updatedCoins = (current.coins ?? 0) + Math.max(0, run.coins || 0);

  const updated: LevelProgress = {
    currentLevelIndex: nextIndex,
    completedLevelIds: Array.from(completedSet),
    levelScores: newScores,
    characterLevel: newCharLevel,
    unlockedPowers: combinedPowers,
    totalStars,
    coins: updatedCoins,
    powerCharges: current.powerCharges ? { ...current.powerCharges } : { ...DEFAULT_POWER_CHARGES },
  };

  saveCachedLevelProgress(updated);
  return updated;
}

export function buyPowerCharges(
  progress: LevelProgress,
  powerId: PowerId,
  chargesToAdd: number,
  cost: number,
): { success: boolean; progress: LevelProgress; reason?: string } {
  const currentCoins = progress.coins ?? 0;
  if (currentCoins < cost) {
    return { success: false, progress, reason: '¡No tienes suficientes monedas!' };
  }
  const currentCharges = { ...(progress.powerCharges ?? DEFAULT_POWER_CHARGES) };
  currentCharges[powerId] = (currentCharges[powerId] ?? 0) + chargesToAdd;

  const updated: LevelProgress = {
    ...progress,
    coins: currentCoins - cost,
    powerCharges: currentCharges,
  };
  saveCachedLevelProgress(updated);
  return { success: true, progress: updated };
}

export function unlockPowerWithCoins(
  progress: LevelProgress,
  powerId: PowerId,
  cost: number,
): { success: boolean; progress: LevelProgress; reason?: string } {
  const currentCoins = progress.coins ?? 0;
  if (currentCoins < cost) {
    return { success: false, progress, reason: '¡No tienes suficientes monedas!' };
  }
  if (progress.unlockedPowers.includes(powerId)) {
    return { success: false, progress, reason: '¡Este poder ya está desbloqueado!' };
  }
  const currentCharges = { ...(progress.powerCharges ?? DEFAULT_POWER_CHARGES) };
  currentCharges[powerId] = Math.max(currentCharges[powerId] ?? 0, 5); // 5 free starter charges on unlock

  const updated: LevelProgress = {
    ...progress,
    coins: currentCoins - cost,
    unlockedPowers: [...progress.unlockedPowers, powerId],
    powerCharges: currentCharges,
  };
  saveCachedLevelProgress(updated);
  return { success: true, progress: updated };
}

export function addCoinsToProgress(progress: LevelProgress, amount: number): LevelProgress {
  const updated: LevelProgress = {
    ...progress,
    coins: Math.max(0, (progress.coins ?? 0) + amount),
  };
  saveCachedLevelProgress(updated);
  return updated;
}
