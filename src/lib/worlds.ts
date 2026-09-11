import type { Character, ItemKind, Track, WorldId } from './types';
export const WORLDS: Record<
  WorldId,
  {
    name: string;
    subtitle: string;
    sky: string;
    mountain: string;
    trees: string;
    ground: string;
    accent: string;
    difficulty: string;
  }
> = {
  forest: {
    name: 'Bosque Susurro',
    subtitle: 'Un pequeño salto. Una gran aventura.',
    sky: '#dbe9cf',
    mountain: '#9cbc91',
    trees: '#346d54',
    ground: '#234d3d',
    accent: '#d8f36a',
    difficulty: 'Tranquilo',
  },
  sunset: {
    name: 'Dunas del Sol',
    subtitle: 'Persigue la última luz del día.',
    sky: '#f3d1b4',
    mountain: '#d89870',
    trees: '#a6674a',
    ground: '#724735',
    accent: '#ffe09b',
    difficulty: 'Intermedio',
  },
  night: {
    name: 'Valle Lunar',
    subtitle: 'Donde las estrellas marcan el camino.',
    sky: '#29384f',
    mountain: '#475773',
    trees: '#283e56',
    ground: '#192d3c',
    accent: '#c4d6ff',
    difficulty: 'Desafiante',
  },
  neon: {
    name: 'Metrópolis Neón',
    subtitle: 'Ráfagas de luz cyberpunk y rascacielos.',
    sky: '#110b27',
    mountain: '#2e1854',
    trees: '#00e5ff',
    ground: '#1b0933',
    accent: '#ff007f',
    difficulty: 'Frenético',
  },
  alpine: {
    name: 'Cumbres Celestes',
    subtitle: 'Nieve, islas flotantes y saltos verticales al vacío.',
    sky: '#cbe7f7',
    mountain: '#8bb5d1',
    trees: '#e6f3fa',
    ground: '#466782',
    accent: '#39a9db',
    difficulty: 'Acrobático',
  },
  volcano: {
    name: 'Cráter Ígneo',
    subtitle: 'Magma ardiente, humo espeso y velocidad extrema.',
    sky: '#2b0e0c',
    mountain: '#4a1914',
    trees: '#ff4d00',
    ground: '#1f0d0c',
    accent: '#ff9d00',
    difficulty: 'Extremo',
  },
};
export const CHARACTERS: Character[] = [
  { id: 'pili', name: 'Pili', color: '#ec9565' },
  { id: 'menta', name: 'Menta', color: '#82b79b' },
  { id: 'luna', name: 'Luna', color: '#b8a5d0' },
];
function makeTrack(
  id: string,
  name: string,
  world: WorldId,
  length: number,
  gap: number,
  withVerticals = false,
): Track {
  const items: Track['items'] = [];
  const obstacles: ItemKind[] = ['log', 'rock', 'log', 'branch'];
  for (let x = 600, i = 0; x < length - 400; x += gap, i++) {
    items.push({ id: `${id}-o${i}`, x, kind: obstacles[i % obstacles.length] });
    for (let j = 0; j < 3; j++) {
      const cx = x - 130 + j * 55;
      if (cx >= 400 && cx <= length - 150) items.push({ id: `${id}-c${i}-${j}`, x: cx, kind: 'coin' });
    }
    if (i % 5 === 3) {
      const px = x + gap * 0.5;
      if (px >= 400 && px <= length - 150) items.push({ id: `${id}-p${i}`, x: px, kind: i % 2 ? 'shield' : 'time' });
    }
    if (i % 7 === 5) {
      const bx = x + gap * 0.7;
      if (bx >= 400 && bx <= length - 150) items.push({ id: `${id}-b${i}`, x: bx, kind: 'boost' });
    }
    if (withVerticals && i % 4 === 2) {
      const sx = x - gap * 0.4;
      if (sx >= 400 && sx <= length - 150) items.push({ id: `${id}-sp${i}`, x: sx, kind: 'spring' });
    }
    if (withVerticals && i % 6 === 4) {
      const rx = x + gap * 0.3;
      if (rx >= 400 && rx <= length - 150) items.push({ id: `${id}-rg${i}`, x: rx, kind: 'ring' });
    }
  }
  return { id, name, world, length, items: items.sort((a, b) => a.x - b.x) };
}
export const TRACKS: Track[] = [
  makeTrack('forest-path', 'Bosque Susurro', 'forest', 9000, 640),
  makeTrack('sunset-path', 'Dunas del Sol', 'sunset', 12000, 570),
  makeTrack('night-path', 'Valle Lunar', 'night', 15000, 500),
  makeTrack('neon-path', 'Metrópolis Neón', 'neon', 16000, 560, true),
  makeTrack('alpine-path', 'Cumbres Celestes', 'alpine', 18000, 620, true),
  makeTrack('volcano-path', 'Cráter Ígneo', 'volcano', 20000, 680, true),
];
export function validateTrack(track: Track): string | null {
  if (!track.name.trim() || track.name.length > 40)
    return 'Ponle un nombre de hasta 40 caracteres.';
  if (!Number.isFinite(track.length) || track.length < 3000 || track.length > 30000)
    return 'La longitud debe estar entre 300 y 3.000 metros.';
  if (!(track.world in WORLDS)) return 'Selecciona un mundo válido.';
  if (track.items.length > 200) return 'Usa un máximo de 200 elementos.';
  const kinds: ItemKind[] = [
    'log',
    'rock',
    'branch',
    'coin',
    'shield',
    'boost',
    'time',
    'spring',
    'ring',
  ];
  if (
    track.items.some(
      (i) =>
        !kinds.includes(i.kind) || !Number.isFinite(i.x) || i.x < 400 || i.x > track.length - 150,
    )
  )
    return 'Deja espacio libre al inicio y al final de la pista.';
  const obstacles = track.items
    .filter((i) => ['log', 'rock', 'branch'].includes(i.kind))
    .sort((a, b) => a.x - b.x);
  if (obstacles.some((o, i) => i > 0 && o.x - obstacles[i - 1].x < 420))
    return 'Separa los obstáculos al menos 42 metros para que la pista se pueda superar.';
  return null;
}
