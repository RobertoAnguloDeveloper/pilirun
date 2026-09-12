import type { CameraView, GamePhase, Hud, RunResult, Track, TrackItem } from '../lib/types';
export const STEP = 1 / 120;
export const GRAVITY = 1900;
export const JUMP = 720;
export const SPEED = 290;
export const CHECKPOINT = 3000;
export type GameEvent = 'jump' | 'coin' | 'hit' | 'power' | 'win' | 'destroy-shield';
export class Simulation {
  phase: GamePhase = 'MENU';
  distance = 0;
  height = 0;
  velocity = 0;
  jumps = 0;
  coins = 0;
  lives = 3;
  energy = 100;
  maxEnergy = 100;
  time = 0;
  shield = 0;
  boost = 0;
  hurt = 0;
  slide = 0;
  perfects = 0;
  checkpoint = 0;
  streak = 0;
  shake = 0;
  elapsed = 0;
  cameraView: CameraView = 'side';
  consumed = new Set<string>();
  cleared = new Set<string>();
  destroyedObstacles: Array<{ id: string; x: number; kind: string }> = [];
  events: GameEvent[] = [];
  constructor(public track: Track) {
    this.time = track.length / SPEED + 12;
  }
  start() {
    this.phase = 'PLAYING';
  }
  setCameraView(view: CameraView) {
    this.cameraView = view;
  }
  toggleCameraView() {
    this.cameraView = this.cameraView === 'side' ? 'first_person' : 'side';
  }
  jump() {
    if (this.phase !== 'PLAYING' || this.jumps >= 2) return;
    this.velocity = JUMP * (this.jumps === 1 ? 0.9 : 1.05);
    this.jumps++;
    this.slide = 0;
    this.events.push('jump');
  }
  duck() {
    if (this.phase === 'PLAYING') {
      if (this.height < 5) {
        // Snappy, realistic crouch/slide duration with swift stand recovery
        this.slide = 0.45;
      } else {
        // Fast vertical drop / dive when in the air for responsive vertical control
        this.velocity = Math.min(this.velocity, -650);
      }
    }
  }
  togglePause() {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }
  update(dt: number) {
    if (this.phase !== 'PLAYING') return;
    const currentSpeed =
      (SPEED + (this.boost > 0 ? 120 : 0) - (this.hurt > 1.0 ? 90 : 0)) *
      (this.boost > 0 ? 1.3 : 1);
    this.distance = Math.min(this.track.length, this.distance + currentSpeed * dt);
    this.elapsed += dt;
    this.time = Math.max(0, this.time - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.slide = Math.max(0, this.slide - dt);
    this.shake = Math.max(0, this.shake - dt * 2.8);
    // Regenerate energy gradually when not hurt
    if (this.hurt <= 0) {
      this.energy = Math.min(this.maxEnergy, this.energy + 8 * dt);
    }
    this.velocity -= GRAVITY * dt;
    this.height += this.velocity * dt;
    if (this.height <= 0) {
      this.height = 0;
      this.velocity = 0;
      this.jumps = 0;
    }
    const reached = Math.floor(this.distance / CHECKPOINT);
    if (reached > this.checkpoint) {
      this.checkpoint = reached;
      this.time += 5;
      this.energy = Math.min(this.maxEnergy, this.energy + 30);
      this.events.push('power');
    }
    for (const item of this.track.items) {
      // Items that are destroyed or consumed
      if (this.consumed.has(item.id)) continue;
      // If obstacle has passed far behind the player, mark cleared once for score/streak,
      // but DO NOT add obstacles to consumed so they stay visible in the 3D world as you look or pass!
      const dx = item.x - this.distance;
      if (dx < -55) {
        if (!this.cleared.has(item.id)) {
          this.cleared.add(item.id);
          if (['log', 'rock', 'branch'].includes(item.kind)) {
            this.perfects++;
            this.streak++;
            if (this.streak % 3 === 0) {
              this.shield = 4;
              this.events.push('power');
            }
          }
        }
        continue;
      }
      if (item.x > this.distance + 60) continue;
      if (Math.abs(dx) < 32) this.collide(item);
    }
    if (this.distance >= this.track.length || this.time <= 0 || this.lives <= 0) {
      this.phase = 'GAME_OVER';
      if (this.lives > 0 && this.time > 0) this.events.push('win');
    }
  }
  private collide(item: TrackItem) {
    const itemY =
      item.y ??
      (item.kind === 'ring'
        ? 101
        : item.kind === 'coin'
          ? 50
          : item.kind === 'branch'
            ? 47
            : ['shield', 'boost', 'time'].includes(item.kind)
              ? 55
              : 0);
    const itemHeight =
      item.height ?? (item.kind === 'branch' ? 38 : item.kind === 'ring' ? 48 : 40);
    const playerBottom = this.height;
    const playerTop = this.height + (this.slide > 0 ? 34 : 74);
    const overlapsVertically = playerTop >= itemY && playerBottom <= itemY + itemHeight;
    if (item.kind === 'coin') {
      if (overlapsVertically || Math.abs(this.height - itemY) < 70) {
        this.coins++;
        this.energy = Math.min(this.maxEnergy, this.energy + 5);
        this.consumed.add(item.id);
        this.events.push('coin');
      }
      return;
    }
    if (item.kind === 'spring') {
      // Vertical launcher: propels player high into the sky for vertical speedrun
      if (Math.abs(this.height - itemY) < 55) {
        this.velocity = 1100;
        this.jumps = 1;
        this.consumed.add(item.id);
        this.events.push('jump');
      }
      return;
    }
    if (item.kind === 'ring') {
      // Aerial speed boost ring in high altitude
      if (overlapsVertically || Math.abs(this.height - itemY) < 80) {
        this.boost = 4;
        this.velocity = Math.max(this.velocity, 400);
        this.energy = Math.min(this.maxEnergy, this.energy + 25);
        this.consumed.add(item.id);
        this.events.push('power');
      }
      return;
    }
    if (['shield', 'boost', 'time'].includes(item.kind)) {
      if (overlapsVertically || Math.abs(this.height - itemY) < 80) {
        this.consumed.add(item.id);
        this.events.push('power');
        if (item.kind === 'shield') this.shield = 6;
        if (item.kind === 'boost') this.boost = 4;
        if (item.kind === 'time') this.time += 8;
      }
      return;
    }
    const hit = item.kind === 'branch' ? this.slide <= 0 && overlapsVertically : overlapsVertically;
    if (hit) {
      this.consumed.add(item.id);
      if (this.shield > 0) {
        // Shield smashes through the obstacle: trigger destruction event, micro-impact, and record for VFX
        this.shake = Math.max(this.shake, 0.4);
        this.events.push('destroy-shield');
        this.destroyedObstacles.push({ id: item.id, x: item.x, kind: item.kind });
        return;
      }
      if (this.hurt > 0) return;
      this.lives--;
      this.energy = Math.max(0, this.energy - 35);
      this.streak = 0;
      this.hurt = 1.6;
      this.shake = 1.0;
      this.events.push('hit');
    }
  }
  hud(): Hud {
    return {
      distance: Math.floor(this.distance / 10),
      coins: this.coins,
      time: Math.ceil(this.time),
      progress: this.distance / this.track.length,
      shield: this.shield,
      boost: this.boost,
      lives: this.lives,
      energy: Math.round(this.energy),
      maxEnergy: this.maxEnergy,
      height: Math.round(this.height),
      velocity: Math.round(this.velocity),
      speed: Math.round(SPEED * (this.boost > 0 ? 1.3 : 1)),
      hurt: this.hurt,
      shake: this.shake,
      cameraView: this.cameraView,
      phase: this.phase,
    };
  }
  result(): RunResult {
    return {
      id: crypto.randomUUID(),
      trackId: this.track.id,
      trackName: this.track.name,
      distance: Math.floor(this.distance / 10),
      coins: this.coins,
      perfects: this.perfects,
      score: Math.floor(this.distance / 10) + this.coins * 25 + this.perfects * 50,
      won: this.distance >= this.track.length && this.lives > 0 && this.time > 0,
      date: Date.now(),
    };
  }
}
