export type ElementType = 'fire' | 'water' | 'nature' | 'electric' | 'cosmic' | 'light';

export type PowerId = 'flame_burst' | 'aqua_shield' | 'leaf_storm' | 'thunder_dash' | 'starlight_beam';

export type PowerEffectiveness =
  | 'very_weak'
  | 'weak'
  | 'normal'
  | 'effective'
  | 'very_effective'
  | 'critical_weakness';

export const EFFECTIVENESS_MULTIPLIERS: Record<PowerEffectiveness, number> = {
  very_weak: 0.5,
  weak: 0.75,
  normal: 1.0,
  effective: 1.25,
  very_effective: 1.5,
  critical_weakness: 2.0,
};

export const EFFECTIVENESS_LABELS: Record<PowerEffectiveness, { label: string; color: string; badge: string }> = {
  very_weak: { label: 'Muy Débil', color: '#f87171', badge: '✕ Muy Débil' },
  weak: { label: 'Poco Efectivo', color: '#fb923c', badge: '△ Poco Efectivo' },
  normal: { label: 'Normal', color: '#94a3b8', badge: '— Normal' },
  effective: { label: 'Efectivo', color: '#38bdf8', badge: '✓ Efectivo' },
  very_effective: { label: '¡Muy Efectivo!', color: '#4ade80', badge: '★ ¡Muy Efectivo!' },
  critical_weakness: { label: '¡Debilidad Crítica!', color: '#a855f7', badge: '⚡ ¡SÚPER CRÍTICO!' },
};

export interface Power {
  id: PowerId;
  name: string;
  description: string;
  element: ElementType;
  icon: string;
  damage: number;
  speed: number;
  energyCost: number;
  cooldown: number; // in seconds
  range: number;
  color: string;
  glowColor: string;
}

export const POWERS: Record<PowerId, Power> = {
  flame_burst: {
    id: 'flame_burst',
    name: 'Ráfaga de Fuego',
    description: 'Lanza esferas ígneas directas de gran impacto abrasador.',
    element: 'fire',
    icon: '🔥',
    damage: 35,
    speed: 550,
    energyCost: 20,
    cooldown: 0.5,
    range: 900,
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.65)',
  },
  aqua_shield: {
    id: 'aqua_shield',
    name: 'Burbuja de Agua',
    description: 'Despliega una onda acuática protectora que daña y disuelve proyectiles.',
    element: 'water',
    icon: '💧',
    damage: 25,
    speed: 480,
    energyCost: 15,
    cooldown: 0.6,
    range: 850,
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.65)',
  },
  leaf_storm: {
    id: 'leaf_storm',
    name: 'Tormenta de Hojas',
    description: 'Dispara un vórtice cortante de pétalos afilados con amplio alcance.',
    element: 'nature',
    icon: '🍃',
    damage: 28,
    speed: 520,
    energyCost: 18,
    cooldown: 0.45,
    range: 950,
    color: '#84cc16',
    glowColor: 'rgba(132, 204, 22, 0.65)',
  },
  thunder_dash: {
    id: 'thunder_dash',
    name: 'Rayo Veloz',
    description: 'Relámpago instantáneo que atraviesa las defensas del enemigo.',
    element: 'electric',
    icon: '⚡',
    damage: 42,
    speed: 720,
    energyCost: 28,
    cooldown: 0.75,
    range: 1100,
    color: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.75)',
  },
  starlight_beam: {
    id: 'starlight_beam',
    name: 'Rayo Estelar',
    description: 'Haz de energía cósmica pura que concentra el poder del universo.',
    element: 'cosmic',
    icon: '✨',
    damage: 48,
    speed: 680,
    energyCost: 32,
    cooldown: 0.9,
    range: 1200,
    color: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.8)',
  },
};

export interface CharacterStats {
  level: number;
  strength: number; // 10 - 100
  speed: number; // 290 - 360
  maxEnergy: number; // 100 - 250
  auraLevel: number; // 1 - 6
}

