import { WORLDS } from '../lib/worlds';
import type {
  Character,
  Scenario,
  ScenarioAsset,
  ScenarioLayer,
  ScenarioObject,
  TrackItem,
  WorldId,
} from '../lib/types';
import type { Simulation } from './simulation';

export function drawFox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  stride = 0,
  isHurt = false,
  isJumping = false,
  jumpVelocity = 0,
  isSliding = false,
  slideProgress = 1,
) {
  ctx.save();
  ctx.translate(x, y);

  // Jump animation: stretch upward on ascent, tilt slightly forward on descent
  if (isJumping) {
    const tilt = Math.max(-0.25, Math.min(0.25, -jumpVelocity * 0.0003));
    ctx.rotate(tilt);
    const stretchY = jumpVelocity > 0 ? 1.15 : 0.95;
    const stretchX = jumpVelocity > 0 ? 0.9 : 1.05;
    ctx.scale((size / 64) * stretchX, (size / 64) * stretchY);
  } else if (isSliding) {
    // Dynamic slide compression with responsive standing recovery
    const squishY = 0.6 + (1 - slideProgress) * 0.35;
    const stretchX = 1.3 - (1 - slideProgress) * 0.25;
    ctx.rotate(-0.08 * slideProgress);
    ctx.scale((size / 64) * stretchX, (size / 64) * squishY);
  } else {
    // Running bob and stride tilt
    const runBob = Math.abs(Math.sin(stride * 2)) * 3;
    const runTilt = Math.sin(stride) * 0.05;
    ctx.translate(0, -runBob);
    ctx.rotate(runTilt);
    ctx.scale(size / 64, size / 64);
  }

  // Animated tail wagging / trailing in wind
  const tailAngle = isJumping ? Math.sin(stride * 1.5) * 0.2 - 0.2 : Math.sin(stride) * 0.25;

  ctx.save();
  ctx.translate(-20, 21);
  ctx.rotate(tailAngle);
  ctx.fillStyle = isHurt ? '#ff5252' : color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-36, 1, -25, -31);
  ctx.lineTo(-9, -18);
  ctx.closePath();
  ctx.fill();

  // Tail tip
  ctx.fillStyle = isHurt ? '#ffebee' : '#fff3d7';
  ctx.beginPath();
  ctx.moveTo(-25, -31);
  ctx.lineTo(-18, -8);
  ctx.lineTo(-10, -17);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Torso / Body
  ctx.fillStyle = isHurt ? '#ff5252' : color;
  ctx.beginPath();
  ctx.ellipse(-3, 13, 23, 17, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Animated legs with 4-phase stride or airborne tuck
  if (isJumping) {
    // Paws tucked under body during aerial leap
    ctx.fillStyle = isHurt ? '#b71c1c' : '#315c49';
    ctx.fillRect(-15, 20, 11, 8);
    ctx.fillRect(8, 19, 10, 8);
  } else if (isSliding) {
    // Legs stretched back in slide
    ctx.fillStyle = isHurt ? '#b71c1c' : '#315c49';
    ctx.fillRect(-24, 21, 18, 6);
    ctx.fillRect(4, 20, 16, 6);
  } else {
    // Dynamic run cycle with alternating front/back leg swings
    const leg1Offset = Math.sin(stride) * 11;
    const leg2Offset = -Math.sin(stride) * 11;
    ctx.fillRect(-19 + leg1Offset * 0.6, 22 + Math.max(0, -leg1Offset * 0.4), 10, 14);
    ctx.fillRect(10 + leg2Offset * 0.6, 21 + Math.max(0, -leg2Offset * 0.4), 9, 15);
  }

  // Head and ears
  ctx.fillStyle = isHurt ? '#ff5252' : color;
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

  // Inner ears
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

  // Muzzle & Whiskers
  ctx.fillStyle = isHurt ? '#ffebee' : '#fff3d7';
  ctx.beginPath();
  ctx.moveTo(-7, -1);
  ctx.quadraticCurveTo(8, 14, 34, -5);
  ctx.lineTo(39, -3);
  ctx.lineTo(23, 11);
  ctx.lineTo(-8, 6);
  ctx.fill();

  // Eye
  ctx.fillStyle = isHurt ? '#d32f2f' : '#243b32';
  ctx.fillRect(19, -13, 4, 5);
  // Nose
  ctx.beginPath();
  ctx.arc(36, -3, 3, 0, Math.PI * 2);
  ctx.fill();

  // Chest bandana / scarf with wind flutter
  const scarfWave = Math.sin(stride * 2.5) * 3;
  ctx.fillStyle = isHurt ? '#b71c1c' : '#315c49';
  ctx.fillRect(-10, 5, 33, 5);
  ctx.fillRect(-12 + scarfWave * 0.4, 8, 9, 15);

  ctx.restore();
}

