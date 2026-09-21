import type { BossArchetype, BossConfig, ItemKind, Track, TrackItem, WorldId } from './types';
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

export const WORLD_BOSS_NAMES: Record<WorldId, [string, string, string]> = {
  forest: ['Brote Centinela', 'Guardián Floreciente', 'Silvanus, Titán Arbóreo'],
  sunset: ['Centinela Solar', 'Esfinge de las Dunas', 'Solarius, Fénix del Ocaso'],
  night: ['Espectro Lunar', 'Guardián Astral', 'Nocturna, Dragón del Vacío'],
  neon: ['Cyber-Dron Alfa', 'Vanguardia Neón', 'Overdrive-X, Titán Cyber'],
  alpine: ['Centinela Helado', 'Wyrm de Escarcha', 'Glacior, Behemoth Polar'],
  volcano: ['Engendro de Lava', 'Molten Drake', 'Magmacore, Dragón Ígneo'],
};

export const PROCEDURAL_BOSS_TITLES: Record<WorldId, { prefixes: string[]; epithets: string[] }> = {
  forest: {
    prefixes: ['Silvanus', 'Yggdras', 'Verdantor', 'Cernunnos', 'Brote', 'Arboris'],
    epithets: ['Titán Arbóreo', 'Guardián Floreciente', 'Señor del Bosque', 'Corteza Viva', 'Espíritu Primigenio', 'Brote Centinela'],
  },
  sunset: {
    prefixes: ['Solarius', 'Ra-Khepri', 'Oryx', 'Horus', 'Sekhmet', 'Dunas-Rex'],
    epithets: ['Fénix del Ocaso', 'Esfinge de las Dunas', 'Guardián Solar', 'Centinela del Desierto', 'Ojo del Horizonte', 'Faraón Dorado'],
  },
  night: {
    prefixes: ['Nocturna', 'Vesper', 'Nyxar', 'Chronos', 'Nebulon', 'Astralis'],
    epithets: ['Dragón del Vacío', 'Guardián Astral', 'Espectro Lunar', 'Devorador Estelar', 'Vórtice Abisal', 'Sombra Cósmica'],
  },
  neon: {
    prefixes: ['Overdrive-X', 'Vanguardia', 'Cybernox', 'Apex-Core', 'Nexus-9', 'Vector-Prime'],
    epithets: ['Titán Cyber', 'Autómata Alfa', 'Matriz de Voltaje', 'Dron Supremo', 'Coloso Neón', 'Cíborg Centinela'],
  },
  alpine: {
    prefixes: ['Glacior', 'Kryos', 'Boreas', 'Skadi', 'Frost-Bite', 'Avalanchar'],
    epithets: ['Behemoth Polar', 'Wyrm de Escarcha', 'Centinela Helado', 'Glaciar Eterno', 'Coloso de Hielo', 'Monarca Ártico'],
  },
  volcano: {
    prefixes: ['Magmacore', 'Ignis', 'Vulcanor', 'Pyroth', 'Surtr', 'Cinder-Lord'],
    epithets: ['Dragón de Magma', 'Titán Ígneo', 'Señor del Cráter', 'Furia Volcánica', 'Molten Drake', 'Leviatán de Obsidiana'],
  },
};

/**
 * Procedural Boss Synthesizer
 * Produces balanced, thematic bosses with custom or generated titles,
 * elemental affiliations, scaled attributes, and archetype visuals.
 */
export function generateProceduralBoss(
  world: WorldId,
  levelNumber: number,
  seed: number,
  customTitle?: string,
): BossConfig {
  const rng = createRNG(seed + 999);
  const bossElement =
    world === 'volcano'
      ? 'fire'
      : world === 'alpine'
        ? 'water'
        : world === 'forest'
          ? 'nature'
          : world === 'neon'
            ? 'electric'
            : world === 'night'
              ? 'cosmic'
              : 'fire';

  const bossArchetype: BossArchetype =
    world === 'forest'
      ? 'treant'
      : world === 'sunset'
        ? 'sphinx'
        : world === 'night'
          ? 'void_dragon'
          : world === 'neon'
            ? 'cyber_titan'
            : world === 'alpine'
              ? 'frost_behemoth'
              : 'magma_dragon';

  let bossName = customTitle;
  if (!bossName) {
    const isOfficial = levelNumber >= 1 && levelNumber <= 3;
    if (isOfficial && WORLD_BOSS_NAMES[world]?.[levelNumber - 1]) {
      bossName = WORLD_BOSS_NAMES[world][levelNumber - 1];
    } else {
      const titles = PROCEDURAL_BOSS_TITLES[world] || PROCEDURAL_BOSS_TITLES.forest;
      const prefix = titles.prefixes[Math.floor(rng() * titles.prefixes.length)];
      const epithet = titles.epithets[Math.floor(rng() * titles.epithets.length)];
      bossName = `${prefix}, ${epithet}`;
    }
  }

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

  const health = 120 + levelNumber * 60;
  const attackFreq = Math.max(1.8, Number((3.0 - levelNumber * 0.3).toFixed(2)));

  return {
    id: `boss-${world}-${levelNumber}-${seed}`,
    name: bossName,
    element: bossElement,
    archetype: bossArchetype,
    size: levelNumber >= 3 ? 2.0 : levelNumber === 2 ? 1.5 : 1.2,
    health,
    maxHealth: health,
    damage: 1,
    speed: 300,
    attackFrequency: attackFreq,
    projectileType:
      bossElement === 'fire'
        ? 'fireball'
        : bossElement === 'water'
          ? 'ice_spike'
          : bossElement === 'electric'
            ? 'lightning_orb'
            : 'boulder',
    projectileSpeed: 380 + levelNumber * 25,
    weakness,
    resistance: bossElement,
  };
}

