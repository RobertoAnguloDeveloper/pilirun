import { describe, expect, it } from 'vitest';
import { Simulation, STEP, SPEED } from '../src/game/simulation';
import { TRACKS, validateTrack } from '../src/lib/worlds';
import type { Track } from '../src/lib/types';
const empty = (): Track => ({ id: 'test', name: 'Test', world: 'forest', length: 9000, items: [] });
function advance(game: Simulation, seconds: number) {
  for (let n = 0; n < Math.round(seconds / STEP); n++) game.update(STEP);
}
describe('runner physics and progression', () => {
  it('wins before finish-line damage or time expiry and freezes all subsequent inputs', () => {
    const track = { ...empty(), length: 100, items: [{ id: 'finish-rock', x: 100, kind: 'rock' as const }] };
    const game = new Simulation(track);
    game.start(); game.distance = 99; game.lives = 1; game.time = STEP / 2;
    game.velocity = -200; game.boost = 2;
    game.projectiles.push({ id: 'late-hit', sender: 'boss', x: 100, y: 20, vx: 0, vy: 0,
      damage: 100, element: 'fire', type: 'fireball', size: 24, color: '#f00', life: 1 });
    game.update(STEP);
    expect(game.result().won).toBe(true);
    expect(game.lives).toBe(1);
    expect(game.projectiles).toHaveLength(0);
    expect(game.velocity).toBe(0);
    const hud = game.hud();
    game.jump(); game.duck(); game.castPower(); game.togglePause(); game.start();
    advance(game, 10);
    expect(game.hud()).toEqual(hud);
    expect(game.events.filter((event) => event === 'win')).toHaveLength(1);
    expect(game.events).not.toContain('hit');
  });
  it('covers equal distance at 30, 60 and 120 display frames per second', () => {
    const distances = [30, 60, 120].map((fps) => {
      const game = new Simulation(empty());
      game.start();
      let accumulator = 0;
      for (let n = 0; n < fps * 10; n++) {
        accumulator += 1 / fps;
        while (accumulator + 1e-10 >= STEP) {
          game.update(STEP);
          accumulator -= STEP;
        }
      }
      return game.distance;
    });
    distances.forEach((distance) => expect(distance).toBeCloseTo(SPEED * 10, 6));
  });
  it('allows two jumps, rejects a third, then resets on landing', () => {
    const game = new Simulation(empty());
    game.start();
    game.jump();
    advance(game, 0.2);
    game.jump();
    expect(game.jumps).toBe(2);
    const velocity = game.velocity;
    game.jump();
    expect(game.velocity).toBe(velocity);
    advance(game, 2);
    expect(game.height).toBe(0);
    expect(game.jumps).toBe(0);
  });
  it('does not consume time or move while paused', () => {
    const game = new Simulation(empty());
    game.start();
    advance(game, 1);
    game.togglePause();
    const before = game.hud();
    advance(game, 8);
    expect(game.hud()).toEqual(before);
  });
  it('hits a log once, but clears it when jumping', () => {
    const track = { ...empty(), items: [{ id: 'log', x: 600, kind: 'log' as const }] };
    const hit = new Simulation(track);
    hit.start();
    advance(hit, 3);
    expect(hit.lives).toBe(2);
    expect(hit.perfects).toBe(0);
    const safe = new Simulation(track);
    safe.start();
    advance(safe, 1.8);
    safe.jump();
    advance(safe, 1.2);
    expect(safe.lives).toBe(3);
    expect(safe.perfects).toBe(1);
  });
  it('ducks under branches without losing a heart', () => {
    const game = new Simulation({ ...empty(), items: [{ id: 'branch', x: 600, kind: 'branch' }] });
    game.start();
    advance(game, 1.95);
    game.duck();
    advance(game, 1);
    expect(game.lives).toBe(3);
    expect(game.perfects).toBe(1);
  });
  it('grants five seconds exactly once at a checkpoint', () => {
    const game = new Simulation(empty());
    game.start();
    const initial = game.time;
    advance(game, 11);
    expect(game.checkpoint).toBe(1);
    expect(game.time).toBeCloseTo(initial - 11 + 5, 5);
  });
  it('shield absorbs collisions and expires with simulation time', () => {
    const game = new Simulation({
      ...empty(),
      items: [
        { id: 'shield', x: 450, kind: 'shield' },
        { id: 'log', x: 600, kind: 'log' },
      ],
    });
    game.start();
    advance(game, 3);
    expect(game.lives).toBe(3);
    expect(game.shield).toBeGreaterThan(0);
    advance(game, 6);
    expect(game.shield).toBe(0);
  });
  it('finishes at the exact endpoint and stops moving', () => {
    const game = new Simulation({ ...empty(), length: 3000 });
    game.start();
    advance(game, 12);
    expect(game.phase).toBe('GAME_OVER');
    expect(game.result().won).toBe(true);
    expect(game.distance).toBe(3000);
    expect(game.velocity).toBe(0);
    expect(game.boost).toBe(0);
    expect(game.slide).toBe(0);
    expect(game.hurt).toBe(0);
    expect(game.projectiles.length).toBe(0);
    const time = game.time;
    advance(game, 3);
    expect(game.time).toBe(time);
    expect(game.distance).toBe(3000);
  });
  it('expires a run when its timer runs out', () => {
    const game = new Simulation(empty());
    game.start();
    game.time = 0.1;
    advance(game, 1);
    expect(game.phase).toBe('GAME_OVER');
    expect(game.result().won).toBe(false);
  });
  it('breaks the shield streak after damage without erasing career perfects', () => {
    const game = new Simulation({ ...empty(), items: [{ id: 'log', x: 600, kind: 'log' }] });
    game.perfects = 2;
    game.streak = 2;
    game.start();
    advance(game, 3);
    expect(game.streak).toBe(0);
    expect(game.perfects).toBe(2);
    expect(game.shield).toBe(0);
  });
  it('keeps cleared obstacles in the world without consuming them when safely avoided', () => {
    const track = { ...empty(), items: [{ id: 'passed-rock', x: 500, kind: 'rock' as const }] };
    const game = new Simulation(track);
    game.start();
    advance(game, 1.5);
    game.jump();
    advance(game, 1.5);
    // Character jumped over rock and is far past it
    expect(game.distance).toBeGreaterThan(600);
    // Obstacle must NOT be consumed, staying permanently in the 3D world
    expect(game.consumed.has('passed-rock')).toBe(false);
    expect(game.cleared.has('passed-rock')).toBe(true);
    expect(game.lives).toBe(3);
  });
  it('decreases health and energy and triggers hit recoil when colliding with an obstacle', () => {
    const track = { ...empty(), items: [{ id: 'log-hit', x: 500, kind: 'log' as const }] };
    const game = new Simulation(track);
    game.start();
    const initialEnergy = game.energy;
    advance(game, 1.8); // Hits log around 1.7s
    expect(game.lives).toBe(2);
    expect(game.energy).toBeLessThan(initialEnergy);
    expect(game.consumed.has('log-hit')).toBe(false);
    expect(game.cleared.has('log-hit')).toBe(true);
    expect(game.hurt).toBeGreaterThan(0);
    expect(game.shake).toBeGreaterThan(0);
  });
  it('propels player vertically when hitting a vertical spring pad', () => {
    const track = { ...empty(), items: [{ id: 'spring-1', x: 450, kind: 'spring' as const }] };
    const game = new Simulation(track);
    game.start();
    advance(game, 1.58);
    expect(game.consumed.has('spring-1')).toBe(true);
    expect(game.height).toBeGreaterThan(0);
  });
  it('toggles camera mode between side and first-person view', () => {
    const game = new Simulation(empty());
    expect(game.cameraView).toBe('side');
    game.toggleCameraView();
    expect(game.cameraView).toBe('first_person');
    game.toggleCameraView();
    expect(game.cameraView).toBe('side');
  });
  it('allows customizing camera zoom and character scale', () => {
    const game = new Simulation(empty(), undefined, undefined, undefined, 1.4, 1.25);
    expect(game.characterScale).toBe(1.4);
    expect(game.cameraZoom).toBe(1.25);
    game.setCameraZoom(1.8);
    game.setCharacterScale(0.8);
    expect(game.cameraZoom).toBe(1.8);
    expect(game.characterScale).toBe(0.8);
  });
  it('collects elemental power orbs on the track and adds them to collectedPowers', () => {
    const track = { ...empty(), items: [{ id: 'pw-1', x: 450, kind: 'power_fire' as const }] };
    const game = new Simulation(track);
    game.start();
    advance(game, 1.58);
    expect(game.consumed.has('pw-1')).toBe(true);
    expect(game.collectedPowers.has('flame_burst')).toBe(true);
  });
  it('damages player upon direct contact with an active boss entity', () => {
    const track = {
      ...empty(),
      boss: {
        id: 'test-boss',
        name: 'Boss Gigante',
        element: 'fire' as const,
        size: 1.5,
        health: 100,
        maxHealth: 100,
        damage: 1,
        speed: 300,
        attackFrequency: 5,
        projectileType: 'fireball' as const,
        projectileSpeed: 300,
        weakness: 'water' as const,
        resistance: 'fire' as const,
      },
    };
    const game = new Simulation(track);
    game.start();
    // Simulate player right next to boss
    game.distance = track.length - 280;
    if (game.bossEntity) {
      game.bossEntity.x = track.length - 280;
      game.bossEntity.y = 10;
    }
    const initialLives = game.lives;
    advance(game, 0.1);
    expect(game.lives).toBeLessThan(initialLives);
    expect(game.hurt).toBeGreaterThan(0);
  });

  it('keeps a defeated boss visible long enough for its destruction animation', () => {
    const track = {
      ...empty(),
      boss: {
        id: 'destructible-boss', name: 'Boss', element: 'fire' as const, size: 1,
        health: 1, maxHealth: 1, damage: 1, speed: 45, attackFrequency: 6,
        projectileType: 'fireball' as const, projectileSpeed: 180,
        weakness: 'water' as const, resistance: 'fire' as const,
      },
    };
    const game = new Simulation(track); game.start();
    game.distance = track.length - 800; game.update(STEP);
    const boss = game.bossEntity!;
    game.projectiles.push({ id: 'finisher', sender: 'player', x: boss.x - 100, y: boss.y,
      vx: 20000, vy: 0, damage: 10, element: 'water', type: 'aqua_shield', size: 16,
      color: '#0ff', life: 2 });
    game.update(STEP);
    expect(boss.defeated).toBe(true);
    expect(boss.defeatTimer).toBe(1.2);
    game.update(STEP);
    expect(boss.defeatTimer).toBeLessThan(1.2);
    expect(boss.defeatTimer).toBeGreaterThan(0);
  });

  it('charges Mega Man Buster power attack over time and unleashes scaled projectile', () => {
    const track = {
      ...empty(),
      boss: {
        id: 'test_boss',
        name: 'Pyra Mega',
        element: 'fire' as const,
        size: 1.2,
        health: 200,
        maxHealth: 200,
        damage: 1,
        speed: 120,
        attackFrequency: 3,
        projectileType: 'fireball' as const,
        projectileSpeed: 280,
        weakness: 'water' as const,
        resistance: 'nature' as const,
      },
    };
    const game = new Simulation(track, undefined, 'aqua_shield');
    game.start();

    // Normal tap shot
    game.castPower();
    expect(game.projectiles).toHaveLength(1);
    const normalProj = game.projectiles[0];
    expect(normalProj.size).toBe(18);
    const normalDmg = normalProj.damage;
    game.projectiles = [];
    game.powerCooldown = 0;

    // Buster charge
    game.startChargingPower();
    expect(game.isChargingPower).toBe(true);
    expect(game.hud().isChargingPower).toBe(true);
    advance(game, 1.4); // Full charge duration
    expect(game.powerChargeRatio).toBeCloseTo(1.0, 1);
    expect(game.hud().powerChargeRatio).toBeGreaterThanOrEqual(0.99);

    // Release charged attack
    game.releaseChargedPower();
    expect(game.isChargingPower).toBe(false);
    expect(game.projectiles).toHaveLength(1);
    const chargedProj = game.projectiles[0];

    // Projectile size scales up progressively with charge ratio + 100% tier (18 + 20 + 8 = 46px)
    expect(chargedProj.size).toBeGreaterThan(38);
    // Projectile damage scales up significantly
    expect(chargedProj.damage).toBeGreaterThan(normalDmg * 2.5);
    // Projectile color reflects fiery charged power
    expect(chargedProj.color).toBe('#f59e0b');
  });

  it('keeps charging and accumulating power until released or hit by an obstacle/boss', () => {
    const track = {
      ...empty(),
      items: [
        { id: 'hazard-log', x: 4500, kind: 'log' as const },
      ],
    };
    const game = new Simulation(track, undefined, 'flame_burst');
    game.start();

    // Start charging
    game.startChargingPower();
    expect(game.isChargingPower).toBe(true);

    // Advance 2.8 seconds (2x standard charge duration -> powerChargeRatio reaches ~2.0)
    advance(game, 2.8);
    expect(game.isChargingPower).toBe(true);
    expect(game.powerChargeRatio).toBeCloseTo(2.0, 1);
    expect(game.powerChargeTime).toBeCloseTo(2.8, 1);

    // Release at 2.0x charge: projectile size scales up progressively (18 + 40 + 16 = 74px)
    game.releaseChargedPower();
    expect(game.isChargingPower).toBe(false);
    expect(game.projectiles).toHaveLength(1);
    const megaProj = game.projectiles[0];
    expect(megaProj.size).toBe(74);

    // Start charging again and advance until hitting an obstacle
    game.projectiles = [];
    game.powerCooldown = 0;
    game.startChargingPower();
    expect(game.isChargingPower).toBe(true);

    // Collide with obstacle -> Charge is immediately cancelled/lost
    game.distance = 4500;
    advance(game, 0.05);
    expect(game.hurt).toBeGreaterThan(0);
    expect(game.isChargingPower).toBe(false);
    expect(game.powerChargeTime).toBe(0);
    expect(game.powerChargeRatio).toBe(0);

    // Releasing cancelled charge does not fire
    game.projectiles = [];
    game.releaseChargedPower();
    expect(game.projectiles).toHaveLength(0);
  });

  it('supports tablet swipe bidirectional movement during boss fight', () => {
    const track = {
      ...empty(),
      boss: {
        id: 'test_boss',
        name: 'Pyra Mega',
        element: 'fire' as const,
        size: 1.2,
        health: 200,
        maxHealth: 200,
        damage: 1,
        speed: 120,
        attackFrequency: 3,
        projectileType: 'fireball' as const,
        projectileSpeed: 280,
        weakness: 'water' as const,
        resistance: 'nature' as const,
      },
    };
    const game = new Simulation(track);
    game.start();
    game.distance = track.length - 300;
    game.encounterStarted = true;
    expect(game.inBossFight).toBe(true);

    // Swipe left (retreat / move backwards)
    game.setMoveAxis(-1);
    expect(game.moveAxis).toBe(-1);
    expect(game.facing).toBe(-1);
    const pos1 = game.distance;
    advance(game, 0.2);
    expect(game.distance).toBeLessThan(pos1);

    // Swipe right (advance forward)
    game.setMoveAxis(1);
    expect(game.moveAxis).toBe(1);
    expect(game.facing).toBe(1);
    const pos2 = game.distance;
    advance(game, 0.2);
    expect(game.distance).toBeGreaterThan(pos2);

    // Release swipe
    game.setMoveAxis(0);
    expect(game.moveAxis).toBe(0);
  });

  it('respawns player at reached checkpoint with restored resources and invulnerability', () => {
    const track = { ...empty(), length: 12000 };
    const game = new Simulation(track);
    game.start();
    // Advance past checkpoint 1 (3000m)
    game.distance = 3200;
    game.furthestDistance = 3200;
    game.update(STEP);
    expect(game.checkpoint).toBe(1);

    // Player takes fatal damage
    game.lives = 0;
    game.update(STEP);
    expect(game.phase).toBe('GAME_OVER');

    // Respawn at checkpoint
    const respawned = game.respawnAtCheckpoint();
    expect(respawned).toBe(true);
    expect(game.phase).toBe('PLAYING');
    expect(game.distance).toBe(3000);
    expect(game.lives).toBe(3);
    expect(game.energy).toBe(game.maxEnergy);
    expect(game.time).toBeGreaterThanOrEqual(35);
    expect(game.hurt).toBe(2.0); // invulnerability
  });

  it('keeps player projectiles active until hitting an obstacle or leaving the world', () => {
    const track = { ...empty(), length: 10000 };
    const game = new Simulation(track);
    game.start();
    game.castPower(0);
    expect(game.projectiles).toHaveLength(1);
    const proj = game.projectiles[0];
    expect(proj.life).toBe(Infinity);

    // Advance 5 seconds through empty air without despawning
    advance(game, 5);
    expect(game.projectiles).toHaveLength(1);
    expect(game.projectiles[0].x).toBeGreaterThan(1000);
  });

  it('scales projectile size progressively with charge ratio and 100% tiers', () => {
    const track = { ...empty(), length: 10000 };
    const game = new Simulation(track);
    game.start();

    // Normal shot (charge 0)
    game.castPower(0);
    const pNormal = game.projectiles[0];
    expect(pNormal.size).toBe(18);

    // 100% charged shot (charge 1.0) -> 18 + 20 + 8 = 46
    game.projectiles.length = 0;
    game.powerCooldown = 0;
    game.energy = 100;
    game.castPower(1.0);
    const pTier1 = game.projectiles[0];
    expect(pTier1.size).toBe(46);
    expect(pTier1.size).toBeGreaterThan(pNormal.size);

    // 200% charged shot (charge 2.0) -> 18 + 40 + 16 = 74
    game.projectiles.length = 0;
    game.powerCooldown = 0;
    game.energy = 100;
    game.castPower(2.0);
    const pTier2 = game.projectiles[0];
    expect(pTier2.size).toBe(74);
    expect(pTier2.size).toBeGreaterThan(pTier1.size);
  });
});
describe('playable track validation', () => {
  it('accepts all 18 built-in official progression levels', () => {
    expect(TRACKS.length).toBe(18);
    TRACKS.forEach((track) => expect(validateTrack(track)).toBeNull());
  });
  it('rejects impossible obstacle spacing and invalid positions', () => {
    expect(
      validateTrack({
        ...empty(),
        items: [
          { id: 'a', kind: 'rock', x: 600 },
          { id: 'b', kind: 'branch', x: 700 },
        ],
      }),
    ).toContain('Separa');
    expect(validateTrack({ ...empty(), items: [{ id: 'a', kind: 'coin', x: NaN }] })).toContain(
      'espacio',
    );
  });
  it('allows coins around obstacles while enforcing safe start and finish', () => {
    expect(
      validateTrack({
        ...empty(),
        items: [
          { id: 'a', kind: 'log', x: 600 },
          { id: 'b', kind: 'coin', x: 620 },
        ],
      }),
    ).toBeNull();
    expect(validateTrack({ ...empty(), items: [{ id: 'a', kind: 'rock', x: 50 }] })).not.toBeNull();
    expect(validateTrack({ ...empty(), name: '' })).not.toBeNull();
  });
});
