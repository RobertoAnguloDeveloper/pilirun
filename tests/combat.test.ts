import { describe, it, expect } from 'vitest';
import {
  POWERS,
  calculateCharacterStats,
  calculateDamage,
  getPowerEffectiveness,
  validateBossSolvability,
  type BossConfig,
} from '../src/lib/combat';
import {
  TIME_PERIODS,
  getTimeOfDayFromHour,
  getCurrentDeviceTimeOfDay,
} from '../src/lib/environment';

describe('Character Progression and Combat System', () => {
  it('calculates progressing character stats and evolving anime auras', () => {
    const lvl1 = calculateCharacterStats(1);
    expect(lvl1.level).toBe(1);
    expect(lvl1.strength).toBe(15);
    expect(lvl1.speed).toBe(290);
    expect(lvl1.maxEnergy).toBe(100);
    expect(lvl1.auraLevel).toBe(1);

    const lvl5 = calculateCharacterStats(5);
    expect(lvl5.strength).toBeGreaterThan(lvl1.strength);
    expect(lvl5.speed).toBeGreaterThan(lvl1.speed);
    expect(lvl5.maxEnergy).toBeGreaterThan(lvl1.maxEnergy);
    expect(lvl5.auraLevel).toBe(2);

    const lvl10 = calculateCharacterStats(10);
    expect(lvl10.auraLevel).toBeGreaterThanOrEqual(3);
  });

  it('evaluates power effectiveness and critical weaknesses correctly', () => {
    const fireBoss: BossConfig = {
      id: 'test-fire-boss',
      name: 'Salamandra Ígnea',
      element: 'fire',
      size: 1.5,
      health: 200,
      maxHealth: 200,
      damage: 1,
      speed: 300,
      attackFrequency: 2.5,
      projectileType: 'fireball',
      projectileSpeed: 400,
      weakness: 'water',
      resistance: 'fire',
    };

    // Water against Fire boss is critical weakness
    expect(getPowerEffectiveness('water', fireBoss)).toBe('critical_weakness');
    // Fire against Fire boss is very weak
    expect(getPowerEffectiveness('fire', fireBoss)).toBe('very_weak');
    // Cosmic against Fire boss is normal
    expect(getPowerEffectiveness('cosmic', fireBoss)).toBe('normal');

    const waterDmg = calculateDamage(POWERS.aqua_shield, 15, fireBoss);
    const fireDmg = calculateDamage(POWERS.flame_burst, 15, fireBoss);
    expect(waterDmg).toBeGreaterThan(fireDmg);
  });

  it('validates boss solvability mathematically', () => {
    const solvableBoss: BossConfig = {
      id: 'solvable',
      name: 'Jefe Accesible',
      element: 'nature',
      size: 1.5,
      health: 150,
      maxHealth: 150,
      damage: 1,
      speed: 300,
      attackFrequency: 2.5,
      projectileType: 'boulder',
      projectileSpeed: 400,
      weakness: 'fire',
      resistance: 'nature',
    };

    const stats = calculateCharacterStats(1);
    const result = validateBossSolvability(solvableBoss, stats, Object.values(POWERS));
    expect(result.solvable).toBe(true);
    expect(result.bestPower?.element).toBe('fire');
    expect(result.estimatedHits).toBeLessThanOrEqual(25);
  });
});

describe('Dynamic Time-of-Day and Environment System', () => {
  it('covers all 8 predefined time periods correctly', () => {
    expect(getTimeOfDayFromHour(2)).toBe('late_night');
    expect(getTimeOfDayFromHour(6)).toBe('dawn');
    expect(getTimeOfDayFromHour(9)).toBe('morning');
    expect(getTimeOfDayFromHour(12)).toBe('midday');
    expect(getTimeOfDayFromHour(15)).toBe('afternoon');
    expect(getTimeOfDayFromHour(18)).toBe('sunset');
    expect(getTimeOfDayFromHour(20)).toBe('dusk');
    expect(getTimeOfDayFromHour(22)).toBe('night');
  });

  it('provides environmental modifiers for solar and lunar powers', () => {
    const midday = TIME_PERIODS.midday;
    expect(midday.sunMoonType).toBe('sun');
    expect(midday.solarModifier).toBeGreaterThan(1.0);
    expect(midday.starAlpha).toBe(0);

    const lateNight = TIME_PERIODS.late_night;
    expect(lateNight.sunMoonType).toBe('moon');
    expect(lateNight.lunarModifier).toBeGreaterThan(1.0);
    expect(lateNight.starAlpha).toBeGreaterThan(0.8);
  });

  it('retrieves local device time-of-day gracefully', () => {
    const deviceTime = getCurrentDeviceTimeOfDay();
    expect(deviceTime.timeOfDay).toBeDefined();
    expect(deviceTime.currentHour).toBeGreaterThanOrEqual(0);
    expect(deviceTime.currentHour).toBeLessThanOrEqual(24);
  });
});