/**
 * Procedural generation algorithm for a level with controlled randomness,
 * macro pacing curves (Warmup -> Escalation -> Breather -> Gauntlet -> Climax),
 * and structured tactical obstacle/enemy encounters.
 */
function attemptGeneration(config: LevelConfig, seed: number): Track {
  const rng = createRNG(seed);
  const items: TrackItem[] = [];
  const length = config.length;
  let cursorX = 650;
  let itemId = 0;

  while (cursorX < length - 950) {
    const progress = cursorX / length;
    const isWarmup = progress < 0.16;
    const isEscalation = progress >= 0.16 && progress < 0.42;
    const isBreather = progress >= 0.42 && progress < 0.54;
    const isGauntlet = progress >= 0.54 && progress < 0.86;

    // Phase 3: Breather / Power cache zone
    if (isBreather && rng() < 0.65) {
      const powers: ItemKind[] = [
        'power_fire',
        'power_water',
        'power_leaf',
        'power_thunder',
        'power_star',
      ];
      const pKind = rng() < 0.35 ? powers[Math.floor(rng() * powers.length)] : rng() > 0.5 ? 'shield' : 'boost';
      items.push({
        id: `pw-${itemId++}`,
        x: Math.round(cursorX + 60),
        kind: pKind,
      });

      // Reward coin trail along breather corridor
      for (let c = 0; c < 4; c++) {
        items.push({
          id: `pwc-${itemId++}`,
          x: Math.round(cursorX + 160 + c * 55),
          kind: 'coin',
          y: 25,
        });
      }

      cursorX += Math.max(config.minObstacleGap, 680 + Math.round(rng() * 150));
      continue;
    }

    const roll = rng();

    // Vertical aerial launcher (Spring) pattern
    if (config.allowVerticals && (isEscalation || isGauntlet) && roll < 0.22 && cursorX < length - 1300) {
      const springX = Math.round(cursorX);
      items.push({ id: `sp-${itemId++}`, x: springX, kind: 'spring' });

      // Arc of high coins in leap parabola
      for (let c = 1; c <= 4; c++) {
        items.push({
          id: `spc-${itemId++}`,
          x: Math.round(springX + c * 100),
          kind: 'coin',
          y: Math.round(110 + Math.sin((c / 5) * Math.PI) * 70),
        });
      }

      // Air boost ring at apex
      if (rng() > 0.3) {
        items.push({
          id: `rg-${itemId++}`,
          x: Math.round(springX + 280),
          kind: 'ring',
          y: 150,
        });
      }

      // Safe landing envelope: clear ahead by 860px (strictly outside 750px envelope)
      cursorX += 860 + Math.round(rng() * 180);
      continue;
    }

    // Ground challenge (hurdles, rocks, armored golems)
    const groundChance = isWarmup ? 0.65 : isGauntlet ? 0.45 : 0.52;
    if (roll < groundChance) {
      const subRoll = rng();
      // Only introduce golems in escalation or gauntlet
      const kind = isWarmup
        ? (subRoll < 0.55 ? 'log' : 'rock')
        : (subRoll < 0.35 ? 'log' : subRoll < 0.68 ? 'rock' : 'golem');
      const obsX = Math.round(cursorX);
      items.push({ id: `obs-${itemId++}`, x: obsX, kind });

      // Coin parabola over ground hurdle
      for (let c = -2; c <= 2; c++) {
        if (c === 0) continue;
        items.push({
          id: `cn-${itemId++}`,
          x: Math.round(obsX + c * 60),
          kind: 'coin',
          y: Math.round(c === 0 ? 80 : 45),
        });
      }

      const minGap = isWarmup ? Math.max(540, config.minObstacleGap * 1.2) : config.minObstacleGap;
      cursorX += Math.max(minGap, Math.round(minGap + rng() * 200));
      continue;
    }

    // Aerial challenge (branches, surveillance drones)
    if (roll < (isGauntlet ? 0.88 : 0.82)) {
      const subRoll = rng();
      // In warmup, only simple overhead branches; drones appear in escalation and gauntlet
      const kind = isWarmup ? 'branch' : (subRoll < 0.5 ? 'branch' : 'drone');
      const obsX = Math.round(cursorX);
      items.push({ id: `air-${itemId++}`, x: obsX, kind, y: kind === 'drone' ? 55 : 47 });

      // Low ground coins rewarding ducking / sliding underneath
      for (let c = -1; c <= 2; c++) {
        items.push({
          id: `sc-${itemId++}`,
          x: Math.round(obsX + c * 50),
          kind: 'coin',
          y: 20,
        });
      }

      const minGap = isWarmup ? Math.max(520, config.minObstacleGap * 1.15) : config.minObstacleGap;
      cursorX += Math.max(minGap, Math.round(minGap + rng() * 180));
      continue;
    }

    // Powerup / coin sprint corridor
    const powers: ItemKind[] = [
      'power_fire',
      'power_water',
      'power_leaf',
      'power_thunder',
      'power_star',
    ];
    const pKind = rng() < 0.28 ? powers[Math.floor(rng() * powers.length)] : rng() > 0.55 ? 'shield' : rng() > 0.5 ? 'boost' : 'time';
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

    cursorX += Math.max(config.minObstacleGap, 520 + Math.round(rng() * 160));
  }

  // Generate official or procedural Boss for the level
  const boss = generateProceduralBoss(
    config.world,
    config.levelNumber,
    seed,
    WORLD_BOSS_NAMES[config.world]?.[config.levelNumber - 1],
  );
  boss.id = `boss-${config.id}`;

  return {
    id: config.id,
    name: config.title,
    world: config.world,
    length: config.length,
    items: items.sort((a, b) => a.x - b.x),
    levelMusicId: config.levelMusicId,
    boss,
  };
}

