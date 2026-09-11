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
};
export const CHARACTERS: Character[] = [
  { id: 'pili', name: 'Pili', color: '#ec9565' },
  { id: 'menta', name: 'Menta', color: '#82b79b' },
  { id: 'luna', name: 'Luna', color: '#b8a5d0' },
];
function makeTrack(id: string, name: string, world: WorldId, length: number, gap: number): Track {
  const items: Track['items'] = [];
  const obstacles: ItemKind[] = ['log', 'rock', 'log', 'branch'];
  for (let x = 600, i = 0; x < length - 200; x += gap, i++) {
    items.push({ id: `${id}-o${i}`, x, kind: obstacles[i % obstacles.length] });
    for (let j = 0; j < 3; j++)
      items.push({ id: `${id}-c${i}-${j}`, x: x - 130 + j * 55, kind: 'coin' });
    if (i % 5 === 3)
      items.push({ id: `${id}-p${i}`, x: x + gap * 0.5, kind: i % 2 ? 'shield' : 'time' });
    if (i % 7 === 5) items.push({ id: `${id}-b${i}`, x: x + gap * 0.7, kind: 'boost' });
  }
  return { id, name, world, length, items: items.sort((a, b) => a.x - b.x) };
}
export const TRACKS: Track[] = [
  makeTrack('forest-path', 'Bosque Susurro', 'forest', 9000, 640),
  makeTrack('sunset-path', 'Dunas del Sol', 'sunset', 12000, 570),
  makeTrack('night-path', 'Valle Lunar', 'night', 15000, 500),
];
export function validateTrack(track: Track): string | null {
  if (!track.name.trim() || track.name.length > 40)
    return 'Ponle un nombre de hasta 40 caracteres.';
  if (!Number.isFinite(track.length) || track.length < 3000 || track.length > 30000)
    return 'La longitud debe estar entre 300 y 3.000 metros.';
  if (!(track.world in WORLDS)) return 'Selecciona un mundo válido.';
  if (track.items.length > 200) return 'Usa un máximo de 200 elementos.';
  const kinds: ItemKind[] = ['log', 'rock', 'branch', 'coin', 'shield', 'boost', 'time'];
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
