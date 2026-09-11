export type WorldId = 'forest' | 'sunset' | 'night';
export type GamePhase = 'MENU' | 'PLAYING' | 'PAUSED' | 'EDITING' | 'GAME_OVER';
export type ItemKind = 'log' | 'rock' | 'branch' | 'coin' | 'shield' | 'boost' | 'time';
export interface TrackItem {
  id: string;
  x: number;
  kind: ItemKind;
}
export interface Track {
  id: string;
  name: string;
  world: WorldId;
  length: number;
  items: TrackItem[];
  custom?: boolean;
}
export interface Character {
  id: string;
  name: string;
  color: string;
  pixels?: string[];
  image?: string;
}
export interface RunResult {
  id: string;
  trackId: string;
  trackName: string;
  distance: number;
  coins: number;
  perfects: number;
  score: number;
  won: boolean;
  date: number;
}
export interface Preferences {
  volume: number;
  muted: boolean;
  sfxVolume: number;
  sfxPitch: number;
  reducedMotion: boolean;
  characterId: string;
  trackId: string;
}
export interface AudioTrack {
  id: string;
  name: string;
  mime: string;
  size: number;
  loopStart: number;
  loopEnd: number;
  duration: number;
}
export interface SavedData {
  characters: Character[];
  tracks: Track[];
  runs: RunResult[];
  preferences: Preferences;
  music: AudioTrack[];
}
export interface Hud {
  distance: number;
  coins: number;
  time: number;
  progress: number;
  shield: number;
  boost: number;
  lives: number;
  phase: GamePhase;
}
export type Backend = 'OPFS' | 'IndexedDB';
export type StorageRequest =
  | { action: 'init' }
  | {
      action: 'save';
      collection: 'characters' | 'tracks' | 'runs' | 'preferences';
      id: string;
      value: unknown;
    }
  | { action: 'delete'; collection: 'characters' | 'tracks' | 'music'; id: string }
  | { action: 'music-put'; track: AudioTrack; bytes: ArrayBuffer }
  | { action: 'music-get'; id: string };
export const DEFAULT_PREFERENCES: Preferences = {
  volume: 0.45,
  muted: false,
  sfxVolume: 0.7,
  sfxPitch: 1,
  reducedMotion: false,
  characterId: 'pili',
  trackId: 'forest-path',
};