/**
 * Creates a pre-verified, guaranteed-safe fallback track for a level
 */
function createSafeFallback(config: LevelConfig): Track {
  const items: TrackItem[] = [];
  let id = 0;
  const gap = Math.max(560, config.minObstacleGap);
  for (let x = 700; x < config.length - 950; x += gap) {
    const kind: ItemKind = id % 3 === 2 ? 'branch' : id % 3 === 1 ? 'rock' : 'log';
    items.push({ id: `fb-${id++}`, x, kind });
    items.push({ id: `fbc-${id++}`, x: x - 80, kind: 'coin' });
    items.push({ id: `fbc-${id++}`, x: x + 80, kind: 'coin' });
    if (id % 5 === 0) {
      items.push({ id: `fbp-${id++}`, x: x + Math.round(gap * 0.5), kind: 'shield' });
    }
  }

  const boss = generateProceduralBoss(
    config.world,
    config.levelNumber,
    config.baseSeed,
    WORLD_BOSS_NAMES[config.world]?.[config.levelNumber - 1],
  );
  boss.id = `boss-${config.id}`;

  return {
    id: config.id,
    name: config.title,
    world: config.world,
    length: config.length,
    items: items.sort((a, b) => a.x - b.x),
    levelMusicId: config.levelMusicId,
    boss,
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

/**
 * Generates an unpredictable, endless or custom-seeded procedural level
 * with balanced progression curves, enemy encounters, and a synthesized boss.
 */
export function generateRandomSeedLevel(
  world: WorldId,
  difficulty: 1 | 2 | 3 = 2,
  seed?: number,
): Track {
  const s = seed ?? Math.floor(Math.random() * 1000000);
  const length = 7500 + difficulty * 2500;
  const config: LevelConfig = {
    id: `proc-${world}-${difficulty}-${s}`,
    world,
    levelNumber: difficulty,
    title: `Nivel Aleatorio: ${world.toUpperCase()} #${s % 10000}`,
    subtitle: `Aventura procedural balanceada con generación dinámica.`,
    length,
    baseSeed: s,
    minObstacleGap: Math.max(450, 560 - difficulty * 35),
    allowVerticals: difficulty >= 2,
    density: 0.75 + difficulty * 0.15,
    levelMusicId: 'bmg-bounding-through-the-blooms',
  };
  return generateProceduralLevel(config, s);
}
