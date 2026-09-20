export type WorldId = 'forest' | 'sunset' | 'night' | 'neon' | 'alpine' | 'volcano';
export type GamePhase = 'MENU' | 'PLAYING' | 'PAUSED' | 'EDITING' | 'GAME_OVER';
export type ItemKind =
  | 'log'
  | 'rock'
  | 'branch'
  | 'drone'
  | 'golem'
  | 'coin'
  | 'shield'
  | 'boost'
  | 'time'
  | 'spring'
  | 'ring'
  | 'power_fire'
  | 'power_water'
  | 'power_leaf'
  | 'power_thunder'
  | 'power_star';
export type CameraView = 'side' | 'first_person';
export interface DamageFeedback {
  id: string;
  x: number;
  y: number;
  damage: number;
  color: string;
  elapsed: number;
  duration: number;
}
export interface TrackItem {
  material?: import('./obstacles').ObstacleMaterial;
  health?: number;
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
  boss?: BossConfig;
  levelMusicId?: string;
  bossMusicId?: string;
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
  boss?: BossConfig;
  levelMusicId?: string;
  bossMusicId?: string;
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
export interface CharacterStats {
  level: number;
  strength: number;
  speed: number;
  maxEnergy: number;
  auraLevel: number;
}

export interface BossConfig {
  id: string;
  name: string;
  element: 'fire' | 'water' | 'nature' | 'electric' | 'cosmic' | 'light';
  size: number;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  attackFrequency: number;
  projectileType: 'fireball' | 'ice_spike' | 'boulder' | 'lightning_orb' | 'star_beam';
  projectileSpeed: number;
  weakness: 'fire' | 'water' | 'nature' | 'electric' | 'cosmic' | 'light';
  resistance: 'fire' | 'water' | 'nature' | 'electric' | 'cosmic' | 'light';
  customSpriteUrl?: string;
  difficulty?: 'easy' | 'normal' | 'hard' | 'legendary' | 'custom';
}

export interface Projectile {
  id: string;
  sender: 'player' | 'boss';
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  element: 'fire' | 'water' | 'nature' | 'electric' | 'cosmic' | 'light';
  type: string;
  size: number;
  color: string;
  life: number;
  /** Brief deterministic impact state used for ricochet feedback. */
  ricochetTime?: number;
  /** Prevents a reflected shot from colliding with the same obstacle every fixed step. */
  ignoredObstacleId?: string;
  ignoreObstacleTime?: number;
}

export interface Character {
  id: string;
  name: string;
  color: string;
  scale?: number;
  pixels?: string[];
  image?: string;
  /** Optional feet position, as a fraction of source image height, keyed by frame URL. */
  frameBaselines?: Record<string, number>;
  frameScales?: Partial<Record<'run' | 'jump' | 'slide' | 'idle', number[]>>;
  stats?: CharacterStats;
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
  bossDefeated?: boolean;
  collectedPowers?: string[];
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
  cameraZoom?: number;
  characterScale?: number;
  selectedPowerId?: string;
  timeOfDay?: 'realtime' | 'late_night' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'sunset' | 'dusk' | 'night';
  environmentSync?: 'realtime' | 'manual';
  jukeboxMode?: 'assigned' | 'shuffle' | 'sequential';
  jukeboxCategory?: 'all' | 'adventure' | 'boss' | 'chill' | 'retro' | 'custom';
}
export interface AudioTrack {
  id: string;
  name: string;
  mime: string;
  size: number;
  loopStart: number;
  loopEnd: number;
  duration: number;
  category?: 'adventure' | 'boss' | 'chill' | 'retro' | 'custom';
}
export interface SavedData {
  characters: Character[];
  tracks: Track[];
  scenarios: Scenario[];
  draftScenario?: Scenario;
  runs: RunResult[];
  preferences: Preferences;
  music: AudioTrack[];
  unlockedPowers?: string[];
  characterLevel?: number;
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
  moveAxis?: number;
  facing?: number;
  cameraZoom?: number;
  characterScale?: number;
  phase: GamePhase;
  bossHealth?: number;
  bossMaxHealth?: number;
  bossName?: string;
  isBossFight?: boolean;
  powerCooldown?: number;
  activePowerId?: string;
  unlockedPowers?: string[];
  collectedPowers?: import('./combat').PowerId[];
  isChargingPower?: boolean;
  powerChargeRatio?: number;
  timeOfDay?: string;
  checkpoint?: number;
  checkpointDistance?: number;
}
export type MusicTrack = AudioTrack;
export type Backend = 'OPFS' | 'IndexedDB';
export type DatabaseSection = 'runs' | 'characters' | 'tracks' | 'scenarios' | 'music' | 'preferences';
export interface StorageDetails {
  backend: Backend;
  location: string;
  absolutePath: string;
  storageType: string;
  engine: string;
  persisted: boolean;
  counts: {
    runs: number;
    characters: number;
    tracks: number;
    scenarios: number;
    music: number;
  };
}
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
  | { action: 'music-put'; track: AudioTrack; bytes?: ArrayBuffer; blob?: Blob }
  | { action: 'music-get'; id: string }
  | { action: 'factory-reset' }
  | { action: 'section-clear'; section: DatabaseSection }
  | { action: 'storage-details' };
export const DEFAULT_PREFERENCES: Preferences = {
  volume: 0.9,
  muted: false,
  sfxVolume: 0.9,
  sfxPitch: 1,
  reducedMotion: false,
  characterId: 'pili',
  trackId: 'forest-path',
  cameraZoom: 1.0,
  characterScale: 1.0,
  environmentSync: 'realtime',
};