export function drawLandscape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  world: WorldId,
  distance: number,
  reduced = false,
) {
  const palette = WORLDS[world] || WORLDS.forest;
  // Ground line: fixed horizon across 2D/3D views
  const ground = height * 0.79;

  // 1. Sky background
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, width, height);

  // 2. World-specific celestial or atmospheric background
  if (world === 'neon') {
    // Cyberpunk sun
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
    // Red glowing volcanic haze and continuous looping ash embers
    ctx.fillStyle = '#ff450033';
    ctx.beginPath();
    ctx.arc(width * 0.7, height * 0.28, height * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff7700';
    const emberLoop = Math.max(width, 800);
    for (let i = 0; i < 45; i++) {
      const baseX = i * 67.3;
      const emberX = (((baseX - distance * 0.25) % emberLoop) + emberLoop) % emberLoop;
      if (emberX <= width + 5) {
        const emberY = (i * 37.1) % (height * 0.7);
        ctx.fillRect(emberX, emberY, 2.5, 2.5);
      }
    }
  } else if (world === 'alpine') {
    // Crisp snowy sun and continuous looping snowflakes
    ctx.fillStyle = '#ffffffdd';
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.22, height * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff66';
    const snowLoop = Math.max(width, 800);
    for (let i = 0; i < 40; i++) {
      const baseX = i * 73.7;
      const flakeX = (((baseX - distance * 0.35) % snowLoop) + snowLoop) % snowLoop;
      if (flakeX <= width + 5) {
        const flakeY = (i * 47) % (height * 0.75);
        ctx.fillRect(flakeX, flakeY, 3, 3);
      }
    }
  } else if (world === 'night') {
    // Moon & starry sky
    ctx.fillStyle = '#efeaca';
    ctx.beginPath();
    ctx.arc(width * 0.75, height * 0.24, height * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dce6e8';
    for (let i = 0; i < 35; i++)
      ctx.fillRect((i * 117.7) % width, (i * 43.1) % (height * 0.53), 2, 2);
  } else {
    // Day / Sunset sun & seamless floating clouds
    ctx.fillStyle = world === 'sunset' ? '#ff9e64' : '#f9f4cf';
    ctx.beginPath();
    ctx.arc(width * 0.75, height * 0.24, height * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Floating Clouds: span width + cloud margin seamlessly
    ctx.fillStyle = '#f4f7e8dd';
    const cloudSpan = width + 260;
    const cloudSpeed = reduced ? 0 : 0.06;
    for (let i = 0; i < 5; i++) {
      const originX = i * (cloudSpan / 5);
      const cx = ((((originX - distance * cloudSpeed) % cloudSpan) + cloudSpan) % cloudSpan) - 130;
      ctx.beginPath();
      ctx.ellipse(cx, height * (0.16 + (i % 3) * 0.08), 56, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. 3-Layer Parallax Mountains / Skyline
  // Invariant: each segment uses a deterministic world-coordinate seed so there are zero pops
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle =
      layer === 0 ? palette.mountain : layer === 1 ? palette.trees + '66' : palette.trees + 'aa';

    const drift = reduced ? 0 : distance * (0.09 + layer * 0.11);
    const step = 280 - layer * 50;
    // Calculate first segment index in continuous world space
    const startIdx = Math.floor((drift - step * 2) / step);
    const endIdx = Math.ceil((drift + width + step * 2) / step);

    if (world === 'neon') {
      // Cyberpunk skyline buildings
      for (let idx = startIdx; idx <= endIdx; idx++) {
        const px = idx * step - drift;
        // Deterministic building height based on world segment index
        const hash = Math.sin(idx * 9301 + layer * 49297) * 49297;
        const norm = hash - Math.floor(hash);
        const bHeight = height * (0.2 + norm * 0.26);
        ctx.fillRect(px, ground - bHeight, step * 0.72, bHeight);
      }
    } else {
      // Seamless continuous mountain spline
      ctx.beginPath();
      const firstPx = startIdx * step - drift;
      ctx.moveTo(firstPx, ground);

      for (let idx = startIdx; idx <= endIdx; idx++) {
        const px = idx * step - drift;
        // Deterministic peak height at this world index
        const hash = Math.sin(idx * 7823 + layer * 1337) * 43758.5453;
        const norm = hash - Math.floor(hash);
        const peakY = ground - height * (0.16 + layer * 0.05 + norm * 0.12);

        ctx.lineTo(px, ground - height * (0.12 + layer * 0.03));
        ctx.quadraticCurveTo(
          px + step * 0.5,
          peakY,
          px + step,
          ground - height * (0.12 + layer * 0.03),
        );
      }
      const lastPx = endIdx * step - drift + step;
      ctx.lineTo(lastPx, ground);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 4. Foreground Trees / Structures
  // Generated using absolute world-coordinate index to eliminate wrapping seams
  ctx.fillStyle = palette.trees;
  const treeSpacing = 160;
  const treeDrift = reduced ? 0 : distance * 0.48;
  const treeStartIdx = Math.floor((treeDrift - treeSpacing * 2) / treeSpacing);
  const treeEndIdx = Math.ceil((treeDrift + width + treeSpacing * 2) / treeSpacing);

  for (let idx = treeStartIdx; idx <= treeEndIdx; idx++) {
    const x = idx * treeSpacing - treeDrift;
    const hash = Math.sin(idx * 5147) * 21943.123;
    const norm = hash - Math.floor(hash);
    const treeHeight = height * (0.24 + norm * 0.12);

    if (world === 'sunset' || world === 'neon') {
      ctx.fillRect(x, ground - treeHeight * 0.6, 9, treeHeight * 0.6);
      ctx.beginPath();
      ctx.ellipse(x + 4.5, ground - treeHeight * 0.6, 30, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - 3.5, ground - treeHeight, 7, treeHeight);
      for (let j = 0; j < 3; j++) {
        const y = ground - treeHeight + j * treeHeight * 0.22;
        ctx.beginPath();
        ctx.moveTo(x, y - treeHeight * 0.22);
        ctx.lineTo(x - treeHeight * (0.18 + j * 0.05), y + treeHeight * 0.32);
        ctx.lineTo(x + treeHeight * (0.18 + j * 0.05), y + treeHeight * 0.32);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // 5. Ground plane with 3D perspective shading
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

  // 6. Running speed lines on the ground (perfectly synchronized with character progress)
  ctx.fillStyle = '#ffffff30';
  const speedLineSpacing = 110;
  const speedLineDrift = distance * 1.0; // Exactly 1:1 with runner distance progress
  const speedLineStartIdx = Math.floor((speedLineDrift - speedLineSpacing) / speedLineSpacing);
  const speedLineEndIdx = Math.ceil((speedLineDrift + width + speedLineSpacing) / speedLineSpacing);

  for (let idx = speedLineStartIdx; idx <= speedLineEndIdx; idx++) {
    const x = idx * speedLineSpacing - speedLineDrift;
    const laneRow = Math.abs(idx) % 5;
    ctx.fillRect(x, ground + 12 + laneRow * 15, 28, 3);
  }
}

interface ShatterParticle {
  worldX: number;
  worldY: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  rot: number;
  vrot: number;
}

export class Renderer {
  private image?: HTMLImageElement;
  private runFrames: HTMLImageElement[] = [];
  private jumpFrames: HTMLImageElement[] = [];
  private slideFrames: HTMLImageElement[] = [];
  private idleFrames: HTMLImageElement[] = [];
  private particles: ShatterParticle[] = [];
  private processedDestroyedIds = new Set<string>();
  private customImages = new Map<string, HTMLImageElement>();
  private customImageUrls: string[] = [];
  private visibleItems: TrackItem[] = [];

  constructor(
    private ctx: CanvasRenderingContext2D,
    private character: Character,
    private scenario?: Scenario,
    scenarioAssets: ScenarioAsset[] = [],
  ) {
    if (character.image) {
      this.image = new Image();
      this.image.src = character.image;
    }
    if (character.frames) {
      if (character.frames.run) {
        this.runFrames = character.frames.run.map((src) => {
          const img = new Image();
          img.src = src;
          return img;
        });
      }
      if (character.frames.jump) {
        this.jumpFrames = character.frames.jump.map((src) => {
          const img = new Image();
          img.src = src;
          return img;
        });
      }
      if (character.frames.slide) {
        this.slideFrames = character.frames.slide.map((src) => {
          const img = new Image();
          img.src = src;
          return img;
        });
      }
      if (character.frames.idle) {
        this.idleFrames = character.frames.idle.map((src) => {
          const img = new Image();
          img.src = src;
          return img;
        });
      }
    }
    for (const asset of scenarioAssets) {
      const url = URL.createObjectURL(new Blob([asset.bytes], { type: asset.mime }));
      const image = new Image();
      image.src = url;
      this.customImageUrls.push(url);
      this.customImages.set(asset.id, image);
    }
  }

  destroy() {
    for (const url of this.customImageUrls) URL.revokeObjectURL(url);
    this.customImageUrls.length = 0;
    this.customImages.clear();
  }

  render(game: Simulation, width: number, height: number, reduced: boolean) {
    const ctx = this.ctx;

    // Check for newly destroyed obstacles to spawn shatter particles
    if (game.destroyedObstacles.length > 0) {
      for (const item of game.destroyedObstacles) {
        if (!this.processedDestroyedIds.has(item.id)) {
          this.processedDestroyedIds.add(item.id);
          this.spawnShatterParticles(item.x, item.kind);
        }
      }
    }

    // Update particles
    this.updateParticles();

    ctx.save();

    // Screen Shake effect when hit or shield smash
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

    // Render active shatter particles on top of world
    this.renderParticles(ctx, game, width, height);

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

  private spawnShatterParticles(worldX: number, kind: string) {
    // Determine debris colors based on obstacle material
    let palette: string[];
    if (kind === 'rock') {
      palette = ['#95a49b', '#c3ccc0', '#5a6860', '#748076', '#bfe8fa'];
    } else if (kind === 'branch') {
      palette = ['#70533e', '#76a565', '#8a654c', '#537d45', '#bfe8fa'];
    } else {
      // Log or default
      palette = ['#866248', '#c39a6a', '#533e34', '#a07855', '#bfe8fa'];
    }

    const count = 26; // High energy shatter burst
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 320;
      this.particles.push({
        worldX: worldX + (Math.random() - 0.5) * 24,
        worldY: -15 - Math.random() * 45, // Elevation off ground
        vx: Math.cos(angle) * speed + 80, // Slight forward momentum from shield impact
        vy: Math.sin(angle) * speed - 100, // Upward explosion blast
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 3 + Math.random() * 7,
        life: 0.65 + Math.random() * 0.35,
        maxLife: 1.0,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 16,
      });
    }

    // Add bright shield energy plasma sparks
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 260;
      this.particles.push({
        worldX: worldX,
        worldY: -30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        color: '#bfe8fa',
        size: 2 + Math.random() * 4,
        life: 0.4 + Math.random() * 0.25,
        maxLife: 0.65,
        rot: 0,
        vrot: 0,
      });
    }
  }

  private updateParticles() {
    const dt = 1 / 60;
    const gravity = 880;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.worldX += p.vx * dt;
      p.worldY += p.vy * dt;
      p.vy += gravity * dt; // Particles fall with realistic gravity
      p.rot += p.vrot * dt;
    }
  }

  private renderParticles(
    ctx: CanvasRenderingContext2D,
    game: Simulation,
    width: number,
    height: number,
  ) {
    if (this.particles.length === 0) return;

    if (game.cameraView === 'first_person') {
      const horizon = height * 0.48;
      const centerX = width / 2;
      for (const p of this.particles) {
        const dist = p.worldX - game.distance;
        if (dist < -50 || dist > 2000) continue;
        const depth = Math.max(1, dist);
        const factor = Math.max(0, Math.min(1, 1 - depth / 2000));
        const projScale = Math.pow(factor, 2.2);
        const y = horizon + projScale * (height - horizon) + p.worldY * projScale;
        const x = centerX + p.vx * 0.15 * projScale;
        const alpha = Math.max(0, p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.fillRect(
          (-p.size * projScale) / 2,
          (-p.size * projScale) / 2,
          p.size * projScale,
          p.size * projScale,
        );
        ctx.restore();
      }
    } else {
      const ground = height * 0.79;
      const scale = Math.min(1, height / 430);
      const px = width * 0.23;

      for (const p of this.particles) {
        const x = px + (p.worldX - game.distance) * scale;
        if (x < -100 || x > width + 100) continue;
        const y = ground + p.worldY * scale;
        const alpha = Math.max(0, p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.fillRect((-p.size * scale) / 2, (-p.size * scale) / 2, p.size * scale, p.size * scale);
        ctx.restore();
      }
    }
  }

  /**
   * 3D First-Person Mode (FPS Runner)
   * Forward-projecting 3D track, horizon, and scaling billboard obstacles
   */
  private renderFirstPerson(game: Simulation, width: number, height: number, reduced: boolean) {
    const ctx = this.ctx;
    const palette = WORLDS[game.track.world] || WORLDS.forest;
    const cameraBob = reduced || game.height > 5 ? 0 : Math.sin(game.distance * 0.035) * 3;
    const horizon = height * 0.43 + cameraBob + Math.min(height * 0.12, game.height * 0.12);
    const centerAt = (depth: number) =>
      width / 2 + Math.sin((game.distance + depth) * 0.00082) * width * 0.11 * (1 - depth / 2800);
    const project = (depth: number) => {
      const ratio = Math.max(0, Math.min(1, 1 - depth / 2600));
      const scale = Math.pow(ratio, 2.05);
      return {
        scale,
        y: horizon + scale * (height - horizon),
        center: centerAt(depth),
        roadWidth: width * (0.045 + scale * 0.74),
      };
    };

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, palette.sky);
    sky.addColorStop(1, game.track.world === 'night' ? '#5c6f91' : '#f7e3bf');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon + 2);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(width * 0.78, height * 0.18, Math.max(24, height * 0.065), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = palette.mountain;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = -40; x <= width + 80; x += 78) {
      const peak = horizon - height * (0.09 + (Math.abs(x * 17) % 48) / 500);
      ctx.lineTo(x + 38, peak);
      ctx.lineTo(x + 78, horizon);
    }
    ctx.closePath();
    ctx.fill();

    const ground = ctx.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, palette.trees);
    ground.addColorStop(1, palette.ground);
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, width, height - horizon);

    // Curved road slices share the same projection as objects, so depth remains coherent.
    const slices = 28;
    for (let index = 0; index < slices; index++) {
      const nearRatio = (index + 1) / slices;
      const farRatio = index / slices;
      const nearDepth = 2600 * (1 - Math.pow(nearRatio, 0.62));
      const farDepth = 2600 * (1 - Math.pow(farRatio, 0.62));
      const near = project(nearDepth);
      const far = project(farDepth);
      ctx.fillStyle = index % 2 ? '#172521' : '#1d2e29';
      ctx.beginPath();
      ctx.moveTo(far.center - far.roadWidth / 2, far.y);
      ctx.lineTo(far.center + far.roadWidth / 2, far.y);
      ctx.lineTo(near.center + near.roadWidth / 2, near.y);
      ctx.lineTo(near.center - near.roadWidth / 2, near.y);
      ctx.closePath();
      ctx.fill();
      if (index % 3 === 0) {
        ctx.strokeStyle = `${palette.accent}88`;
        ctx.lineWidth = Math.max(1, near.scale * 3);
        ctx.beginPath();
        ctx.moveTo(near.center - near.roadWidth / 2, near.y);
        ctx.lineTo(near.center + near.roadWidth / 2, near.y);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(2, width * 0.003);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let depth = 2600; depth >= 0; depth -= 100) {
        const point = project(depth);
        const x = point.center + (side * point.roadWidth) / 2;
        if (depth === 2600) ctx.moveTo(x, point.y);
        else ctx.lineTo(x, point.y);
      }
      ctx.stroke();
    }

    // Deterministic roadside silhouettes give speed and scale without allocations.
    const roadsideOffset = game.distance % 180;
    for (let depth = 2600 - roadsideOffset; depth > 40; depth -= 180) {
      const point = project(depth);
      if (point.scale < 0.015) continue;
      for (const side of [-1, 1]) {
        const x = point.center + side * point.roadWidth * 0.72;
        const propHeight = 110 * point.scale;
        ctx.fillStyle = game.track.world === 'neon' ? '#19cfed' : palette.trees;
        ctx.fillRect(x - 5 * point.scale, point.y - propHeight, 10 * point.scale, propHeight);
        ctx.beginPath();
        ctx.arc(x, point.y - propHeight, 34 * point.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.renderScenarioFirstPerson(game, width, height, project);

    this.visibleItems.length = 0;
    for (const item of game.track.items) {
      const distance = item.x - game.distance;
      if (distance >= -40 && distance <= 2600 && !game.consumed.has(item.id))
        this.visibleItems.push(item);
    }
    this.visibleItems.sort((a, b) => b.x - a.x);

    for (const item of this.visibleItems) {
      const dist = item.x - game.distance;
      const point = project(Math.max(1, dist));
      if (point.scale < 0.035) continue;

      ctx.save();
      ctx.translate(point.center, point.y - (item.y ?? 0) * point.scale);
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 12 * point.scale;
      if (item.visual?.source === 'custom') {
        const image = this.customImages.get(item.visual.assetId);
        if (image?.complete) {
          const objectWidth = (item.width ?? 100) * point.scale;
          const objectHeight = (item.height ?? 100) * point.scale;
          ctx.drawImage(image, -objectWidth / 2, -objectHeight, objectWidth, objectHeight);
        } else this.drawItem3D(ctx, item.kind, 120 * point.scale);
      } else this.drawItem3D(ctx, item.kind, 120 * point.scale);
      ctx.restore();
    }

    const fog = ctx.createLinearGradient(0, horizon - 20, 0, horizon + height * 0.24);
    fog.addColorStop(0, 'rgba(255,255,255,.28)');
    fog.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 20, width, height * 0.3);
    this.drawFirstPersonCockpit(ctx, width, height, game);
  }

  private renderScenarioFirstPerson(
    game: Simulation,
    width: number,
    height: number,
    project: (depth: number) => { scale: number; y: number; center: number; roadWidth: number },
  ) {
    if (!this.scenario) return;
    const ctx = this.ctx;
    for (const layer of this.scenario.layers) {
      if (!layer.visible) continue;
      const animation = layer.animated ? game.elapsed * layer.animationSpeed : 0;
      for (const object of layer.objects) {
        if (object.behavior !== 'decoration') continue;
        const directional =
          layer.animationDirection === 'left'
            ? -animation
            : layer.animationDirection === 'right'
              ? animation
              : 0;
        const depth = object.x - game.distance * layer.parallaxSpeed + directional;
        if (depth < 10 || depth > 2600) continue;
        const point = project(depth);
        if (point.scale < 0.025) continue;
        const verticalAnimation =
          layer.animationDirection === 'up'
            ? animation
            : layer.animationDirection === 'down'
              ? -animation
              : 0;
        const objectWidth = object.width * object.scale * point.scale;
        const objectHeight = object.height * object.scale * point.scale;
        const x = point.center + object.laneOffset * point.roadWidth * 0.85;
        const y = point.y - (object.y + verticalAnimation) * point.scale;
        ctx.save();
        ctx.globalAlpha = Number(object.properties.opacity ?? 1);
        ctx.translate(x, y - objectHeight / 2);
        ctx.rotate((object.rotation * Math.PI) / 180);
        this.drawScenarioVisual(ctx, object, objectWidth, objectHeight);
        ctx.restore();
      }
    }
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

    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      height * 0.2,
      width / 2,
      height / 2,
      width * 0.7,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, game.shield > 0 ? 'rgba(76,210,245,.18)' : 'rgba(0,0,0,.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // Altitude indicator when airborne in speedrun
    if (game.height > 10) {
      ctx.fillStyle = '#ffffffdd';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ALTURA +${(game.height / 10).toFixed(1)} m`, width / 2, height * 0.72);
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

  private drawScenarioVisual(
    ctx: CanvasRenderingContext2D,
    object: ScenarioObject,
    width: number,
    height: number,
  ) {
    const visual = object.visual;
    if (visual.source === 'custom') {
      const image = this.customImages.get(visual.assetId);
      if (image?.complete && image.naturalWidth) {
        ctx.drawImage(image, -width / 2, -height / 2, width, height);
        return;
      }
    }
    ctx.fillStyle =
      object.behavior === 'coin'
        ? '#ffe08a'
        : object.behavior === 'shield'
          ? '#afdbef'
          : object.behavior === 'boost'
            ? '#e5bafa'
            : object.behavior === 'decoration'
              ? '#d8f36a'
              : '#866248';
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, Math.min(12, height / 3));
    ctx.fill();
  }

  private renderScenarioSide(game: Simulation, width: number, height: number, foreground: boolean) {
    if (!this.scenario) return;
    const ctx = this.ctx;
    const ground = height * 0.79;
    const scale = Math.min(1, height / 430);
    const playerX = width * 0.23;
    for (const layer of this.scenario.layers) {
      if (!layer.visible || (layer.type === 'foreground') !== foreground) continue;
      const animation = layer.animated ? game.elapsed * layer.animationSpeed : 0;
      for (const object of layer.objects) {
        if (object.behavior !== 'decoration') continue;
        const horizontalAnimation =
          layer.animationDirection === 'left'
            ? -animation
            : layer.animationDirection === 'right'
              ? animation
              : 0;
        const verticalAnimation =
          layer.animationDirection === 'up'
            ? animation
            : layer.animationDirection === 'down'
              ? -animation
              : 0;
        const x =
          playerX + (object.x - game.distance * layer.parallaxSpeed + horizontalAnimation) * scale;
        const objectWidth = object.width * object.scale * scale;
        const objectHeight = object.height * object.scale * scale;
        if (x + objectWidth < -100 || x - objectWidth > width + 100) continue;
        const y = ground - (object.y + verticalAnimation) * scale - objectHeight / 2;
        ctx.save();
        ctx.globalAlpha = Number(object.properties.opacity ?? 1);
        ctx.translate(x, y);
        ctx.rotate((object.rotation * Math.PI) / 180);
        this.drawScenarioVisual(ctx, object, objectWidth, objectHeight);
        ctx.restore();
      }
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

    drawLandscape(ctx, width, height, game.track.world, game.distance, reduced);
    this.renderScenarioSide(game, width, height, false);
    ctx.save();

    // 1. Draw Track Items (Obstacles, Collectibles, Springs, Rings)
    for (const item of game.track.items) {
      const x = px + (item.x - game.distance) * scale;
      // Do not skip obstacles if passed! Draw them so long as they are on screen and not destroyed by hit
      if (x < -120 || x > width + 120 || game.consumed.has(item.id)) continue;

      ctx.save();
      ctx.translate(x, ground);
      ctx.scale(scale, scale);

      if (item.visual?.source === 'custom') {
        const image = this.customImages.get(item.visual.assetId);
        if (image?.complete && image.naturalWidth) {
          const itemWidth = item.width ?? 80;
          const itemHeight = item.height ?? 80;
          ctx.drawImage(image, -itemWidth / 2, -(item.y ?? 0) - itemHeight, itemWidth, itemHeight);
        } else {
          ctx.fillStyle = '#d8f36a';
          ctx.fillRect(-20, -40, 40, 40);
        }
      } else if (item.kind === 'coin') {
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
      ctx.ellipse(
        0,
        game.height * scale + (game.slide > 0 ? 16 : 31) * scale,
        25 * shadowScale,
        6 * shadowScale,
        0,
        0,
        Math.PI * 2,
      );
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

    const isJumping = game.height > 0;
    const isSliding = game.slide > 0;
    const stride = game.distance * 0.05;

    // Dynamic multi-frame sprite frame selection
    let activeFrameImg: HTMLImageElement | undefined = this.image;
    if (isJumping && this.jumpFrames.length > 0) {
      // Pick jump ascent (frame 0) or descent (frame 1)
      const jumpIdx = game.velocity > -100 ? 0 : Math.min(1, this.jumpFrames.length - 1);
      if (this.jumpFrames[jumpIdx]?.complete && this.jumpFrames[jumpIdx].naturalWidth) {
        activeFrameImg = this.jumpFrames[jumpIdx];
      }
    } else if (isSliding && this.slideFrames.length > 0) {
      // Dynamic multi-frame crouch:
      // When slide > 0.16s: deep crouch pose (frame 0)
      // When slide <= 0.16s: swift upright recovery pose (frame 1 if available)
      const slideIdx = game.slide > 0.16 || this.slideFrames.length === 1 ? 0 : 1;
      if (this.slideFrames[slideIdx]?.complete && this.slideFrames[slideIdx].naturalWidth) {
        activeFrameImg = this.slideFrames[slideIdx];
      }
    } else if (this.runFrames.length > 0) {
      // 6-frame run cycle dynamically indexed by runner distance progress
      const frameIdx = Math.floor(Math.abs(stride * 1.5)) % this.runFrames.length;
      if (this.runFrames[frameIdx]?.complete && this.runFrames[frameIdx].naturalWidth) {
        activeFrameImg = this.runFrames[frameIdx];
      }
    }

    if (activeFrameImg?.complete && activeFrameImg.naturalWidth) {
      ctx.save();
      // Organic platformer character dynamics
      if (isJumping) {
        ctx.rotate(Math.max(-0.18, Math.min(0.18, -game.velocity * 0.00025)));
      } else if (isSliding) {
        // Subtle forward aerodynamic tilt during slide
        const slideProgress = Math.max(0, Math.min(1, game.slide / 0.45));
        ctx.rotate(-0.06 * slideProgress);
        ctx.translate(0, (1 - slideProgress) * 4);
      } else {
        ctx.rotate(Math.sin(stride) * 0.035);
        ctx.translate(0, -Math.abs(Math.sin(stride * 2)) * 3);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(activeFrameImg, -30 * scale, -30 * scale, 60 * scale, 60 * scale);
      ctx.restore();
    } else if (this.character.pixels) {
      ctx.save();
      if (isJumping) {
        ctx.rotate(Math.max(-0.15, Math.min(0.15, -game.velocity * 0.0003)));
      } else if (!isSliding) {
        ctx.translate(0, -Math.abs(Math.sin(stride * 2)) * 2);
      }
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
      ctx.restore();
    } else {
      const slideProgress = Math.max(0, Math.min(1, game.slide / 0.45));
      drawFox(
        ctx,
        0,
        0,
        57 * scale,
        this.character.color,
        stride,
        isHurtFlash,
        isJumping,
        game.velocity,
        isSliding,
        slideProgress,
      );
    }

    ctx.restore();
    this.renderScenarioSide(game, width, height, true);
  }
}
