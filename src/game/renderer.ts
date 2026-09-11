import { WORLDS } from '../lib/worlds';
import type { Character, WorldId } from '../lib/types';
import type { Simulation } from './simulation';

export function drawFox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  stride = 0,
  isHurt = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);

  // Geometric silhouette stays crisp at small sizes
  ctx.fillStyle = isHurt ? '#ff5252' : color;
  ctx.beginPath();
  ctx.moveTo(-20, 21);
  ctx.quadraticCurveTo(-56, 22, -45, -10);
  ctx.lineTo(-29, 3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isHurt ? '#ffebee' : '#fff3d7';
  ctx.beginPath();
  ctx.moveTo(-45, -10);
  ctx.lineTo(-38, 13);
  ctx.lineTo(-30, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isHurt ? '#ff5252' : color;
  ctx.beginPath();
  ctx.ellipse(-3, 13, 23, 17, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(-19 + Math.sin(stride) * 5, 22, 10, 14);
  ctx.fillRect(10 - Math.sin(stride) * 5, 21, 9, 15);

  ctx.beginPath();
  ctx.moveTo(-13, -12);
  ctx.lineTo(-13, -36);
  ctx.lineTo(0, -23);
  ctx.lineTo(16, -26);
  ctx.lineTo(28, -40);
  ctx.lineTo(30, -14);
  ctx.lineTo(39, -3);
  ctx.lineTo(23, 11);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isHurt ? '#b71c1c' : '#563f36';
  ctx.beginPath();
  ctx.moveTo(-9, -28);
  ctx.lineTo(-8, -14);
  ctx.lineTo(0, -20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(24, -31);
  ctx.lineTo(19, -21);
  ctx.lineTo(27, -18);
  ctx.fill();

  ctx.fillStyle = isHurt ? '#ffebee' : '#fff3d7';
  ctx.beginPath();
  ctx.moveTo(-7, -1);
  ctx.quadraticCurveTo(8, 14, 34, -5);
  ctx.lineTo(39, -3);
  ctx.lineTo(23, 11);
  ctx.lineTo(-8, 6);
  ctx.fill();

  ctx.fillStyle = isHurt ? '#d32f2f' : '#243b32';
  ctx.fillRect(19, -13, 4, 5);
  ctx.beginPath();
  ctx.arc(36, -3, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHurt ? '#b71c1c' : '#315c49';
  ctx.fillRect(-10, 5, 33, 5);
  ctx.fillRect(-12, 8, 9, 15);

  ctx.restore();
}

export function drawLandscape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  world: WorldId,
  distance: number,
  playerHeight = 0,
  reduced = false,
) {
  const palette = WORLDS[world] || WORLDS.forest;
  // Parallax responds slightly to vertical speedrun jump height
  const verticalShift = playerHeight * 0.14;
  const ground = height * 0.79 + verticalShift;

  // Sky background
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, width, height);

  // World specific celestial or atmospheric background
  if (world === 'neon') {
    // Cyberpunk grid lines & neon sun
    const sunGrad = ctx.createLinearGradient(0, height * 0.1, 0, height * 0.6);
    sunGrad.addColorStop(0, '#ff007f');
    sunGrad.addColorStop(1, '#7928ca');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(width * 0.75, height * 0.35, height * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Synthwave horizontal horizon lines
    ctx.strokeStyle = '#ff007f33';
    ctx.lineWidth = 1.5;
    for (let y = height * 0.38; y < ground; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  } else if (world === 'volcano') {
    // Red glowing volcanic haze and ash particles
    ctx.fillStyle = '#ff450033';
    ctx.beginPath();
    ctx.arc(width * 0.7, height * 0.28, height * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff7700';
    for (let i = 0; i < 40; i++) {
      const emberX = ((i * 93 + distance * 0.2) % width + width) % width;
      const emberY = (i * 37.1) % (height * 0.7);
      ctx.fillRect(emberX, emberY, 2.5, 2.5);
    }
  } else if (world === 'alpine') {
    // Crisp snowy mountain peaks with floating ice clouds
    ctx.fillStyle = '#ffffffdd';
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.22, height * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff55';
    for (let i = 0; i < 30; i++) {
      const flakeX = ((i * 77 - distance * 0.3) % width + width) % width;
      const flakeY = (i * 47) % height;
      ctx.fillRect(flakeX, flakeY, 3, 3);
    }
  } else if (world === 'night') {
    ctx.fillStyle = '#efeaca';
    ctx.beginPath();
    ctx.arc(width * 0.75, height * 0.24, height * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dce6e8';
    for (let i = 0; i < 35; i++)
      ctx.fillRect((i * 117.7) % width, (i * 43.1) % (height * 0.53), 2, 2);
  } else {
    // Day / Sunset sun & clouds
    ctx.fillStyle = world === 'sunset' ? '#ff9e64' : '#f9f4cf';
    ctx.beginPath();
    ctx.arc(width * 0.75, height * 0.24, height * 0.09, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f4f7e8';
    for (let i = 0; i < 4; i++) {
      const x =
        ((((i * 263 - distance * (reduced ? 0 : 0.04)) % (width + 170)) + width + 170) %
          (width + 170)) -
        85;
      ctx.beginPath();
      ctx.ellipse(x, height * (0.18 + (i % 2) * 0.11), 54, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3-layer parallax mountains / skyline
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle =
      layer === 0 ? palette.mountain : layer === 1 ? palette.trees + '55' : palette.trees + '88';
    const drift = reduced ? 0 : distance * (0.08 + layer * 0.1),
      step = 330 - layer * 60;
    ctx.beginPath();
    ctx.moveTo(0, ground);
    for (let x = -step; x <= width + step; x += step) {
      const px = x - (drift % step);
      if (world === 'neon') {
        // Futuristic skyscrapers in background
        const bHeight = height * (0.2 + ((layer * 3 + Math.abs(x)) % 5) * 0.06);
        ctx.rect(px, ground - bHeight, step * 0.65, bHeight);
      } else {
        ctx.lineTo(px, ground - height * (0.15 + layer * 0.03));
        ctx.quadraticCurveTo(
          px + step * 0.45,
          height * (0.23 + layer * 0.13) + verticalShift * 0.5,
          px + step,
          ground - height * (0.15 + layer * 0.03),
        );
      }
    }
    if (world !== 'neon') {
      ctx.lineTo(width + step, ground);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fill();
    }
  }

  // Foreground trees/structures
  ctx.fillStyle = palette.trees;
  for (let i = -1; i < width / 200 + 2; i++) {
    const x = i * 200 - (reduced ? 0 : (distance * 0.45) % 200),
      treeHeight = height * (0.28 + (Math.abs(i) % 3) * 0.05);
    if (world === 'sunset' || world === 'neon') {
      ctx.fillRect(x, ground - treeHeight * 0.6, 10, treeHeight * 0.6);
      ctx.beginPath();
      ctx.ellipse(x + 4, ground - treeHeight * 0.6, 34, 17, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - 4, ground - treeHeight, 8, treeHeight);
      for (let j = 0; j < 3; j++) {
        const y = ground - treeHeight + j * treeHeight * 0.22;
        ctx.beginPath();
        ctx.moveTo(x, y - treeHeight * 0.22);
        ctx.lineTo(x - treeHeight * (0.2 + j * 0.06), y + treeHeight * 0.34);
        ctx.lineTo(x + treeHeight * (0.2 + j * 0.06), y + treeHeight * 0.34);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Ground plane with 3D perspective shading
  const groundGrad = ctx.createLinearGradient(0, ground, 0, height);
  groundGrad.addColorStop(0, palette.ground);
  groundGrad.addColorStop(1, '#0b0f0e');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, ground, width, height - ground);

  // Ground track accent neon/highlight line
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, ground, width, 5);
  ctx.globalAlpha = 1;

  // Running speed lines on the ground
  ctx.fillStyle = '#ffffff25';
  for (let i = 0; i < 32; i++)
    ctx.fillRect(
      (((i * 73 - distance * 1.1) % (width + 40)) + width + 40) % (width + 40),
      ground + 15 + (i % 5) * 16,
      16,
      3,
    );
}

export class Renderer {
  private image?: HTMLImageElement;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private character: Character,
  ) {
    if (character.image) {
      this.image = new Image();
      this.image.src = character.image;
    }
  }

  render(game: Simulation, width: number, height: number, reduced: boolean) {
    const ctx = this.ctx;
    ctx.save();

    // Screen Shake effect when hit
    if (game.shake > 0 && !reduced) {
      const s = game.shake * 14;
      const shakeX = (Math.random() - 0.5) * s;
      const shakeY = (Math.random() - 0.5) * s;
      ctx.translate(shakeX, shakeY);
    }

    if (game.cameraView === 'first_person') {
      this.renderFirstPerson(game, width, height, reduced);
    } else {
      this.renderSideView(game, width, height, reduced);
    }

    // Impact / Damage vignette flash
    if (game.hurt > 0) {
      const alpha = Math.min(0.55, game.hurt * 0.4);
      const vig = ctx.createRadialGradient(
        width / 2,
        height / 2,
        height * 0.3,
        width / 2,
        height / 2,
        width * 0.7,
      );
      vig.addColorStop(0, 'rgba(255, 0, 0, 0)');
      vig.addColorStop(1, `rgba(230, 20, 20, ${alpha})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }

  /**
   * 3D First-Person Mode (FPS Runner)
   * Forward-projecting 3D track, horizon, and scaling billboard obstacles
   */
  private renderFirstPerson(game: Simulation, width: number, height: number, reduced: boolean) {
    const ctx = this.ctx;
    const palette = WORLDS[game.track.world] || WORLDS.forest;
    const horizon = height * 0.48;
    const cameraBob = reduced ? 0 : Math.sin(game.distance * 0.035) * (game.height > 0 ? 0 : 7);
    const playerZJump = game.height * 0.65;

    // 1. Sky & Horizon
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, width, horizon + cameraBob - playerZJump);

    // Mountain silhouettes on horizon
    ctx.fillStyle = palette.mountain;
    ctx.beginPath();
    ctx.moveTo(0, horizon + cameraBob - playerZJump);
    for (let x = 0; x <= width; x += 60) {
      const my = horizon + cameraBob - playerZJump - 35 - ((x * 17) % 25);
      ctx.lineTo(x, my);
    }
    ctx.lineTo(width, horizon + cameraBob - playerZJump);
    ctx.closePath();
    ctx.fill();

    // 2. 3D Forward Runway / Road
    const trackNearWidth = width * 0.72;
    const trackFarWidth = width * 0.04;
    const centerX = width / 2;

    const roadGrad = ctx.createLinearGradient(0, horizon, 0, height);
    roadGrad.addColorStop(0, palette.trees);
    roadGrad.addColorStop(1, palette.ground);
    ctx.fillStyle = roadGrad;

    // Ground surrounding track
    ctx.fillRect(0, horizon + cameraBob - playerZJump, width, height);

    // Perspective Runway Polygon
    ctx.fillStyle = '#1c2826';
    ctx.beginPath();
    ctx.moveTo(centerX - trackFarWidth / 2, horizon + cameraBob - playerZJump);
    ctx.lineTo(centerX + trackFarWidth / 2, horizon + cameraBob - playerZJump);
    ctx.lineTo(centerX + trackNearWidth / 2, height);
    ctx.lineTo(centerX - trackNearWidth / 2, height);
    ctx.closePath();
    ctx.fill();

    // 3D Grid / Distance horizontal stripes moving toward camera
    const strideOffset = (game.distance % 120) / 120;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    for (let i = 1; i <= 14; i++) {
      const p = Math.pow((i + strideOffset) / 15, 2.5); // Perspective scaling
      const y = horizon + cameraBob - playerZJump + p * (height - (horizon + cameraBob - playerZJump));
      const w = trackFarWidth + p * (trackNearWidth - trackFarWidth);
      ctx.beginPath();
      ctx.moveTo(centerX - w / 2, y);
      ctx.lineTo(centerX + w / 2, y);
      ctx.stroke();
    }

    // Runway borders
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX - trackFarWidth / 2, horizon + cameraBob - playerZJump);
    ctx.lineTo(centerX - trackNearWidth / 2, height);
    ctx.moveTo(centerX + trackFarWidth / 2, horizon + cameraBob - playerZJump);
    ctx.lineTo(centerX + trackNearWidth / 2, height);
    ctx.stroke();

    // 3. Project 3D Track Items (Obstacles, coins, springs)
    // Filter items in front of player and sort from far to near for correct depth rendering
    const visibleItems = game.track.items
      .filter((item) => {
        const dist = item.x - game.distance;
        return dist >= -40 && dist <= 2600 && !game.consumed.has(item.id);
      })
      .sort((a, b) => b.x - a.x);

    for (const item of visibleItems) {
      const dist = item.x - game.distance;
      // In 3D: depth z goes from 0 (at player) to 2500 (horizon)
      const depth = Math.max(1, dist);
      // Perspective projection scale:
      const p = Math.max(0, Math.min(1, 1 - depth / 2400));
      const scale = Math.pow(p, 2.2);

      const y = horizon + cameraBob - playerZJump + scale * (height - (horizon + cameraBob - playerZJump));
      const x = centerX; // Center lane
      const itemSize = 120 * scale;

      if (scale < 0.05) continue;

      ctx.save();
      ctx.translate(x, y);

      this.drawItem3D(ctx, item.kind, itemSize);
      ctx.restore();
    }

    // 4. First-Person Cockpit / Speed Dash Overlay
    this.drawFirstPersonCockpit(ctx, width, height, game);
  }

  /**
   * First-person HUD / Cockpit speed lines and hands/shield
   */
  private drawFirstPersonCockpit(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    game: Simulation,
  ) {
    // Speed lines if boosting
    if (game.boost > 0) {
      ctx.strokeStyle = '#ffffff55';
      ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const r1 = Math.min(width, height) * 0.35;
        const r2 = Math.min(width, height) * 0.65;
        ctx.beginPath();
        ctx.moveTo(width / 2 + Math.cos(angle) * r1, height / 2 + Math.sin(angle) * r1);
        ctx.lineTo(width / 2 + Math.cos(angle) * r2, height / 2 + Math.sin(angle) * r2);
        ctx.stroke();
      }
    }

    // First Person Energy / Reticle in center
    ctx.strokeStyle = game.shield > 0 ? '#bfe8fa' : '#d8f36a88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 24, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(width / 2 - 12, height / 2);
    ctx.lineTo(width / 2 + 12, height / 2);
    ctx.moveTo(width / 2, height / 2 - 12);
    ctx.lineTo(width / 2, height / 2 + 12);
    ctx.stroke();

    // Altitude indicator when airborne in speedrun
    if (game.height > 10) {
      ctx.fillStyle = '#ffffffdd';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ALT: +${Math.round(game.height)}m`, width / 2, height / 2 - 36);
    }
  }

  /**
   * Render individual items for First-Person 3D mode
   */
  private drawItem3D(ctx: CanvasRenderingContext2D, kind: string, size: number) {
    if (kind === 'coin') {
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(0, -size * 0.6, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b68b39';
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.stroke();
    } else if (kind === 'spring') {
      // 3D Launch Spring Pad
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-size * 0.4, -size * 0.2, size * 0.8, size * 0.2);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.2, size * 0.4, size * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillText('▲', 0, -size * 0.05);
    } else if (kind === 'ring') {
      // 3D Boost Ring in the air
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = Math.max(2, size * 0.12);
      ctx.beginPath();
      ctx.arc(0, -size * 1.3, size * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'log') {
      ctx.fillStyle = '#866248';
      ctx.fillRect(-size * 0.5, -size * 0.4, size, size * 0.4);
      ctx.fillStyle = '#c39a6a';
      ctx.beginPath();
      ctx.ellipse(size * 0.45, -size * 0.2, size * 0.1, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'rock') {
      ctx.fillStyle = '#95a49b';
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, 0);
      ctx.lineTo(-size * 0.3, -size * 0.5);
      ctx.lineTo(0, -size * 0.7);
      ctx.lineTo(size * 0.35, -size * 0.4);
      ctx.lineTo(size * 0.45, 0);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'branch') {
      ctx.fillStyle = '#70533e';
      ctx.fillRect(-size * 0.5, -size * 1.1, size, size * 0.3);
      ctx.fillStyle = '#76a565';
      ctx.beginPath();
      ctx.ellipse(0, -size * 1.1, size * 0.55, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Powerups (shield, boost, time)
      ctx.fillStyle = kind === 'shield' ? '#afdbef' : kind === 'boost' ? '#e5bafa' : '#d8f36a';
      ctx.beginPath();
      ctx.roundRect(-size * 0.3, -size * 0.8, size * 0.6, size * 0.6, size * 0.15);
      ctx.fill();
    }
  }

  /**
   * Enhanced 2.5D Side-Scroller with Verticality and Parallax
   */
  private renderSideView(game: Simulation, width: number, height: number, reduced: boolean) {
    const ctx = this.ctx,
      ground = height * 0.79,
      scale = Math.min(1, height / 430),
      px = width * 0.23;

    drawLandscape(ctx, width, height, game.track.world, game.distance, game.height, reduced);
    ctx.save();

    // 1. Draw Track Items (Obstacles, Collectibles, Springs, Rings)
    for (const item of game.track.items) {
      const x = px + (item.x - game.distance) * scale;
      // Do not skip obstacles if passed! Draw them so long as they are on screen and not destroyed by hit
      if (x < -120 || x > width + 120 || game.consumed.has(item.id)) continue;

      ctx.save();
      ctx.translate(x, ground);
      ctx.scale(scale, scale);

      if (item.kind === 'coin') {
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath();
        ctx.arc(0, -62, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b68b39';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#b68b39';
        ctx.fillRect(-1, -67, 2, 10);
      } else if (item.kind === 'spring') {
        // Vertical Launch Spring
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-22, -18, 44, 18);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(0, -18, 22, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (item.kind === 'ring') {
        // Air boost speedrun ring
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -125, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (item.kind === 'log') {
        ctx.fillStyle = '#866248';
        ctx.fillRect(-24, -31, 48, 31);
        ctx.fillStyle = '#c39a6a';
        ctx.beginPath();
        ctx.ellipse(22, -15, 7, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#533e34';
        ctx.strokeRect(-24, -31, 48, 31);
      } else if (item.kind === 'rock') {
        ctx.fillStyle = '#95a49b';
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(-20, -31);
        ctx.lineTo(1, -47);
        ctx.lineTo(22, -32);
        ctx.lineTo(29, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#c3ccc0';
        ctx.beginPath();
        ctx.moveTo(-20, -31);
        ctx.lineTo(1, -47);
        ctx.lineTo(8, -25);
        ctx.fill();
      } else if (item.kind === 'branch') {
        ctx.fillStyle = '#70533e';
        ctx.fillRect(-26, -85, 52, 38);
        ctx.fillStyle = '#76a565';
        ctx.beginPath();
        ctx.ellipse(0, -86, 36, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle =
          item.kind === 'shield' ? '#afdbef' : item.kind === 'boost' ? '#e5bafa' : '#d8f36a';
        ctx.beginPath();
        ctx.roundRect(-15, -85, 30, 30, 9);
        ctx.fill();
        ctx.fillStyle = '#274c3f';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.kind === 'shield' ? '◇' : item.kind === 'boost' ? 'ϟ' : '+', 0, -63);
      }
      ctx.restore();
    }

    // 2. Checkpoint banner
    const nextCheckpoint = (game.checkpoint + 1) * 3000;
    if (nextCheckpoint <= game.track.length) {
      const x = px + (nextCheckpoint - game.distance) * scale;
      if (x > -40 && x < width + 40) {
        ctx.strokeStyle = '#e5efc6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, ground);
        ctx.lineTo(x, ground - 100 * scale);
        ctx.stroke();
        ctx.fillStyle = '#d8f36a';
        ctx.fillRect(x, ground - 100 * scale, 38 * scale, 22 * scale);
      }
    }

    // 3. Render Character with Hit Animation & Energy Visuals
    const isHurtFlash = game.hurt > 0 && Math.floor(game.hurt * 14) % 2 === 0;
    ctx.globalAlpha = isHurtFlash ? 0.35 : 1;

    // Recoil / Hit wobble
    const hitAngle = game.hurt > 0 ? Math.sin(game.hurt * 25) * 0.25 : 0;

    ctx.translate(px, ground - game.height * scale - (game.slide > 0 ? 16 : 31) * scale);
    if (hitAngle !== 0) ctx.rotate(hitAngle);
    if (game.slide > 0) ctx.scale(1.15, 0.55);

    // Speedrun Aerial Altitude Shadow on Ground
    if (game.height > 10) {
      ctx.save();
      const shadowScale = Math.max(0.2, 1 - game.height / 350);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, game.height * scale + (game.slide > 0 ? 16 : 31) * scale, 25 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Shield Aura
    if (game.shield > 0) {
      ctx.strokeStyle = '#bfe8fa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 47 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.image?.complete && this.image.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-30 * scale, -30 * scale, 60 * scale, 60 * scale, 12);
      ctx.clip();
      ctx.drawImage(this.image, -30 * scale, -30 * scale, 60 * scale, 60 * scale);
      ctx.restore();
    } else if (this.character.pixels) {
      const unit = 4 * scale;
      this.character.pixels.forEach((c, i) => {
        if (c !== 'transparent') {
          ctx.fillStyle = isHurtFlash ? '#ff5252' : c;
          ctx.fillRect(
            (i % 16) * unit - 32 * scale,
            Math.floor(i / 16) * unit - 32 * scale,
            unit + 0.2,
            unit + 0.2,
          );
        }
      });
    } else {
      drawFox(
        ctx,
        0,
        0,
        57 * scale,
        this.character.color,
        game.height ? 0 : game.distance * 0.045,
        isHurtFlash,
      );
    }

    ctx.restore();
  }
}
