export type WorldId = 'forest' | 'sunset' | 'night' | 'neon' | 'alpine' | 'volcano';
export type GamePhase = 'MENU' | 'PLAYING' | 'PAUSED' | 'EDITING' | 'GAME_OVER';
export type ItemKind =
  'log' | 'rock' | 'branch' | 'coin' | 'shield' | 'boost' | 'time' | 'spring' | 'ring';
export type CameraView = 'side' | 'first_person';
export interface TrackItem {
  id: string;
  x: number;
  kind: ItemKind;
  y?: number;
  width?: number;
  height?: number;
  visual?: ScenarioObjectVisual;
}
export interface Track {
  id: string;
  name: string;
  world: WorldId;
  length: number;
  items: TrackItem[];
  custom?: boolean;
  scenarioId?: string;
}

export type ScenarioLayerType =
  'background' | 'midground' | 'foreground' | 'obstacle' | 'decoration';
export type ScenarioAnimationDirection = 'left' | 'right' | 'up' | 'down';
export type ScenarioPropertyValue = number | string | boolean;
export type ScenarioObjectVisual =
  { source: 'builtin'; kind: ItemKind } | { source: 'custom'; assetId: string; name: string };

export interface ScenarioObject {
  id: string;
  visual: ScenarioObjectVisual;
  behavior: ItemKind | 'decoration';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  laneOffset: number;
  layerId: string;
  properties: Record<string, ScenarioPropertyValue>;
}

export interface ScenarioLayer {
  id: string;
  name: string;
  type: ScenarioLayerType;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  parallaxSpeed: number;
  animated: boolean;
  animationSpeed: number;
  animationDirection: ScenarioAnimationDirection;
  objects: ScenarioObject[];
}

export interface Scenario {
  schemaVersion: 1;
  id: string;
  name: string;
  world: WorldId;
  length: number;
  layers: ScenarioLayer[];
  custom: true;
  updatedAt: number;
}

export interface ScenarioAssetMeta {
  id: string;
  scenarioId: string;
  name: string;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  size: number;
}

export interface ScenarioAsset extends ScenarioAssetMeta {
  bytes: ArrayBuffer;
}
export interface Character {
  id: string;
  name: string;
  color: string;
  pixels?: string[];
  image?: string;
  frames?: {
    run?: string[];
    jump?: string[];
    slide?: string[];
    idle?: string[];
  };
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
  cameraView?: CameraView;
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
  scenarios: Scenario[];
  draftScenario?: Scenario;
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
  energy: number;
  maxEnergy: number;
  height: number;
  velocity: number;
  speed: number;
  hurt: number;
  shake: number;
  cameraView: CameraView;
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
  | { action: 'scenario-save'; scenario: Scenario; assets?: ScenarioAsset[] }
  | { action: 'scenario-delete'; id: string }
  | { action: 'scenario-draft-save'; scenario: Scenario }
  | { action: 'scenario-draft-clear'; scenarioId?: string }
  | { action: 'scenario-asset-put'; asset: ScenarioAsset }
  | { action: 'scenario-assets-get'; scenarioId: string }
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
