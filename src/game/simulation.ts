import { obstacleDamage, obstacleHealth, segmentHit } from '../lib/obstacles';
import { PLAYER_HEIGHT, PLAYER_SLIDE_HEIGHT, PLAYER_HALF_WIDTH } from '../lib/sprite-geometry';
import type {
  BossConfig,
  CameraView,
  CharacterStats,
  GamePhase,
  Hud,
  Projectile,
  RunResult,
  Track,
  TrackItem,
} from '../lib/types';
import { POWERS, calculateCharacterStats, calculateDamage, type PowerId } from '../lib/combat';
import { TIME_PERIODS, type TimeOfDay } from '../lib/environment';

export const STEP = 1 / 120;
export const GRAVITY = 1900;
export const JUMP = 720;
export const SPEED = 290;
export const CHECKPOINT = 3000;
export type GameEvent = 'jump' | 'coin' | 'hit' | 'power' | 'win' | 'destroy-shield' | 'ricochet';

export class Simulation {
  phase: GamePhase = 'MENU';
  distance = 0;
  furthestDistance = 0;
  encounterStarted = false;
  moveAxis: -1 | 0 | 1 = 0;
  facing: -1 | 1 = 1;
  obstacleDurability = new Map<string, number>();
  destroyed = new Set<string>();
  get inBossFight() { return this.encounterStarted && !!this.bossEntity && !this.bossEntity.defeated; }
  setMoveAxis(axis: -1 | 0 | 1) {
    this.moveAxis = this.phase === 'PLAYING' ? axis : 0;
    if (this.inBossFight && this.moveAxis) this.facing = this.moveAxis;
  }
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
  animationElapsed = 0;
  cameraView: CameraView = 'side';
  consumed = new Set<string>();
  cleared = new Set<string>();
  destroyedObstacles: Array<{ id: string; x: number; kind: string }> = [];
  events: GameEvent[] = [];

