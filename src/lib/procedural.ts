import type { ItemKind, Track, TrackItem, WorldId } from './types';
import { WORLDS } from './worlds';
import { SPEED, JUMP, GRAVITY } from '../game/simulation';

/**
 * Deterministic PRNG using Mulberry32 algorithm
 */
export function createRNG(seed: number) {
  let s = Math.floor(seed) >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface LevelConfig {
  id: string;
  world: WorldId;
  levelNumber: number; // 1, 2, 3
  title: string;
  subtitle: string;
  length: number;
  baseSeed: number;
  minObstacleGap: number;
  allowVerticals: boolean;
  density: number; // 0.6 - 1.2
  /** ID of the builtin music track assigned to this level. */
  levelMusicId?: string;
}

/**
 * 18 Official Progression Levels across 6 Worlds (3 levels per world)
 */
export const OFFICIAL_LEVELS: LevelConfig[] = [
  // World 1: Bosque Susurro (Tutorial / Easy)
  {
    id: 'forest-1',
    world: 'forest',
    levelNumber: 1,
    title: 'Nivel 1-1: Primeros Senderos',
    subtitle: 'Aprende los saltos básicos entre la arboleda.',
    length: 7000,
    baseSeed: 101,
    minObstacleGap: 620,
    allowVerticals: false,
    density: 0.75,
    levelMusicId: 'bmg-bounding-through-the-blooms',
  },
  {
    id: 'forest-2',
    world: 'forest',
    levelNumber: 2,
    title: 'Nivel 1-2: Pasos Agachados',
    subtitle: 'Ramas bajas que exigen reflejos al deslizarse.',
    length: 8500,
    baseSeed: 102,
    minObstacleGap: 560,
    allowVerticals: false,
    density: 0.85,
    levelMusicId: 'bmg-a-window-facing-west',
  },
  {
    id: 'forest-3',
    world: 'forest',
    levelNumber: 3,
    title: 'Nivel 1-3: La Frontera del Bosque',
    subtitle: 'Ritmo constante antes de alcanzar las dunas.',
    length: 10000,
    baseSeed: 103,
    minObstacleGap: 520,
    allowVerticals: false,
    density: 0.95,
    levelMusicId: 'bmg-bounding-through-the-blooms',
  },

  // World 2: Dunas del Sol (Intermediate)
  {
    id: 'sunset-1',
    world: 'sunset',
    levelNumber: 1,
    title: 'Nivel 2-1: Arena Cálida',
    subtitle: 'Senderos dorados con dobles saltos en secuencia.',
    length: 9000,
    baseSeed: 201,
    minObstacleGap: 520,
    allowVerticals: false,
    density: 0.9,
    levelMusicId: 'bmg-star-collectors-dash',
  },
  {
    id: 'sunset-2',
    world: 'sunset',
    levelNumber: 2,
    title: 'Nivel 2-2: Oasis Oculto',
    subtitle: 'Cadenas de monedas y obstáculos combinados.',
    length: 11000,
    baseSeed: 202,
    minObstacleGap: 490,
    allowVerticals: false,
    density: 1.0,
    levelMusicId: 'bmg-the-grand-leap-upwards',
  },
  {
    id: 'sunset-3',
    world: 'sunset',
    levelNumber: 3,
    title: 'Nivel 2-3: Viento del Ocaso',
    subtitle: 'Reflejos rápidos hacia la noche.',
    length: 12500,
    baseSeed: 203,
    minObstacleGap: 470,
    allowVerticals: false,
    density: 1.05,
    levelMusicId: 'bmg-star-collectors-dash',
  },

  // World 3: Valle Lunar (Challenging)
  {
    id: 'night-1',
    world: 'night',
    levelNumber: 1,
    title: 'Nivel 3-1: Claroscuro',
    subtitle: 'Navega en la penumbra con precisión milimétrica.',
    length: 10000,
    baseSeed: 301,
    minObstacleGap: 480,
    allowVerticals: false,
    density: 1.0,
    levelMusicId: 'bmg-the-last-harpsichord',
  },
  {
    id: 'night-2',
    world: 'night',
    levelNumber: 2,
    title: 'Nivel 3-2: Nebulosa Azul',
    subtitle: 'Tramas complejas de ramas y rocas.',
    length: 12000,
    baseSeed: 302,
    minObstacleGap: 460,
    allowVerticals: false,
    density: 1.1,
    levelMusicId: 'bmg-climbing-the-spire',
  },
  {
    id: 'night-3',
    world: 'night',
    levelNumber: 3,
    title: 'Nivel 3-3: Horizonte Estelar',
    subtitle: 'Dominio de salto y deslizamiento alternado.',
    length: 14000,
    baseSeed: 303,
    minObstacleGap: 450,
    allowVerticals: false,
    density: 1.15,
    levelMusicId: 'bmg-the-last-harpsichord',
  },

  // World 4: Metrópolis Neón (Verticality + Speed)
  {
    id: 'neon-1',
    world: 'neon',
    levelNumber: 1,
    title: 'Nivel 4-1: Calle Cyber',
    subtitle: 'Introducción a resortes verticales y anillos de impulso.',
    length: 11000,
    baseSeed: 401,
    minObstacleGap: 500,
    allowVerticals: true,
    density: 1.0,
    levelMusicId: 'bmg-high-score-sprint',
  },
  {
    id: 'neon-2',
    world: 'neon',
    levelNumber: 2,
    title: 'Nivel 4-2: Autopista de Cristal',
    subtitle: 'Trayectorias aéreas de alta velocidad.',
    length: 13500,
    baseSeed: 402,
    minObstacleGap: 470,
    allowVerticals: true,
    density: 1.1,
    levelMusicId: 'bmg-sprint-to-the-final-gate',
  },
  {
    id: 'neon-3',
    world: 'neon',
    levelNumber: 3,
    title: 'Nivel 4-3: Vértigo Lumínico',
    subtitle: 'Acrobacias extremas entre los rascacielos.',
    length: 15500,
    baseSeed: 403,
    minObstacleGap: 450,
    allowVerticals: true,
    density: 1.15,
    levelMusicId: 'bmg-high-score-sprint',
  },

  // World 5: Cumbres Celestes (Extreme Acrobatics)
  {
    id: 'alpine-1',
    world: 'alpine',
    levelNumber: 1,
    title: 'Nivel 5-1: Sendero Nevado',
    subtitle: 'Impulsos verticales sobre precipicios helados.',
    length: 12000,
    baseSeed: 501,
    minObstacleGap: 490,
    allowVerticals: true,
    density: 1.05,
    levelMusicId: 'bmg-the-crowns-last-round',
  },
  {
    id: 'alpine-2',
    world: 'alpine',
    levelNumber: 2,
    title: 'Nivel 5-2: Islas de Escarcha',
    subtitle: 'Riesgo y recompensas flotantes.',
    length: 14500,
    baseSeed: 502,
    minObstacleGap: 470,
    allowVerticals: true,
    density: 1.1,
    levelMusicId: 'bmg-marching-toward-the-final-gate',
  },
  {
    id: 'alpine-3',
    world: 'alpine',
    levelNumber: 3,
    title: 'Nivel 5-3: Pico Glacial',
    subtitle: 'La prueba definitiva del salto sincronizado.',
    length: 16500,
    baseSeed: 503,
    minObstacleGap: 450,
    allowVerticals: true,
    density: 1.2,
    levelMusicId: 'bmg-the-crowns-last-round',
  },

  // World 6: Cráter Ígneo (Maximum Master Challenge)
  {
    id: 'volcano-1',
    world: 'volcano',
    levelNumber: 1,
    title: 'Nivel 6-1: Río de Lava',
    subtitle: 'Obstáculos implacables y reflejos rápidos.',
    length: 13000,
    baseSeed: 601,
    minObstacleGap: 480,
    allowVerticals: true,
    density: 1.1,
    levelMusicId: 'bmg-showdown-at-the-clockwork-spire',
  },
  {
    id: 'volcano-2',
    world: 'volcano',
    levelNumber: 2,
    title: 'Nivel 6-2: Geiser Abrasador',
    subtitle: 'Grandes saltos parabólicos sobre zonas de peligro.',
    length: 15500,
    baseSeed: 602,
    minObstacleGap: 460,
    allowVerticals: true,
    density: 1.15,
    levelMusicId: 'bmg-showdown-at-the-clockwork-spire',
  },
  {
    id: 'volcano-3',
    world: 'volcano',
    levelNumber: 3,
    title: 'Nivel 6-3: Corazón Magmático',
    subtitle: 'El desafío final de PiliRun: velocidad y temple supremo.',
    length: 18000,
    baseSeed: 603,
    minObstacleGap: 450,
    allowVerticals: true,
    density: 1.2,
    levelMusicId: 'bmg-showdown-at-the-clockwork-spire',
  },
];

/**
 * Validates level mathematical transitability and safety rules:
 * 1. Safe zone at start (>= 500) and finish (>= 350)
 * 2. Minimum ground obstacle spacing (>= 440px) to guarantee jump recovery
 * 3. Spring landing safety: no obstacle inside 300px - 750px landing envelope of spring
 * 4. Coin & power-up height reachability
 */
export function validateLevelPlayability(track: Track): { valid: boolean; reason?: string } {
  if (track.items.length === 0) {
    return { valid: false, reason: 'Pista vacía sin elementos.' };
  }

  // 1. Safe zones
  for (const item of track.items) {
    if (['log', 'rock', 'branch', 'drone', 'golem'].includes(item.kind)) {
      if (item.x < 500) {
        return {
          valid: false,
          reason: `Obstáculo demasiado cercano al inicio (${item.x}px < 500px).`,
        };
      }
      if (item.x > track.length - 350) {
        return { valid: false, reason: `Obstáculo demasiado cercano a la meta (${item.x}px).` };
      }
    }
  }

  // 2. Obstacle spacing & overlap
  const obstacles = track.items
    .filter((item) => ['log', 'rock', 'branch', 'drone', 'golem'].includes(item.kind))
    .sort((a, b) => a.x - b.x);

  for (let i = 0; i < obstacles.length - 1; i++) {
    const curr = obstacles[i];
    const next = obstacles[i + 1];
    const dist = next.x - curr.x;

    // Minimum physical reaction & jump recovery distance
    if (dist < 440) {
      return {
        valid: false,
        reason: `Distancia insuficiente entre obstáculos ${curr.kind}@${curr.x} y ${next.kind}@${next.x} (${dist}px < 440px).`,
      };
    }
  }

  // 3. Spring landing safety
  const springs = track.items.filter((item) => item.kind === 'spring');
  for (const sp of springs) {
    const dangerousLanding = obstacles.find(
      (o) => o.x > sp.x + 300 && o.x < sp.x + 750 && ['log', 'rock', 'golem'].includes(o.kind),
    );
    if (dangerousLanding) {
      return {
        valid: false,
        reason: `Obstáculo peligroso en la zona de aterrizaje del resorte (${dangerousLanding.x}px).`,
      };
    }
  }

  // 4. Vertical reachability of coins
  for (const item of track.items) {
    if (item.y !== undefined && item.y > 320) {
      return { valid: false, reason: `Elemento a altura inalcanzable (${item.y}px > 320px).` };
    }
  }

  return { valid: true };
}

/**
 * Procedural generation algorithm for a level with controlled randomness
 */
function attemptGeneration(config: LevelConfig, seed: number): Track {
  const rng = createRNG(seed);
  const items: TrackItem[] = [];
  const length = config.length;
  let cursorX = 650;
  let itemId = 0;

  while (cursorX < length - 500) {
    const roll = rng();

    if (config.allowVerticals && roll < 0.22 && cursorX < length - 1200) {
      // Spring pattern
      const springX = Math.round(cursorX);
      items.push({ id: `sp-${itemId++}`, x: springX, kind: 'spring' });

      // Arc of high coins
      for (let c = 1; c <= 4; c++) {
        items.push({
          id: `spc-${itemId++}`,
          x: Math.round(springX + c * 100),
          kind: 'coin',
          y: Math.round(110 + Math.sin((c / 5) * Math.PI) * 70),
        });
      }

      // Air boost ring at apex
      if (rng() > 0.35) {
        items.push({
          id: `rg-${itemId++}`,
          x: Math.round(springX + 280),
          kind: 'ring',
          y: 150,
        });
      }

      cursorX += 850 + Math.round(rng() * 200);
      continue;
    }

    if (roll < 0.55) {
      // Ground challenge: log, rock, or heavy armored golem
      const subRoll = rng();
      const kind = subRoll < 0.35 ? 'log' : subRoll < 0.7 ? 'rock' : 'golem';
      const obsX = Math.round(cursorX);
      items.push({ id: `obs-${itemId++}`, x: obsX, kind });

      // Coin approach / parabola
      for (let c = -2; c <= 2; c++) {
        if (c === 0) continue;
        items.push({
          id: `cn-${itemId++}`,
          x: Math.round(obsX + c * 60),
          kind: 'coin',
          y: Math.round(c === 0 ? 80 : 45),
        });
      }

      const gap = Math.max(config.minObstacleGap, Math.round(config.minObstacleGap + rng() * 220));
      cursorX += gap;
      continue;
    }

    if (roll < 0.85) {
      // Upper aerial challenge: overhead branch or hovering technological drone
      const subRoll = rng();
      const kind = subRoll < 0.55 ? 'branch' : 'drone';
      const obsX = Math.round(cursorX);
      items.push({ id: `air-${itemId++}`, x: obsX, kind, y: kind === 'drone' ? 55 : 47 });

      // Low ground coins that reward ducking / sliding underneath
      for (let c = -1; c <= 2; c++) {
        items.push({
          id: `sc-${itemId++}`,
          x: Math.round(obsX + c * 50),
          kind: 'coin',
          y: 20,
        });
      }

      const gap = Math.max(config.minObstacleGap, Math.round(config.minObstacleGap + rng() * 200));
      cursorX += gap;
      continue;
    }

    // Powerup / power-orb / coin run corridor
    const powerRoll = rng();
    let pKind: ItemKind;
    if (powerRoll < 0.25) {
      const powers: ItemKind[] = [
        'power_fire',
        'power_water',
        'power_leaf',
        'power_thunder',
        'power_star',
      ];
      pKind = powers[Math.floor(rng() * powers.length)];
    } else {
      pKind = rng() > 0.6 ? 'shield' : rng() > 0.5 ? 'boost' : 'time';
    }
    items.push({
      id: `pw-${itemId++}`,
      x: Math.round(cursorX + 80),
      kind: pKind,
    });

    for (let c = 0; c < 3; c++) {
      items.push({
        id: `pwc-${itemId++}`,
        x: Math.round(cursorX + 160 + c * 55),
        kind: 'coin',
      });
    }

    cursorX += Math.max(config.minObstacleGap, 520 + Math.round(rng() * 150));
  }

  // Create official Boss for the level
  const bossElement =
    config.world === 'volcano'
      ? 'fire'
      : config.world === 'alpine'
        ? 'water'
        : config.world === 'forest'
          ? 'nature'
          : config.world === 'neon'
            ? 'electric'
            : config.world === 'night'
              ? 'cosmic'
              : 'fire';

  const weakness =
    bossElement === 'fire'
      ? 'water'
      : bossElement === 'water'
        ? 'electric'
        : bossElement === 'nature'
          ? 'fire'
          : bossElement === 'electric'
            ? 'nature'
            : bossElement === 'cosmic'
              ? 'light'
              : 'nature';

  return {
    id: config.id,
    name: config.title,
    world: config.world,
    length: config.length,
    items: items.sort((a, b) => a.x - b.x),
    levelMusicId: config.levelMusicId,
    boss: {
      id: `boss-${config.id}`,
      name: `Guardián de ${config.title}`,
      element: bossElement,
      size: config.levelNumber === 3 ? 2.0 : config.levelNumber === 2 ? 1.5 : 1.2,
      health: 120 + config.levelNumber * 60,
      maxHealth: 120 + config.levelNumber * 60,
      damage: 1,
      speed: 300,
      attackFrequency: Math.max(1.8, 3.0 - config.levelNumber * 0.3),
      projectileType:
        bossElement === 'fire'
          ? 'fireball'
          : bossElement === 'water'
            ? 'ice_spike'
            : bossElement === 'electric'
              ? 'lightning_orb'
              : 'boulder',
      projectileSpeed: 380 + config.levelNumber * 25,
      weakness,
      resistance: bossElement,
    },
  };
}

/**
 * Creates a pre-verified, guaranteed-safe fallback track for a level
 */
function createSafeFallback(config: LevelConfig): Track {
  const items: TrackItem[] = [];
  let id = 0;
  const gap = Math.max(560, config.minObstacleGap);
  for (let x = 700; x < config.length - 500; x += gap) {
    const kind: ItemKind = id % 3 === 2 ? 'branch' : id % 3 === 1 ? 'rock' : 'log';
    items.push({ id: `fb-${id++}`, x, kind });
    items.push({ id: `fbc-${id++}`, x: x - 80, kind: 'coin' });
    items.push({ id: `fbc-${id++}`, x: x + 80, kind: 'coin' });
    if (id % 5 === 0) {
      items.push({ id: `fbp-${id++}`, x: x + Math.round(gap * 0.5), kind: 'shield' });
    }
  }
  return {
    id: config.id,
    name: config.title,
    world: config.world,
    length: config.length,
    items: items.sort((a, b) => a.x - b.x),
    levelMusicId: config.levelMusicId,
  };
}

/**
 * Two-stage Procedural Generation Engine:
 * 1. Generation with deterministic PRNG from seed
 * 2. Pre-play mathematical validation
 * 3. Re-generation with derived seed on failure (up to 5 attempts)
 * 4. Guaranteed pre-validated safe fallback on repeated rejection
 */
export function generateProceduralLevel(config: LevelConfig, customSeed?: number): Track {
  const baseSeed = customSeed ?? config.baseSeed;
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const currentSeed = (baseSeed + attempt * 1013904223) >>> 0;
    const candidate = attemptGeneration(config, currentSeed);
    const result = validateLevelPlayability(candidate);
    if (result.valid) {
      return candidate;
    }
  }

  // Fallback to verified safe layout if all attempts fail validation
  return createSafeFallback(config);
}
