import type { BossConfig } from './types';

export type BossDifficulty = NonNullable<BossConfig['difficulty']>;

export const BOSS_DIFFICULTIES: Record<
  Exclude<BossDifficulty, 'custom'>,
  Pick<BossConfig, 'maxHealth' | 'health' | 'damage' | 'speed' | 'attackFrequency' | 'projectileSpeed'>
> = {
  easy: { maxHealth: 120, health: 120, damage: 1, speed: 105, attackFrequency: 3.4, projectileSpeed: 280 },
  normal: { maxHealth: 180, health: 180, damage: 1, speed: 145, attackFrequency: 2.4, projectileSpeed: 400 },
  hard: { maxHealth: 260, health: 260, damage: 2, speed: 195, attackFrequency: 1.8, projectileSpeed: 520 },
  legendary: { maxHealth: 350, health: 350, damage: 2, speed: 240, attackFrequency: 1.6, projectileSpeed: 620 },
};

export function createDefaultBoss(name = 'Guardián del Nivel'): BossConfig {
  return {
    id: crypto.randomUUID(),
    name,
    element: 'fire',
    size: 1.5,
    ...BOSS_DIFFICULTIES.normal,
    difficulty: 'normal',
    projectileType: 'fireball',
    weakness: 'water',
    resistance: 'fire',
  };
}

export function applyBossDifficulty(
  boss: BossConfig,
  difficulty: Exclude<BossDifficulty, 'custom'>,
): BossConfig {
  return { ...boss, ...BOSS_DIFFICULTIES[difficulty], difficulty };
}

export function validateBoss(boss: BossConfig): string | null {
  if (!boss.name.trim() || boss.name.trim().length > 64) return 'Ponle al jefe un nombre de hasta 64 caracteres.';
  const checks: Array<[number, number, number, string]> = [
    [boss.size, 0.5, 3, 'El tamaño del jefe debe estar entre 0,5 y 3.'],
    [boss.maxHealth, 60, 1000, 'La vida del jefe debe estar entre 60 y 1.000 HP.'],
    [boss.damage, 1, 3, 'El daño del jefe debe estar entre 1 y 3 corazones.'],
    [boss.speed, 45, 320, 'La velocidad del jefe debe estar entre 45 y 320.'],
    [boss.attackFrequency, 1.6, 6, 'El intervalo de disparo debe estar entre 1,6 y 6 segundos.'],
    [boss.projectileSpeed, 180, 800, 'La velocidad de disparo debe estar entre 180 y 800.'],
  ];
  for (const [value, minimum, maximum, message] of checks) {
    if (!Number.isFinite(value) || value < minimum || value > maximum) return message;
  }
  return null;
}