export function calculateCharacterStats(level: number): CharacterStats {
  const clampedLevel = Math.max(1, Math.min(20, Math.floor(level)));
  const strength = Math.round(15 + Math.pow(clampedLevel - 1, 1.15) * 4.2);
  const speed = Math.round(290 + (clampedLevel - 1) * 3.5);
  const maxEnergy = Math.round(100 + (clampedLevel - 1) * 7.5);
  const auraLevel = Math.min(6, Math.max(1, Math.floor(1 + (clampedLevel - 1) / 3)));
  return {
    level: clampedLevel,
    strength: Math.min(100, strength),
    speed: Math.min(360, speed),
    maxEnergy: Math.min(250, maxEnergy),
    auraLevel,
  };
}

export interface BossConfig {
  id: string;
  name: string;
  element: ElementType;
  size: number; // 1.0 (small), 1.5 (medium), 2.2 (giant)
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  attackFrequency: number; // seconds between attacks (e.g. 2.2)
  projectileType: 'fireball' | 'ice_spike' | 'boulder' | 'lightning_orb' | 'star_beam';
  projectileSpeed: number;
  weakness: ElementType;
  resistance: ElementType;
}

export const ELEMENT_RELATIONS: Record<ElementType, { strongAgainst: ElementType; weakAgainst: ElementType }> = {
  fire: { strongAgainst: 'nature', weakAgainst: 'water' },
  water: { strongAgainst: 'fire', weakAgainst: 'electric' },
  nature: { strongAgainst: 'water', weakAgainst: 'fire' },
  electric: { strongAgainst: 'water', weakAgainst: 'nature' },
  cosmic: { strongAgainst: 'electric', weakAgainst: 'light' },
  light: { strongAgainst: 'cosmic', weakAgainst: 'nature' },
};

export function getPowerEffectiveness(powerElement: ElementType, boss: BossConfig): PowerEffectiveness {
  if (boss.weakness === powerElement) return 'critical_weakness';
  if (boss.resistance === powerElement) return 'very_weak';
  const rel = ELEMENT_RELATIONS[powerElement];
  if (rel?.strongAgainst === boss.element) return 'very_effective';
  if (rel?.weakAgainst === boss.element) return 'weak';
  if (powerElement === boss.element) return 'weak';
  return 'normal';
}

export function calculateDamage(
  power: Power,
  playerStrength: number,
  boss: BossConfig,
  environmentalModifier = 1.0,
): number {
  const effectiveness = getPowerEffectiveness(power.element, boss);
  const multiplier = EFFECTIVENESS_MULTIPLIERS[effectiveness];
  const strengthBonus = 1 + (playerStrength - 15) * 0.008;
  return Math.round(power.damage * multiplier * strengthBonus * environmentalModifier);
}

/**
 * Validates whether a Boss can be realistically defeated by the player
 */
export function validateBossSolvability(
  boss: BossConfig,
  stats: CharacterStats,
  availablePowers: Power[],
): { solvable: boolean; reason?: string; bestPower?: Power; estimatedHits: number } {
  if (!availablePowers || availablePowers.length === 0) {
    return { solvable: false, reason: 'El jugador no posee ningún poder equipado.', estimatedHits: Infinity };
  }

  let minHitsNeeded = Infinity;
  let bestPower: Power | undefined;

  for (const p of availablePowers) {
    const dmg = calculateDamage(p, stats.strength, boss);
    if (dmg <= 0) continue;
    const hits = Math.ceil(boss.maxHealth / dmg);
    if (hits < minHitsNeeded) {
      minHitsNeeded = hits;
      bestPower = p;
    }
  }

  if (minHitsNeeded === Infinity) {
    return { solvable: false, reason: 'Ningún poder disponible causa daño al jefe.', estimatedHits: Infinity };
  }

  // A boss should require at most 25 hits with the best power to remain fun and solvable for a 6+ child
  if (minHitsNeeded > 25) {
    return {
      solvable: false,
      reason: `El jefe tiene demasiada vida (${boss.maxHealth} HP). Requiere ${minHitsNeeded} impactos.`,
      estimatedHits: minHitsNeeded,
      bestPower,
    };
  }

  return { solvable: true, bestPower, estimatedHits: minHitsNeeded };
}