  // Combat & Boss Systems
  stats: CharacterStats;
  activePowerId: PowerId = 'flame_burst';
  powerCooldown = 0;
  isChargingPower = false;
  powerChargeTime = 0;
  powerChargeRatio = 0;
  projectiles: Projectile[] = [];
  boss: BossConfig | null = null;
  bossEntity: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    health: number;
    maxHealth: number;
    attackTimer: number;
    telegraphTimer: number;
    nextAttackType: 'high' | 'low' | 'homing';
    isTelegraphing: boolean;
    defeated: boolean;
    defeatTimer: number;
    animFrame: number;
    hoverAngle: number;
    chargeTimer: number;
    recoveryTimer: number;
  } | null = null;

  // Environment & Time-of-Day
  timeOfDay: TimeOfDay = 'morning';

  // Size, Zoom & Cumulative Powers
  characterScale = 1.0;
  cameraZoom = 1.0;
  collectedPowers: Set<PowerId> = new Set();

  constructor(
    public track: Track,
    playerStats?: CharacterStats,
    selectedPower?: PowerId,
    envTimeOfDay?: TimeOfDay,
    initialCharacterScale = 1.0,
    initialCameraZoom = 1.0,
    initialUnlockedPowers?: PowerId[],
  ) {
    this.time = track.length / SPEED + 12;
    this.stats = playerStats || calculateCharacterStats(1);
    this.maxEnergy = this.stats.maxEnergy;
    this.energy = this.maxEnergy;
    this.characterScale = Math.max(0.5, Math.min(2.2, initialCharacterScale));
    this.cameraZoom = Math.max(0.6, Math.min(2.0, initialCameraZoom));

    if (initialUnlockedPowers && initialUnlockedPowers.length > 0) {
      for (const p of initialUnlockedPowers) {
        if (POWERS[p]) this.collectedPowers.add(p);
      }
    }

    if (selectedPower && POWERS[selectedPower]) {
      this.activePowerId = selectedPower;
      this.collectedPowers.add(selectedPower);
    } else if (this.collectedPowers.size > 0) {
      this.activePowerId = Array.from(this.collectedPowers)[0];
    }

    if (envTimeOfDay) {
      this.timeOfDay = envTimeOfDay;
    }

    // Initialize Boss if track has one or generates default for official level
    if (track.boss) {
      this.boss = { ...track.boss };
      this.bossEntity = {
        x: track.length - 280,
        y: 60,
        vx: 0,
        vy: 0,
        health: track.boss.health,
        maxHealth: track.boss.maxHealth,
        attackTimer: track.boss.attackFrequency,
        telegraphTimer: 0,
        nextAttackType: 'low',
        isTelegraphing: false,
        defeated: false,
        defeatTimer: 0,
        animFrame: 0,
        hoverAngle: 0,
        chargeTimer: 0,
        recoveryTimer: 0,
      };
    }
  }

  start() {
    if (this.phase === 'MENU') this.phase = 'PLAYING';
  }
  setCameraView(view: CameraView) {
    this.cameraView = view;
  }
  setCameraZoom(zoom: number) {
    this.cameraZoom = Math.max(0.5, Math.min(2.5, zoom));
  }
  setCharacterScale(scale: number) {
    this.characterScale = Math.max(0.4, Math.min(2.5, scale));
  }
  toggleCameraView() {
    this.cameraView = this.cameraView === 'side' ? 'first_person' : 'side';
  }
  jump() {
    if (this.phase !== 'PLAYING' || this.jumps >= 2) return;
    this.velocity = JUMP * (this.jumps === 1 ? 0.9 : 1.05);
    this.jumps++;
    this.animationElapsed = 0;
    this.slide = 0;
    this.events.push('jump');
  }
  duck() {
    if (this.phase === 'PLAYING') {
      if (this.height < 5) {
        this.slide = 0.45;
        this.animationElapsed = 0;
      } else {
        this.velocity = Math.min(this.velocity, -650);
      }
    }
  }
  togglePause() {
    if (this.phase === 'PLAYING') { this.phase = 'PAUSED'; this.moveAxis = 0; }
    else if (this.phase === 'PAUSED') this.phase = 'PLAYING';
  }

  /**
   * Respawn player at the last reached checkpoint (resets position, grants lives & energy)
   */
  respawnAtCheckpoint(): boolean {
    if (this.checkpoint <= 0) return false;
    const checkpointDist = this.checkpoint * CHECKPOINT;
    this.distance = Math.min(this.track.length - 100, checkpointDist);
    this.furthestDistance = Math.max(this.furthestDistance, this.distance);
    this.lives = 3;
    this.energy = this.maxEnergy;
    this.time = Math.max(this.time, 35);
    this.height = 0;
    this.velocity = 0;
    this.jumps = 0;
    this.slide = 0;
    this.boost = 0;
    this.hurt = 2.0; // 2 seconds of spawn invulnerability
    this.shake = 0;
    this.moveAxis = 0;
    this.facing = 1;
    this.isChargingPower = false;
    this.powerChargeTime = 0;
    this.powerChargeRatio = 0;
    this.projectiles.length = 0;
    this.phase = 'PLAYING';
    this.events.push('power');
    return true;
  }

  /**
   * Start charging equipped power (Mega Man Buster style)
   */
  startChargingPower() {
    if (this.phase !== 'PLAYING') return;
    if (this.powerCooldown > 0) return;
    const power = POWERS[this.activePowerId];
    if (!power || this.energy < power.energyCost) return;
    this.isChargingPower = true;
    this.powerChargeTime = 0;
    this.powerChargeRatio = 0;
  }

  /**
   * Release charged attack or cast normal if barely tapped
   */
  releaseChargedPower() {
    if (!this.isChargingPower || this.phase !== 'PLAYING') return;
    const chargeRatio = Math.max(0, this.powerChargeRatio);
    this.isChargingPower = false;
    this.powerChargeTime = 0;
    this.powerChargeRatio = 0;
    this.castPower(chargeRatio);
  }

  /**
   * Interrupt/cancel power charge without firing (e.g. player is hit by an obstacle/projectile)
   */
  cancelChargingPower() {
    if (!this.isChargingPower) return;
    this.isChargingPower = false;
    this.powerChargeTime = 0;
    this.powerChargeRatio = 0;
  }

  /**
   * Cast equipped power
   */
  castPower(chargeRatio = 0) {
    if (this.phase !== 'PLAYING') return;
    if (this.powerCooldown > 0) return;
    const power = POWERS[this.activePowerId];
    if (!power || this.energy < power.energyCost) return;

    // Energy cost: scales moderately with charge, but never consumes more than available energy
    const effectiveCost = Math.min(this.energy, Math.round(power.energyCost * (1 + Math.min(chargeRatio, 2.5) * 0.7)));
    this.energy = Math.max(0, this.energy - effectiveCost);
    this.powerCooldown = power.cooldown;
    this.events.push('power');

    // Calculate environmental modifier
    const env = TIME_PERIODS[this.timeOfDay] || TIME_PERIODS.morning;
    let envMod = 1.0;
    if (power.element === 'fire') envMod *= env.solarModifier;
    if (power.element === 'cosmic') envMod *= env.lunarModifier;

    // Damage multiplier: 1.0x base + 2.2x per charge unit accumulated
    const chargeDmgMultiplier = 1.0 + chargeRatio * 2.2;
    const baseDmg = this.boss
      ? calculateDamage(power, this.stats.strength, this.boss, envMod) * chargeDmgMultiplier
      : power.damage * chargeDmgMultiplier;

    // Projectile size scales progressively with charge ratio + each 100% tier
    const chargeTier = Math.floor(chargeRatio + 1e-4);
    const projSize = Math.round(18 + chargeRatio * 20 + chargeTier * 8);

    // Spawn Player Projectile: Player projectiles persist until hitting an obstacle, the boss, or leaving the track boundaries
    this.projectiles.push({
      id: crypto.randomUUID(),
      sender: 'player',
      x: this.distance + (35 + Math.min(chargeRatio, 4) * 10) * this.facing,
      y: this.height + 25,
      vx: (power.speed + Math.min(chargeRatio, 3) * 150) * this.facing,
      vy: 0,
      damage: Math.round(baseDmg),
      element: power.element,
      type: power.id,
      size: projSize,
      color: chargeTier >= 3 ? '#a855f7' : chargeTier >= 2 ? '#ef4444' : chargeTier >= 1 ? '#f59e0b' : chargeRatio > 0.25 ? '#38bdf8' : power.color,
      life: Infinity,
    });
  }

  update(dt: number) {
    if (this.phase !== 'PLAYING') return;
    const currentSpeed =
      (SPEED + (this.boost > 0 ? 120 : 0) - (this.hurt > 1.0 ? 90 : 0)) *
      (this.boost > 0 ? 1.3 : 1);

    if (this.bossEntity && this.distance >= Math.max(0, this.track.length - 800)) this.encounterStarted = true;
    const isClimax = this.inBossFight;
    if (isClimax) {
      if (this.moveAxis) this.facing = this.moveAxis;
      this.distance = Math.max(0, Math.min(this.track.length - 1, this.distance + this.moveAxis * currentSpeed * dt));
    } else {
      this.facing = 1;
      this.distance = Math.min(this.track.length, this.distance + currentSpeed * dt);
    }
    this.furthestDistance = Math.max(this.furthestDistance, this.distance);

    // Finish before timers, gravity, projectiles or obstacle damage in this step.
    if (this.distance >= this.track.length && (!this.bossEntity || this.bossEntity.defeated)
      && this.lives > 0 && this.time > 0) {
      this.phase = 'GAME_OVER';
      this.moveAxis = 0;
      this.velocity = 0;
      this.boost = 0;
      this.slide = 0;
      this.hurt = 0;
      this.shake = 0;
      this.projectiles.length = 0;
      if (this.bossEntity) {
        this.bossEntity.vx = 0;
        this.bossEntity.vy = 0;
        this.bossEntity.isTelegraphing = false;
      }
      this.events.push('win');
      return;
    }

    this.elapsed += dt;
    if (this.bossEntity?.defeated)
      this.bossEntity.defeatTimer = Math.max(0, this.bossEntity.defeatTimer - dt);
    this.animationElapsed += dt;
    this.time = Math.max(0, this.time - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.slide = Math.max(0, this.slide - dt);
    this.shake = Math.max(0, this.shake - dt * 2.8);
    this.powerCooldown = Math.max(0, this.powerCooldown - dt);

    // Power Charge Accumulation (Mega Man Buster style - unbounded accumulation)
    // The longer the attack is held, the more power accumulates proportionally
    if (this.isChargingPower) {
      this.powerChargeTime += dt;
      this.powerChargeRatio = this.powerChargeTime / 1.4;
    } else {
      this.powerChargeTime = 0;
      this.powerChargeRatio = 0;
    }

    // Regenerate energy gradually with time-of-day bonus
    if (this.hurt <= 0) {
      const env = TIME_PERIODS[this.timeOfDay] || TIME_PERIODS.morning;
      const regenRate = (8 + (this.stats.level - 1) * 0.5) * env.energyRegenBonus;
      this.energy = Math.min(this.maxEnergy, this.energy + regenRate * dt);
    }
    this.velocity -= GRAVITY * dt;
    this.height += this.velocity * dt;
    if (isNaN(this.height) || this.height <= 0) {
      this.height = 0;
      this.velocity = 0;
      this.jumps = 0;
    }
    if (this.height > 600) {
      this.height = 600;
      this.velocity = Math.min(0, this.velocity);
    }
    const reached = Math.floor(this.furthestDistance / CHECKPOINT);
    if (reached > this.checkpoint) {
      this.checkpoint = reached;
      this.time += 5;
      this.energy = Math.min(this.maxEnergy, this.energy + 30);
      this.events.push('power');
    }

    // Boss Combat Loop
    if (this.bossEntity && !this.bossEntity.defeated && isClimax) {
      this.updateBossCombat(dt);
    }

    // Update Projectiles
    this.updateProjectiles(dt);

    // Check direct contact damage between Player and Boss
    if (this.bossEntity && !this.bossEntity.defeated && isClimax) {
      const bossDistX = Math.abs(this.bossEntity.x - this.distance);
      const bossRadius = 45 * (this.boss?.size ?? 1);
      const playerRadius = PLAYER_HALF_WIDTH * this.characterScale;
      const playerY = this.height + (this.slide > 0 ? PLAYER_SLIDE_HEIGHT / 2 : PLAYER_HEIGHT / 2) * this.characterScale;

      if (bossDistX < bossRadius + playerRadius && Math.abs(this.bossEntity.y - playerY) < bossRadius + 20) {
        if (this.shield > 0) {
          this.shield = 0;
          this.shake = Math.max(this.shake, 0.6);
          this.events.push('destroy-shield');
          // Boss bounces back slightly
          this.bossEntity.x = Math.min(this.track.length - 200, this.bossEntity.x + 60);
        } else if (this.hurt <= 0) {
          this.cancelChargingPower();
          this.lives--;
          this.energy = Math.max(0, this.energy - 35);
          this.hurt = 1.8;
          this.shake = 1.3;
          this.velocity = Math.min(this.velocity, -200);
          this.events.push('hit');
        }
      }
    }

    for (const item of this.track.items) {
      if (this.consumed.has(item.id) || this.destroyed.has(item.id)) continue;
      const dx = item.x - this.distance;
      if (dx < -55 && !this.inBossFight) {
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
      if (Math.abs(dx) < (item.width ?? 16) / 2 + PLAYER_HALF_WIDTH * this.characterScale) this.collide(item);
    }

    if (this.time <= 0 || this.lives <= 0) {
      this.phase = 'GAME_OVER';
      this.moveAxis = 0;
      this.velocity = 0;
      this.projectiles.length = 0;
    }
  }

  private updateBossCombat(dt: number) {
    if (!this.bossEntity || !this.boss) return;
    this.bossEntity.hoverAngle += dt * 2.8;
    this.bossEntity.animFrame = (this.bossEntity.animFrame + dt * 6) % 4;

    const boss = this.bossEntity;
    const playerY = this.height + (this.slide > 0 ? 16 : 29) * this.characterScale;
    if (boss.chargeTimer > 0) {
      boss.chargeTimer -= dt;
      boss.x = Math.max(0, Math.min(this.track.length, boss.x + boss.vx * dt));
      boss.y = Math.max(15, Math.min(600, boss.y + boss.vy * dt));
      if (boss.chargeTimer <= 0) boss.recoveryTimer = 0.8;
      return;
    }
    if (boss.recoveryTimer > 0) { boss.recoveryTimer -= dt; return; }
    const dx = this.distance - boss.x, dy = playerY - boss.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const speed = boss.isTelegraphing ? 45 : Math.max(45, this.boss.speed || 145);
    boss.x += dx / length * Math.min(length, speed * dt);
    boss.y = Math.max(15, boss.y + dy / length * Math.min(length, speed * dt));

    if (this.bossEntity.isTelegraphing) {
      this.bossEntity.telegraphTimer -= dt;
      // Sudden forward swoop during attack telegraph!


      if (this.bossEntity.telegraphTimer <= 0) {
        // Fire telegraphed attack
        this.bossEntity.isTelegraphing = false;
        this.bossEntity.attackTimer = Math.max(1.6, this.boss.attackFrequency);

        const isHigh = this.bossEntity.nextAttackType === 'high';
        const projY = this.height + (isHigh ? 52 : 16) * this.characterScale;
        const aimX = this.distance - boss.x, aimY = projY - boss.y;
        const aimLength = Math.max(1, Math.hypot(aimX, aimY));
        boss.vx = aimX / aimLength * 430; boss.vy = aimY / aimLength * 430;
        boss.chargeTimer = 0.6;
        const projSpeed = this.boss.projectileSpeed || 380;

        this.projectiles.push({
          id: crypto.randomUUID(),
          sender: 'boss',
          x: boss.x,
          y: boss.y,
          vx: aimX / aimLength * projSpeed,
          vy: aimY / aimLength * projSpeed,
          damage: this.boss.damage,
          element: this.boss.element,
          type: this.boss.projectileType,
          size: 24,
          color:
            this.boss.element === 'fire'
              ? '#ef4444'
              : this.boss.element === 'water'
                ? '#06b6d4'
                : this.boss.element === 'nature'
                  ? '#22c55e'
                  : this.boss.element === 'electric'
                    ? '#eab308'
                    : '#a855f7',
          life: 3.5,
        });
      }
    } else {
      this.bossEntity.attackTimer -= dt;
      if (this.bossEntity.attackTimer <= 0) {
        // Begin telegraphed warning with 0.7s reaction window
        this.bossEntity.isTelegraphing = true;
        this.bossEntity.telegraphTimer = 0.7;
        // Deterministic fair alternation: slide-under and jump-over attacks take turns.
        this.bossEntity.nextAttackType = this.bossEntity.nextAttackType === 'high' ? 'low' : 'high';
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const previousX = p.x, previousY = p.y;
      p.ricochetTime = Math.max(0, (p.ricochetTime ?? 0) - dt);
      p.ignoreObstacleTime = Math.max(0, (p.ignoreObstacleTime ?? 0) - dt);
      if (p.ignoreObstacleTime === 0) p.ignoredObstacleId = undefined;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.sender !== 'player') {
        p.life -= dt;
        if (p.life <= 0) {
          this.projectiles.splice(i, 1);
          continue;
        }
      } else if (p.x < -200 || p.x > this.track.length + 800) {
        // Player projectile only despawns once leaving the world track boundaries
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.sender === 'player') {
        let nearest = Infinity;
        let target: TrackItem | undefined;
        let hitBoss = false;
        if (this.bossEntity && !this.bossEntity.defeated && this.inBossFight) {
          const radius = 45 * (this.boss?.size ?? 1) + p.size / 2;
          nearest = segmentHit(previousX, previousY, p.x, p.y, this.bossEntity.x - radius, this.bossEntity.x + radius, this.bossEntity.y - radius, this.bossEntity.y + radius);
          hitBoss = nearest !== Infinity;
        }
        for (const item of this.track.items) {
          if (!['log', 'branch', 'rock'].includes(item.kind) || this.destroyed.has(item.id)) continue;
          if (item.id === p.ignoredObstacleId && (p.ignoreObstacleTime ?? 0) > 0) continue;
          const y = item.y ?? (item.kind === 'branch' ? 47 : 0);
          const half = (item.width ?? 40) / 2 + p.size / 2;
          const hit = segmentHit(previousX, previousY, p.x, p.y, item.x - half, item.x + half, y - p.size / 2, y + (item.height ?? 40) + p.size / 2);
          if (hit < nearest) { nearest = hit; target = item; hitBoss = false; }
        }
        if (nearest !== Infinity) {
          if (target) {
            const damage = obstacleDamage(target, p.type);
            if (damage > 0) {
              this.projectiles.splice(i, 1);
              const remaining = Math.max(0, (this.obstacleDurability.get(target.id) ?? obstacleHealth(target)) - damage);
              this.obstacleDurability.set(target.id, remaining);
              if (remaining === 0) this.destroyObstacle(target);
            } else {
              p.x = previousX + (p.x - previousX) * Math.max(0, nearest - 0.02);
              p.y = previousY + (p.y - previousY) * Math.max(0, nearest - 0.02);
              p.vx *= -0.62;
              p.vy = Math.max(110, Math.abs(p.vx) * 0.22);
              p.life = Math.min(p.life, 0.9);
              p.ricochetTime = 0.22;
              p.ignoredObstacleId = target.id;
              p.ignoreObstacleTime = 0.16;
              this.events.push('ricochet');
            }
          } else if (hitBoss && this.bossEntity) {
            this.projectiles.splice(i, 1);
            this.bossEntity.health = Math.max(0, this.bossEntity.health - p.damage);
            this.events.push('hit'); this.shake = Math.max(this.shake, 0.4);
            if (this.bossEntity.health === 0) {
              this.bossEntity.defeated = true; this.bossEntity.defeatTimer = 1.2; this.bossEntity.isTelegraphing = false;
              this.bossEntity.vx = 0; this.bossEntity.vy = 0;
              this.time += 15; this.streak += 5; this.events.push('power');
              for (const projectile of this.projectiles) if (projectile.sender === 'boss') projectile.life = 0;
            }
          }
          continue;
        }
      }

      // Boss projectile hitting Player
      if (p.sender === 'boss') {
        {
          const playerBottom = this.height;
          const playerTop = this.height + (this.slide > 0 ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT) * this.characterScale;
          const hit = segmentHit(previousX, previousY, p.x, p.y, this.distance - PLAYER_HALF_WIDTH * this.characterScale - p.size / 2, this.distance + PLAYER_HALF_WIDTH * this.characterScale + p.size / 2, playerBottom - p.size / 2, playerTop + p.size / 2) !== Infinity;

          if (hit) {
            this.projectiles.splice(i, 1);
            if (this.shield > 0) {
              this.shake = Math.max(this.shake, 0.5);
              this.events.push('destroy-shield');
              continue;
            }
            if (this.hurt <= 0) {
              this.cancelChargingPower();
              this.lives--;
              this.energy = Math.max(0, this.energy - 30);
              this.hurt = 1.6;
              this.shake = 1.2;
              this.events.push('hit');
            }
          }
        }
      }
    }
  }

  private destroyObstacle(item: TrackItem) {
    if (this.destroyed.has(item.id)) return;
    this.destroyed.add(item.id); this.consumed.add(item.id);
    this.destroyedObstacles.push({ id: item.id, x: item.x, kind: item.kind });
    this.events.push('destroy-shield');
  }
  private collide(item: TrackItem) {
    if (this.phase !== 'PLAYING') return;
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
    const playerTop = this.height + (this.slide > 0 ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT) * this.characterScale;
    const overlapsVertically = playerTop >= itemY && playerBottom <= itemY + itemHeight;

    // In-Run Collectible Elemental Powers
    if (item.kind.startsWith('power_')) {
      if (overlapsVertically || Math.abs(this.height - itemY) < 80) {
        this.consumed.add(item.id);
        this.events.push('power');
        this.energy = this.maxEnergy;

        let unlockedId: PowerId | null = null;
        if (item.kind === 'power_fire') unlockedId = 'flame_burst';
        else if (item.kind === 'power_water') unlockedId = 'aqua_shield';
        else if (item.kind === 'power_leaf') unlockedId = 'leaf_storm';
        else if (item.kind === 'power_thunder') unlockedId = 'thunder_dash';
        else if (item.kind === 'power_star') unlockedId = 'starlight_beam';

        if (unlockedId) {
          this.collectedPowers.add(unlockedId);
          this.activePowerId = unlockedId;
        }
      }
      return;
    }

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
      this.cleared.add(item.id);
      if (this.shield > 0) {
        // Shield smashes through the obstacle: trigger destruction event, micro-impact, and record for VFX
        this.shake = Math.max(this.shake, 0.4);
        this.destroyObstacle(item);
        return;
      }
      if (this.hurt > 0) return;
      this.cancelChargingPower();
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
      distance: Math.floor(this.furthestDistance / 10),
      coins: this.coins,
      time: Math.ceil(this.time),
      progress: this.furthestDistance / this.track.length,
      shield: this.shield,
      boost: this.boost,
      lives: this.lives,
      energy: Math.round(this.energy),
      maxEnergy: this.maxEnergy,
      height: Math.round(this.height),
      velocity: Math.round(this.velocity),
      speed: this.phase === 'PLAYING' ? Math.round(SPEED * (this.boost > 0 ? 1.3 : 1) * (this.inBossFight ? this.moveAxis : 1)) : 0,
      hurt: this.hurt,
      shake: this.shake,
      cameraView: this.cameraView,
      moveAxis: this.moveAxis,
      facing: this.facing,
      cameraZoom: this.cameraZoom,
      characterScale: this.characterScale,
      phase: this.phase,
      bossHealth: this.bossEntity ? Math.round(this.bossEntity.health) : undefined,
      bossMaxHealth: this.bossEntity?.maxHealth,
      bossName: this.boss?.name,
      isBossFight: this.inBossFight,
      powerCooldown: Math.max(0, this.powerCooldown),
      activePowerId: this.activePowerId,
      unlockedPowers: Array.from(this.collectedPowers),
      isChargingPower: this.isChargingPower,
      powerChargeRatio: this.powerChargeRatio,
      timeOfDay: this.timeOfDay,
      checkpoint: this.checkpoint,
      checkpointDistance: Math.floor((this.checkpoint * CHECKPOINT) / 10),
    };
  }
  result(): RunResult {
    const bossWon = !this.bossEntity || this.bossEntity.defeated;
    return {
      id: crypto.randomUUID(),
      trackId: this.track.id,
      trackName: this.track.name,
      distance: Math.floor(this.furthestDistance / 10),
      coins: this.coins,
      perfects: this.perfects,
      score: Math.floor(this.furthestDistance / 10) + this.coins * 25 + this.perfects * 50 + (this.bossEntity?.defeated ? 1000 : 0),
      won: this.distance >= this.track.length && this.lives > 0 && this.time > 0 && bossWon,
      bossDefeated: this.bossEntity?.defeated,
      collectedPowers: Array.from(this.collectedPowers),
      date: Date.now(),
    };
  }
}
