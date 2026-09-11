import type { GamePhase, Hud, RunResult, Track, TrackItem } from '../lib/types';
export const STEP = 1 / 120;
export const GRAVITY = 1900;
export const JUMP = 700;
export const SPEED = 280;
export const CHECKPOINT = 3000;
export type GameEvent = 'jump' | 'coin' | 'hit' | 'power' | 'win';
export class Simulation {
  phase: GamePhase = 'MENU';
  distance = 0;
  height = 0;
  velocity = 0;
  jumps = 0;
  coins = 0;
  lives = 3;
  time = 0;
  shield = 0;
  boost = 0;
  hurt = 0;
  slide = 0;
  perfects = 0;
  checkpoint = 0;
  streak = 0;
  consumed = new Set<string>();
  events: GameEvent[] = [];
  constructor(public track: Track) {
    this.time = track.length / SPEED + 12;
  }
  start() {
    this.phase = 'PLAYING';
  }
  jump() {
    if (this.phase !== 'PLAYING' || this.jumps >= 2) return;
    this.velocity = JUMP * (this.jumps === 1 ? 0.86 : 1);
    this.jumps++;
    this.slide = 0;
    this.events.push('jump');
  }
  duck() {
    if (this.phase === 'PLAYING' && this.height < 5) this.slide = 0.8;
  }
  togglePause() {
    if (this.phase === 'PLAYING') this.phase = 'PAUSED';
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }
  update(dt: number) {
    if (this.phase !== 'PLAYING') return;
    this.distance = Math.min(
      this.track.length,
      this.distance + SPEED * (this.boost > 0 ? 1.4 : 1) * dt,
    );
    this.time = Math.max(0, this.time - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.slide = Math.max(0, this.slide - dt);
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
      this.events.push('power');
    }
    for (const item of this.track.items) {
      if (item.x > this.distance + 55 || this.consumed.has(item.id)) continue;
      const dx = item.x - this.distance;
      if (dx < -55) {
        this.consumed.add(item.id);
        if (['log', 'rock', 'branch'].includes(item.kind)) {
          this.perfects++;
          this.streak++;
          if (this.streak % 3 === 0) {
            this.shield = 4;
            this.events.push('power');
          }
        }
        continue;
      }
      if (Math.abs(dx) < 30) this.collide(item);
    }
    if (this.distance >= this.track.length || this.time <= 0 || this.lives <= 0) {
      this.phase = 'GAME_OVER';
      if (this.lives > 0 && this.time > 0) this.events.push('win');
    }
  }
  private collide(item: TrackItem) {
    if (item.kind === 'coin') {
      if (Math.abs(this.height - 48) < 68) {
        this.coins++;
        this.consumed.add(item.id);
        this.events.push('coin');
      }
      return;
    }
    if (['shield', 'boost', 'time'].includes(item.kind)) {
      if (this.height < 110) {
        this.consumed.add(item.id);
        this.events.push('power');
        if (item.kind === 'shield') this.shield = 6;
        if (item.kind === 'boost') this.boost = 4;
        if (item.kind === 'time') this.time += 8;
      }
      return;
    }
    const hit =
      item.kind === 'branch'
        ? this.slide <= 0 && this.height < 125
        : this.height < (item.kind === 'rock' ? 48 : 35);
    if (hit) {
      this.consumed.add(item.id);
      if (this.shield > 0 || this.hurt > 0) return;
      this.lives--;
      this.streak = 0;
      this.hurt = 1.6;
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
