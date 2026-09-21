import { describe, expect, it } from 'vitest';
import { generateProceduralLevel, OFFICIAL_LEVELS } from '../src/lib/procedural';
import { Simulation } from '../src/game/simulation';
import { getPowerEffectiveness } from '../src/lib/combat';
import type { WorldId, BossArchetype } from '../src/lib/types';

describe('Boss Archetypes and Scaling', () => {
  const worldArchetypes: Record<WorldId, BossArchetype> = {
    forest: 'treant',
    sunset: 'sphinx',
    night: 'void_dragon',
    neon: 'cyber_titan',
    alpine: 'frost_behemoth',
    volcano: 'magma_dragon',
  };

  it('assigns unique handcrafted boss archetypes and thematic elements across all 6 worlds', () => {
    (Object.keys(worldArchetypes) as WorldId[]).forEach((worldId) => {
      const config = OFFICIAL_LEVELS.find((l) => l.world === worldId && l.levelNumber === 3)!;
      expect(config).toBeDefined();
      const track = generateProceduralLevel(config);
      expect(track.boss).toBeDefined();
      expect(track.boss?.archetype).toBe(worldArchetypes[worldId]);
      expect(track.boss?.name).toBeTruthy();
      expect(track.boss?.maxHealth).toBeGreaterThan(0);
    });
  });

  it('scales boss difficulty and attributes across levels 1 to 3', () => {
    const c1 = OFFICIAL_LEVELS.find((l) => l.world === 'forest' && l.levelNumber === 1)!;
    const c2 = OFFICIAL_LEVELS.find((l) => l.world === 'forest' && l.levelNumber === 2)!;
    const c3 = OFFICIAL_LEVELS.find((l) => l.world === 'forest' && l.levelNumber === 3)!;

    const b1 = generateProceduralLevel(c1).boss!;
    const b2 = generateProceduralLevel(c2).boss!;
    const b3 = generateProceduralLevel(c3).boss!;

    expect(b1.maxHealth).toBeLessThan(b2.maxHealth);
    expect(b2.maxHealth).toBeLessThan(b3.maxHealth);
    expect(b1.size).toBeLessThan(b2.size);
    expect(b2.size).toBeLessThan(b3.size);
  });

  it('computes elemental effectiveness according to boss weakness and resistance', () => {
    const config = OFFICIAL_LEVELS.find((l) => l.world === 'volcano' && l.levelNumber === 3)!;
    const volcanoBoss = generateProceduralLevel(config).boss!;
    expect(volcanoBoss.element).toBe('fire');
    expect(volcanoBoss.weakness).toBe('water');
    expect(volcanoBoss.resistance).toBe('fire');

    // Water power vs Fire boss => Critical weakness
    expect(getPowerEffectiveness('water', volcanoBoss)).toBe('critical_weakness');

    // Fire power vs Fire boss => Very weak
    expect(getPowerEffectiveness('fire', volcanoBoss)).toBe('very_weak');

    // Cosmic power vs Fire boss => Normal
    expect(getPowerEffectiveness('cosmic', volcanoBoss)).toBe('normal');
  });

  it('exposes archetype, element, and attack telegraph state in simulation HUD snapshot', () => {
    const config = OFFICIAL_LEVELS.find((l) => l.world === 'alpine' && l.levelNumber === 1)!;
    const track = generateProceduralLevel(config);
    const sim = new Simulation(track);
    sim.start();

    // Fast-forward to near track end where boss encounter starts
    sim.distance = track.length - 80;
    sim.update(0.016);

    const hud = sim.hud();
    expect(hud.isBossFight).toBe(true);
    expect(hud.bossArchetype).toBe('frost_behemoth');
    expect(hud.bossElement).toBe('water');
    expect(hud.bossHealth).toBeDefined();
    expect(hud.bossMaxHealth).toBe(track.boss?.maxHealth);
    expect(hud.bossDefeated).toBe(false);
  });
});
