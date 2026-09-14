import { frameScale, drawGroundedSprite, measureSprite, pixelBounds, playerVisualHeight, proportionalSpriteHeight } from '../lib/sprite-geometry';
import { WORLDS } from '../lib/worlds';
import { TIME_PERIODS, type TimeOfDay } from '../lib/environment';
import type {
  Character,
  ItemKind,
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
  timeOfDay: TimeOfDay = 'morning',
  elapsed = distance / 290,
) {
  const palette = WORLDS[world] || WORLDS.forest;
  const env = TIME_PERIODS[timeOfDay] || TIME_PERIODS.morning;
  const ground = height * 0.79;

  // 1. Sky background with dynamic Time-of-Day Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ground);
  skyGrad.addColorStop(0, env.skyTop);
  skyGrad.addColorStop(1, env.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Stars rendering (active during late_night, night, dusk, dawn)
  if (env.starAlpha > 0.05) {
    ctx.save();
    ctx.globalAlpha = env.starAlpha;
    ctx.fillStyle = '#f8fafc';
    for (let i = 0; i < 45; i++) {
      const sx = (i * 127.3 + (reduced ? 0 : distance * 0.01)) % width;
      const sy = (i * 41.7) % (height * 0.52);
      const sSize = i % 4 === 0 ? 2.5 : 1.5;
      ctx.fillRect(sx, sy, sSize, sSize);
    }
    ctx.restore();
  }

  // 3. Sun and Moon System with position angle
  ctx.save();
  const rad = (env.sunMoonAngle * Math.PI) / 180;
  // Arc path across the sky
  const cx = width * (0.15 + (env.sunMoonAngle / 180) * 0.7);
  const cy = height * 0.5 - Math.sin(rad) * height * 0.38;

  // Celestial Glow Aura
  const glowGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, env.sunMoonSize * 2.2);
  glowGrad.addColorStop(0, env.sunMoonGlow);
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, env.sunMoonSize * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Celestial Body Core
  ctx.fillStyle = env.sunMoonColor;
  ctx.beginPath();
  ctx.arc(cx, cy, env.sunMoonSize * 0.5, 0, Math.PI * 2);
  ctx.fill();

  if (env.sunMoonType === 'moon') {
    // Moon crater details
    ctx.fillStyle = 'rgba(100, 116, 139, 0.25)';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 2, env.sunMoonSize * 0.16, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy + 3, env.sunMoonSize * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4. World-specific celestial or atmospheric foreground overlay
  if (world === 'neon') {
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
        const emberX = (((baseX - distance * 0.25 + (reduced ? 0 : elapsed * 18)) % emberLoop) + emberLoop) % emberLoop;
        if (emberX <= width + 5) {
        const emberY = ((i * 37.1 - (reduced ? 0 : elapsed * (18 + i % 4))) % (height * 0.7) + height * 0.7) % (height * 0.7);
        ctx.fillRect(emberX, emberY, 2.5, 2.5);
      }
    }
  } else if (world === 'alpine') {
    // Crisp snowy sun and continuous looping snowflakes
    ctx.fillStyle = '#ffffff66';
    const snowLoop = Math.max(width, 800);
    for (let i = 0; i < 40; i++) {
      const baseX = i * 73.7;
        const flakeX = (((baseX - distance * 0.35 + (reduced ? 0 : Math.sin(elapsed + i) * 18)) % snowLoop) + snowLoop) % snowLoop;
      if (flakeX <= width + 5) {
        const flakeY = ((i * 47 + (reduced ? 0 : elapsed * (22 + i % 5))) % (height * 0.75));
        ctx.fillRect(flakeX, flakeY, 3, 3);
      }
    }
  } else {
    // Floating Clouds: span width + cloud margin seamlessly
    ctx.fillStyle = env.sunMoonType === 'sun' ? '#f4f7e8aa' : 'rgba(255, 255, 255, 0.15)';
    const cloudSpan = width + 260;
    const cloudSpeed = reduced ? 0 : 0.06;
    for (let i = 0; i < 5; i++) {
      const originX = i * (cloudSpan / 5);
      const cx = ((((originX - distance * cloudSpeed + (reduced ? 0 : elapsed * 3.5)) % cloudSpan) + cloudSpan) % cloudSpan) - 130;
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

    const sway = reduced ? 0 : Math.sin(elapsed * 1.35 + idx * 1.71) * 0.018;
    ctx.save();
    ctx.translate(x, ground);
    ctx.rotate(sway);
    if (world === 'sunset' || world === 'neon') {
      ctx.fillRect(0, -treeHeight * 0.6, 9, treeHeight * 0.6);
      ctx.beginPath();
      ctx.ellipse(4.5, -treeHeight * 0.6, 30, 16, sway * 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-3.5, -treeHeight, 7, treeHeight);
      for (let j = 0; j < 3; j++) {
        const y = -treeHeight + j * treeHeight * 0.22;
        ctx.beginPath();
        ctx.moveTo(0, y - treeHeight * 0.22);
        ctx.lineTo(-treeHeight * (0.18 + j * 0.05), y + treeHeight * 0.32);
        ctx.lineTo(treeHeight * (0.18 + j * 0.05), y + treeHeight * 0.32);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Deterministic ambient particles continue moving even while the player is still.
  if (!reduced) {
    const atmosphericColor = world === 'volcano' ? '#ffb34799' : world === 'alpine' ? '#ffffffaa' : world === 'neon' ? '#38bdf877' : world === 'night' ? '#d8f36aaa' : '#f4f0b066';
    ctx.fillStyle = atmosphericColor;
    ctx.strokeStyle = atmosphericColor;
    for (let i = 0; i < 28; i++) {
      const phase = elapsed * (12 + i % 6) + i * 71.3;
      const x = ((i * 97.7 + phase * (world === 'neon' ? -2 : 0.35)) % (width + 40) + width + 40) % (width + 40) - 20;
      const y = ((i * 43.1 + phase * (world === 'volcano' ? -0.7 : 0.55)) % ground + ground) % ground;
      if (world === 'neon') {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 18); ctx.stroke();
      } else {
        const radius = 1 + (i % 3);
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
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

const GENERATED_VISUALS = {
  log: '/assets/generated/obstacle-log.webp',
  rock: '/assets/generated/obstacle-rock.webp',
  branch: '/assets/generated/obstacle-branch.webp',
  pine: '/assets/generated/environment-pine.webp',
  oak: '/assets/generated/environment-oak.webp',
  foliage: '/assets/generated/environment-foliage.webp',
  spire: '/assets/generated/environment-spire.webp',
} as const;

export class Renderer {
  private pixelContentBounds?: ReturnType<typeof pixelBounds>;
  private image?: HTMLImageElement;
  private runFrames: HTMLImageElement[] = [];
  private jumpFrames: HTMLImageElement[] = [];
  private slideFrames: HTMLImageElement[] = [];
  private idleFrames: HTMLImageElement[] = [];
  private particles: ShatterParticle[] = [];
  private lastSprite?: HTMLImageElement;
  private lastFrameScale = 1;
  private standingBoundsHeight = 0;
  private particleTime = 0;
  private processedDestroyedIds = new Set<string>();
  private customImages = new Map<string, HTMLImageElement>();
  private customImageUrls: string[] = [];
  private visibleItems: TrackItem[] = [];
  private generatedVisuals = new Map<keyof typeof GENERATED_VISUALS, HTMLImageElement>();

  constructor(
    private ctx: CanvasRenderingContext2D,
    private character: Character,
    private scenario?: Scenario,
    scenarioAssets: ScenarioAsset[] = [],
  ) {
    for (const [key, source] of Object.entries(GENERATED_VISUALS) as Array<
      [keyof typeof GENERATED_VISUALS, string]
    >) {
      const image = new Image();
      image.src = source;
      this.generatedVisuals.set(key, image);
    }
    if (character.pixels) this.pixelContentBounds = pixelBounds(character.pixels);
    if (character.image) {
      this.image = new Image();
      this.image.onload = () => measureSprite(this.image!);
      this.image.src = character.image;
    }
    if (character.frames) {
      if (character.frames.run) {
        this.runFrames = character.frames.run.map((src) => {
          const img = new Image();
          img.onload = () => measureSprite(img);
          img.src = src;
          return img;
        });
      }
      if (character.frames.jump) {
        this.jumpFrames = character.frames.jump.map((src) => {
          const img = new Image();
          img.onload = () => measureSprite(img);
          img.src = src;
          return img;
        });
      }
      if (character.frames.slide) {
        this.slideFrames = character.frames.slide.map((src) => {
          const img = new Image();
          img.onload = () => measureSprite(img);
          img.src = src;
          return img;
        });
      }
      if (character.frames.idle) {
        this.idleFrames = character.frames.idle.map((src) => {
          const img = new Image();
          img.onload = () => measureSprite(img);
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

  private getStandingBoundsHeight(): number {
    if (this.standingBoundsHeight > 0) return this.standingBoundsHeight;
    const reference = [this.runFrames[0], this.idleFrames[0], this.image].find(
      (candidate) => candidate?.complete && candidate.naturalWidth,
    );
    if (reference?.complete && reference.naturalWidth) {
      this.standingBoundsHeight = measureSprite(reference).height;
    }
    return this.standingBoundsHeight;
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
    this.updateParticles(Math.max(0, Math.min(0.05, game.elapsed - this.particleTime)));
    this.particleTime = game.elapsed;

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

  private spawnShatterParticles(worldX: number, kind: string, originY = -30) {
    // Determine debris colors based on obstacle material
    let palette: string[];
    if (kind === 'boss') {
      palette = ['#ffffff', '#fde047', '#c084fc', '#38bdf8', '#ef4444'];
    } else if (kind === 'rock') {
      palette = ['#95a49b', '#c3ccc0', '#5a6860', '#748076', '#bfe8fa'];
    } else if (kind === 'branch') {
      palette = ['#70533e', '#76a565', '#8a654c', '#537d45', '#bfe8fa'];
    } else {
      // Log or default
      palette = ['#866248', '#c39a6a', '#533e34', '#a07855', '#bfe8fa'];
    }

    const count = Math.min(26, Math.max(0, 240 - this.particles.length)); // High energy shatter burst
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 320;
      this.particles.push({
        worldX: worldX + (Math.random() - 0.5) * 24,
        worldY: originY - Math.random() * (kind === 'boss' ? 80 : 45),
        vx: Math.cos(angle) * speed + 80, // Slight forward momentum from shield impact
        vy: Math.sin(angle) * speed - 100, // Upward explosion blast
        color: palette[Math.floor(Math.random() * palette.length)],
        size: (kind === 'boss' ? 5 : 3) + Math.random() * (kind === 'boss' ? 10 : 7),
        life: (kind === 'boss' ? 1 : 0.65) + Math.random() * 0.35,
        maxLife: kind === 'boss' ? 1.35 : 1.0,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 16,
      });
    }

    // Add bright shield energy plasma sparks
    for (let i = 0; i < 14 && this.particles.length < 240; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 260;
      this.particles.push({
        worldX: worldX,
        worldY: originY,
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

  private updateParticles(dt: number) {
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

    if (!reduced) {
      ctx.fillStyle = game.track.world === 'night' ? '#d8f36a99' : '#ffffff55';
      for (let mote = 0; mote < 20; mote++) {
        const x = ((mote * 83 + game.elapsed * (4 + mote % 4)) % (width + 20)) - 10;
        const y = (mote * 37 + game.elapsed * (9 + mote % 3)) % Math.max(1, horizon);
        ctx.beginPath(); ctx.arc(x, y, 1 + mote % 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (game.bossEntity?.defeated && game.bossEntity.defeatTimer > 0 && game.boss) {
      const key = `boss:${game.boss.id}`;
      if (!this.processedDestroyedIds.has(key)) {
        this.processedDestroyedIds.add(key);
        this.spawnShatterParticles(game.bossEntity.x, 'boss', -game.bossEntity.y);
      }
    }

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
        const sway = reduced ? 0 : Math.sin(game.elapsed * 1.4 + depth * 0.01) * 3 * point.scale;
        const x = point.center + side * point.roadWidth * 0.72 + sway;
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
      if (
        distance >= -40 &&
        distance <= 2600 &&
        !game.consumed.has(item.id) &&
        !game.destroyed.has(item.id)
      )
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
    if (game.bossEntity && (game.inBossFight || game.bossEntity.defeatTimer > 0)) {
      const depth = game.bossEntity.x - game.distance;
      const point = project(Math.max(120, depth));
      this.drawBoss(game, depth < -40 ? width * 0.1 : point.center, point.y - game.bossEntity.y * point.scale, point.scale);
      if (depth < -40) {
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#172521'; ctx.lineWidth = 4;
        ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
        ctx.strokeText('← Jefe detrás', 16, height * 0.55);
        ctx.fillText('← Jefe detrás', 16, height * 0.55);
      }
    }
    for (const projectile of game.projectiles) {
      const depth = projectile.x - game.distance;
      if (depth < -40 || depth > 2600) continue;
      const point = project(Math.max(1, depth));
      ctx.fillStyle = projectile.color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(point.center, point.y - projectile.y * point.scale, Math.max(2, projectile.size * point.scale / 2), 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
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

  private renderGeneratedEnvironmentSide(
    game: Simulation,
    width: number,
    height: number,
    scale: number,
    playerX: number,
    reduced: boolean,
  ) {
    const ctx = this.ctx;
    const ground = height * 0.79;
    const spire = this.generatedVisuals.get('spire');
    if (spire?.complete && spire.naturalWidth) {
      const drift = game.distance * 0.13;
      const start = Math.floor((drift - 520) / 520);
      const end = Math.ceil((drift + width + 520) / 520);
      ctx.save();
      ctx.globalAlpha = game.track.world === 'volcano' ? 0.42 : 0.28;
      for (let index = start; index <= end; index++) {
        const x = index * 520 - drift;
        const h = (170 + Math.abs(index % 3) * 28) * scale;
        ctx.drawImage(spire, x - h * 0.42, ground - h, h * 0.84, h);
      }
      ctx.restore();
    }

    if (game.track.world === 'neon' || game.track.world === 'volcano') return;
    const pine = this.generatedVisuals.get('pine');
    const oak = this.generatedVisuals.get('oak');
    const foliage = this.generatedVisuals.get('foliage');
    const drift = game.distance * 0.43;
    const start = Math.floor((drift - 300) / 300);
    const end = Math.ceil((drift + width + 300) / 300);
    for (let index = start; index <= end; index++) {
      const image = index % 3 === 0 ? oak : pine;
      if (!image?.complete || !image.naturalWidth) continue;
      const x = playerX + index * 300 - drift;
      const treeHeight = (145 + Math.abs(index % 4) * 17) * scale;
      const sway = reduced ? 0 : Math.sin(game.elapsed * 1.15 + index * 1.7) * 0.018;
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.translate(x, ground);
      ctx.rotate(sway);
      ctx.drawImage(image, -treeHeight * 0.42, -treeHeight, treeHeight * 0.84, treeHeight);
      ctx.restore();
    }
    if (foliage?.complete && foliage.naturalWidth) {
      const foregroundDrift = game.distance * 0.62;
      const foregroundStart = Math.floor((foregroundDrift - 190) / 190);
      const foregroundEnd = Math.ceil((foregroundDrift + width + 190) / 190);
      ctx.save();
      ctx.globalAlpha = 0.82;
      for (let index = foregroundStart; index <= foregroundEnd; index++) {
        const x = playerX + index * 190 - foregroundDrift;
        const bob = reduced ? 0 : Math.sin(game.elapsed * 1.8 + index) * 1.5;
        ctx.drawImage(foliage, x - 48 * scale, ground - 52 * scale + bob, 96 * scale, 54 * scale);
      }
      ctx.restore();
    }
  }

  private drawGeneratedObstacle(
    ctx: CanvasRenderingContext2D,
    kind: 'log' | 'rock' | 'branch',
    elapsed: number,
    seed: number,
  ): boolean {
    const image = this.generatedVisuals.get(kind);
    if (!image?.complete || !image.naturalWidth) return false;
    ctx.save();
    if (kind === 'branch') ctx.rotate(Math.sin(elapsed * 2 + seed * 0.01) * 0.012);
    if (kind === 'log') ctx.drawImage(image, -43, -45, 86, 45);
    else if (kind === 'rock') ctx.drawImage(image, -34, -61, 68, 61);
    else ctx.drawImage(image, -49, -116, 98, 76);
    ctx.restore();
    return true;
  }

  /**
   * Render individual items for First-Person 3D mode
   */
  private drawItem3D(ctx: CanvasRenderingContext2D, kind: string, size: number) {
    if (kind === 'log' || kind === 'rock' || kind === 'branch') {
      const image = this.generatedVisuals.get(kind);
      if (image?.complete && image.naturalWidth) {
        if (kind === 'log') ctx.drawImage(image, -size * 0.62, -size * 0.48, size * 1.24, size * 0.48);
        else if (kind === 'rock') ctx.drawImage(image, -size * 0.48, -size * 0.78, size * 0.96, size * 0.78);
        else ctx.drawImage(image, -size * 0.65, -size * 1.18, size * 1.3, size * 0.72);
        return;
      }
    }
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
      baseScale = Math.min(1, height / 430),
      zoom = game.cameraZoom ?? 1.0,
      scale = baseScale * zoom,
      charScale = game.characterScale,
      px = width * 0.23;

    drawLandscape(ctx, width, height, game.track.world, game.distance, reduced, game.timeOfDay, game.elapsed);
    this.renderGeneratedEnvironmentSide(game, width, height, scale, px, reduced);
    this.renderScenarioSide(game, width, height, false);
    ctx.save();

    // 1. Draw Track Items (Obstacles, Collectibles, Springs, Rings, Power Orbs)
    for (const item of game.track.items) {
      const x = px + (item.x - game.distance) * scale;
      if (
        x < -120 ||
        x > width + 120 ||
        game.consumed.has(item.id) ||
        game.destroyed.has(item.id)
      ) continue;

      ctx.save();
      ctx.translate(x, ground);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(4, 12, 9, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 2, item.kind === 'branch' ? 34 : 28, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (item.visual?.source === 'custom') {
        const image = this.customImages.get(item.visual.assetId);
        if (image?.complete) {
          const itemW = item.width ?? 60;
          const itemH = item.height ?? 60;
          ctx.drawImage(image, -itemW / 2, -itemH, itemW, itemH);
        } else this.drawItemSide(ctx, item.kind);
      } else if (
        (item.kind === 'log' || item.kind === 'rock' || item.kind === 'branch') &&
        this.drawGeneratedObstacle(ctx, item.kind, game.elapsed, item.x)
      ) {
        // Generated production art is already drawn; procedural branches below are fallbacks.
      } else if (item.kind.startsWith('power_')) {
        // Magical Elemental Power Orb Pickup
        const orbColors: Record<string, { main: string; glow: string; icon: string }> = {
          power_fire: { main: '#f97316', glow: 'rgba(249,115,22,0.6)', icon: '🔥' },
          power_water: { main: '#06b6d4', glow: 'rgba(6,182,212,0.6)', icon: '💧' },
          power_leaf: { main: '#84cc16', glow: 'rgba(132,204,22,0.6)', icon: '🍃' },
          power_thunder: { main: '#eab308', glow: 'rgba(234,179,8,0.6)', icon: '⚡' },
          power_star: { main: '#c084fc', glow: 'rgba(192,132,252,0.6)', icon: '✨' },
        };
        const orb = orbColors[item.kind] || orbColors.power_fire;
        const bob = Math.sin(game.elapsed * 4 + item.x) * 6;
        const orbY = -60 + bob;

        ctx.save();
        ctx.shadowColor = orb.glow;
        ctx.shadowBlur = 18;
        ctx.fillStyle = orb.main;
        ctx.beginPath();
        ctx.arc(0, orbY, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-4, orbY - 4, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(orb.icon, 0, orbY);
        ctx.restore();
      } else if (item.kind === 'coin') {
        const coinTurn = Math.max(0.18, Math.abs(Math.cos(game.elapsed * 5 + item.x * 0.01)));
        ctx.scale(coinTurn, 1);
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
        ctx.lineWidth = 2;
        for (let grain = -14; grain <= 10; grain += 12) {
          ctx.beginPath(); ctx.moveTo(grain, -27); ctx.quadraticCurveTo(grain + 6, -17, grain, -5); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(22, -15, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(22, -15, 3, 0, Math.PI * 2); ctx.stroke();
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
        ctx.fillStyle = '#66756e';
        ctx.beginPath(); ctx.moveTo(8, -25); ctx.lineTo(22, -32); ctx.lineTo(29, 0); ctx.lineTo(12, -8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9fcf83';
        ctx.beginPath(); ctx.ellipse(-10, -31, 8, 3, -0.3, 0, Math.PI * 2); ctx.fill();
      } else if (item.kind === 'branch') {
        ctx.fillStyle = '#70533e';
        ctx.fillRect(-26, -85, 52, 38);
        ctx.fillStyle = '#76a565';
        ctx.beginPath();
        const leafSway = Math.sin(game.elapsed * 2.2 + item.x * 0.03) * 4;
        ctx.ellipse(leafSway, -86, 36, 11, leafSway * 0.012, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9ac27c';
        ctx.beginPath(); ctx.ellipse(-15 + leafSway, -90, 13, 5, -0.35, 0, Math.PI * 2); ctx.fill();
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

    // 3. Render Ground Contact Shadow (exactly at ground line)
    ctx.save();
    const shadowScale = Math.max(0.2, 1 - game.height / 350) * charScale;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(
      px,
      ground,
      28 * shadowScale * scale,
      7 * shadowScale * scale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    // 4. Render Character (Anchor exactly where feet touch the ground!)
    const isHurtFlash = game.hurt > 0 && Math.floor(game.hurt * 14) % 2 === 0;
    ctx.globalAlpha = isHurtFlash ? 0.35 : 1;

    // Recoil / Hit wobble
    const hitAngle = game.hurt > 0 ? Math.sin(game.hurt * 25) * 0.25 : 0;

    // Character vertical origin: exact ground minus altitude height
    ctx.save();
    ctx.translate(px, ground - game.height * scale);
    ctx.scale(game.facing, 1);
    if (hitAngle !== 0 && game.height > 0) ctx.rotate(hitAngle);


    // 5. Anime-Style Evolving Energy Aura
    const auraLevel = game.stats?.auraLevel ?? 1;
    ctx.save();
    const auraPulse = Math.sin(game.elapsed * 8) * 4;
    const baseRadius = (32 + auraLevel * 6 + auraPulse) * scale * charScale;

    if (auraLevel >= 1) {
      const auraGrad = ctx.createRadialGradient(0, -28 * scale * charScale, 8 * scale, 0, -28 * scale * charScale, baseRadius);
      const innerColor =
        auraLevel >= 4
          ? 'rgba(168, 85, 247, 0.4)'
          : auraLevel >= 3
            ? 'rgba(234, 179, 8, 0.45)'
            : 'rgba(56, 189, 248, 0.35)';
      auraGrad.addColorStop(0, innerColor);
      auraGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, -28 * scale * charScale, baseRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (auraLevel >= 2) {
      ctx.strokeStyle = auraLevel >= 4 ? '#c084fc' : '#38bdf8';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.arc(0, -28 * scale * charScale, baseRadius * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (auraLevel >= 3) {
      ctx.fillStyle = auraLevel >= 5 ? '#f43f5e' : '#facc15';
      for (let i = 0; i < 6; i++) {
        const sparkAngle = (game.elapsed * 4 + i * (Math.PI / 3)) % (Math.PI * 2);
        const sparkDist = baseRadius * (0.6 + Math.sin(game.elapsed * 6 + i) * 0.3);
        const sx = Math.cos(sparkAngle) * sparkDist;
        const sy = -28 * scale * charScale + Math.sin(sparkAngle) * sparkDist;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (auraLevel >= 4) {
      const shockwave = (game.elapsed * 2) % 1;
      ctx.strokeStyle = `rgba(216, 180, 254, ${1 - shockwave})`;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(0, -28 * scale * charScale, baseRadius * (1 + shockwave * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (auraLevel >= 5) {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.2 * scale;
      ctx.beginPath();
      const zAngle = (game.elapsed * 12) % (Math.PI * 2);
      const zx1 = Math.cos(zAngle) * baseRadius * 0.9;
      const zy1 = -28 * scale * charScale + Math.sin(zAngle) * baseRadius * 0.9;
      const zx2 = zx1 + Math.sin(game.elapsed * 91) * 9 * scale;
      const zy2 = zy1 + Math.cos(game.elapsed * 77) * 9 * scale;
      ctx.moveTo(zx1, zy1);
      ctx.lineTo(zx2, zy2);
      ctx.stroke();
    }

    // 5b. Mega Man Buster Charge Aura (Gradually changes color from pure white to intense red, expanding with accumulated charge)
    if (game.isChargingPower && game.powerChargeRatio > 0) {
      const charge = game.powerChargeRatio;
      const colorCharge = Math.min(1, charge);
      // Interpolate from pure white (255, 255, 255) to fiery red (239, 68, 68)
      const r = 255;
      const g = Math.round(255 - colorCharge * 187); // 255 -> 68
      const b = Math.round(255 - colorCharge * 187); // 255 -> 68
      const chargeColor = `rgb(${r}, ${g}, ${b})`;
      // Aura radius grows proportionally with accumulated power
      const extraRadius = Math.min(charge * 25, 120);
      const chargeRadius = (35 + extraRadius + Math.sin(game.elapsed * 24) * 4) * scale * charScale;

      // Radial charge gradient
      const chargeGrad = ctx.createRadialGradient(0, -28 * scale * charScale, 10 * scale, 0, -28 * scale * charScale, chargeRadius);
      chargeGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.5 + Math.min(charge, 1.5) * 0.25})`);
      chargeGrad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${0.25 + Math.min(charge, 1.5) * 0.2})`);
      chargeGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = chargeGrad;
      ctx.beginPath();
      ctx.arc(0, -28 * scale * charScale, chargeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sharp pulsing condensing rings
      ctx.strokeStyle = chargeColor;
      ctx.lineWidth = (2 + Math.min(charge, 3) * 2.5) * scale;
      ctx.beginPath();
      ctx.arc(0, -28 * scale * charScale, chargeRadius * 0.82, 0, Math.PI * 2);
      ctx.stroke();

      // Swirling Buster energy particles
      const particleCount = Math.floor(4 + Math.min(charge, 4) * 6);
      ctx.fillStyle = colorCharge >= 0.8 ? '#ffeded' : chargeColor;
      for (let p = 0; p < particleCount; p++) {
        const pSpeed = 6 + Math.min(charge, 3) * 12;
        const pAngle = (game.elapsed * pSpeed + p * ((Math.PI * 2) / particleCount)) % (Math.PI * 2);
        const pDist = chargeRadius * (0.4 + 0.6 * ((1 - ((game.elapsed * 3 + p * 0.2) % 1))));
        const pxPos = Math.cos(pAngle) * pDist;
        const pyPos = -28 * scale * charScale + Math.sin(pAngle) * pDist;
        ctx.beginPath();
        ctx.arc(pxPos, pyPos, (2 + Math.min(charge, 3) * 2) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Shield Aura
    if (game.shield > 0) {
      ctx.strokeStyle = '#bfe8fa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -28 * scale * charScale, 45 * scale * charScale, 0, Math.PI * 2);
      ctx.stroke();
    }

    const isJumping = game.height > 0;
    const isSliding = game.slide > 0;
    const stride = game.distance * 0.05;

    let movement: keyof NonNullable<Character['frames']> = 'run';
    let activeIndex = 0;
    let sequence = this.runFrames;
    if ((game.phase !== 'PLAYING' || (game.inBossFight && game.moveAxis === 0 && !isJumping && !isSliding)) && this.idleFrames.length) {
      movement = 'idle'; sequence = this.idleFrames;
      activeIndex = game.phase === 'PLAYING' ? Math.floor(game.animationElapsed * 8) % sequence.length : 0;
    } else if (isJumping && this.jumpFrames.length) {
      movement = 'jump'; sequence = this.jumpFrames;
      activeIndex = Math.floor(game.animationElapsed * 8) % sequence.length;
    } else if (isSliding && this.slideFrames.length) {
      movement = 'slide'; sequence = this.slideFrames;
      activeIndex = Math.min(sequence.length - 1, Math.floor((1 - game.slide / 0.45) * sequence.length));
    } else if (sequence.length) activeIndex = Math.floor(Math.abs(stride * 1.5)) % sequence.length;
    let activeFrameImg = sequence.length ? sequence[activeIndex] : this.image;
    if (activeFrameImg?.complete && activeFrameImg.naturalWidth) {
      this.lastSprite = activeFrameImg;
      this.lastFrameScale = frameScale(this.character, movement, activeIndex);
    } else activeFrameImg = this.lastSprite ?? this.image;
    let visualHeight = playerVisualHeight(isSliding);
    if (
      isSliding &&
      this.slideFrames.length > 0 &&
      activeFrameImg?.complete &&
      activeFrameImg.naturalWidth
    ) {
      const standingBoundsHeight = this.getStandingBoundsHeight();
      if (standingBoundsHeight > 0) {
        visualHeight = proportionalSpriteHeight(
          measureSprite(activeFrameImg).height,
          standingBoundsHeight,
        );
      }
    }
    const spriteHeight = visualHeight * scale * charScale;

    if (activeFrameImg?.complete && activeFrameImg.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      drawGroundedSprite(ctx, activeFrameImg, spriteHeight * this.lastFrameScale,
        this.character.frameBaselines?.[activeFrameImg.getAttribute('src')!]);
    } else if (this.character.pixels) {
      const bounds = this.pixelContentBounds!;
      const unit = spriteHeight / bounds.height;
      this.character.pixels.forEach((c, i) => {
        if (c !== 'transparent') {
          ctx.fillStyle = isHurtFlash ? '#ff5252' : c;
          ctx.fillRect(((i % 16) - bounds.x - bounds.width / 2) * unit,
            (Math.floor(i / 16) - bounds.y - bounds.height) * unit, unit, unit);
        }
      });
    } else {
      const slideProgress = Math.max(0, Math.min(1, game.slide / 0.45));
      ctx.save();
      ctx.translate(0, -28 * scale * charScale);
      drawFox(
        ctx,
        0,
        0,
        55 * scale * charScale,
        this.character.color,
        stride,
        isHurtFlash,
        isJumping,
        game.velocity,
        isSliding,
        slideProgress,
      );
      ctx.restore();
    }

    ctx.restore();

    // 6. Render Projectiles (Player & Boss)
    ctx.save();
    for (const p of game.projectiles) {
      const pX = px + (p.x - game.distance) * scale;
      const pY = ground - p.y * scale;
      const isCharged = p.sender === 'player' && p.size > 20;
      const ricochet = Math.min(1, (p.ricochetTime ?? 0) / 0.22);

      if (ricochet > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${ricochet})`;
        ctx.lineWidth = 2 * scale;
        for (let spark = 0; spark < 6; spark++) {
          const angle = spark * Math.PI / 3 + p.id.length * 0.17;
          const inner = p.size * scale * 0.7;
          const outer = inner + 18 * scale * ricochet;
          ctx.beginPath();
          ctx.moveTo(pX + Math.cos(angle) * inner, pY + Math.sin(angle) * inner);
          ctx.lineTo(pX + Math.cos(angle) * outer, pY + Math.sin(angle) * outer);
          ctx.stroke();
        }
      }

      ctx.save();
      ctx.translate(pX, pY);
      ctx.rotate(Math.atan2(-p.vy, p.vx));
      ctx.scale(1 + ricochet * 0.5, 1 - ricochet * 0.35);

      if (isCharged) {
        // Outer energy aura for charged Mega Buster shot
        const chargedGrad = ctx.createRadialGradient(0, 0, p.size * scale * 0.2, 0, 0, p.size * scale * 0.95);
        chargedGrad.addColorStop(0, '#ffffff');
        chargedGrad.addColorStop(0.4, p.color);
        chargedGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = chargedGrad;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * scale * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * scale * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, p.size * scale * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    if (game.bossEntity) this.drawBoss(game, px + (game.bossEntity.x - game.distance) * scale, ground - game.bossEntity.y * scale, scale);

    this.renderScenarioSide(game, width, height, true);
  }

  private drawBoss(game: Simulation, bx: number, by: number, scale: number) {
    const ctx = this.ctx;
    // 7. Render Boss Entity with multi-frame animated features
    if (
      game.bossEntity &&
      (!game.bossEntity.defeated || game.bossEntity.defeatTimer > 0) &&
      game.boss
    ) {
      const boss = game.boss;
      const bossSize = 65 * boss.size * scale;
      const flap = Math.sin(game.elapsed * 9) * 0.35;

      ctx.save();
      ctx.translate(bx, by);
      const destruction = game.bossEntity.defeated
        ? Math.max(0, Math.min(1, 1 - game.bossEntity.defeatTimer / 1.2))
        : 0;
      if (destruction > 0) {
        ctx.globalAlpha = Math.max(0, 1 - destruction * destruction);
        ctx.rotate(Math.sin(destruction * Math.PI * 5) * 0.18 + destruction * 0.5);
        ctx.scale(1 + destruction * 0.35, Math.max(0.08, 1 - destruction * 0.82));
        ctx.strokeStyle = `rgba(255,255,255,${1 - destruction})`;
        ctx.lineWidth = Math.max(2, 6 * scale * (1 - destruction));
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          ctx.arc(
            0,
            0,
            bossSize * (0.45 + destruction * (1.2 + ring * 0.35)),
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
      }

      // Layered elemental aura and orbiting shards make the generic boss feel alive.
      const aura = ctx.createRadialGradient(0, 0, bossSize * 0.35, 0, 0, bossSize * 0.85);
      aura.addColorStop(0, 'rgba(255,255,255,0)');
      aura.addColorStop(1, boss.element === 'fire' ? 'rgba(249,115,22,.25)' : boss.element === 'water' ? 'rgba(14,165,233,.25)' : boss.element === 'electric' ? 'rgba(250,204,21,.25)' : 'rgba(168,85,247,.22)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(0, 0, bossSize * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let shard = 0; shard < 5; shard++) {
        const angle = game.elapsed * (0.8 + shard * 0.06) + shard * Math.PI * 0.4;
        const radius = bossSize * (0.62 + (shard % 2) * 0.12);
        ctx.save(); ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.55);
        ctx.rotate(angle); ctx.fillRect(-2 * scale, -5 * scale, 4 * scale, 10 * scale); ctx.restore();
      }

      // Telegraph warning indicator
      if (game.bossEntity.isTelegraphing) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.font = `bold ${Math.round(26 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⚠️', 0, -bossSize * 0.9);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        const warningY = game.bossEntity.nextAttackType === 'high' ? -25 * scale : 25 * scale;
        ctx.moveTo(-220 * scale, warningY);
        ctx.lineTo(0, warningY);
        ctx.stroke();
        ctx.restore();
      }

      // Animated Elemental Wings/Appendages
      ctx.save();
      ctx.fillStyle = boss.element === 'fire' ? '#ea580c' : boss.element === 'water' ? '#0284c7' : '#16a34a';
      // Left Wing
      ctx.beginPath();
      ctx.ellipse(-bossSize * 0.45, -bossSize * 0.1 + flap * 14, bossSize * 0.4, bossSize * 0.18, -0.4 + flap * 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Right Wing
      ctx.beginPath();
      ctx.ellipse(bossSize * 0.45, -bossSize * 0.1 - flap * 14, bossSize * 0.4, bossSize * 0.18, 0.4 - flap * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Boss Body Gradient
      const bossGrad = ctx.createRadialGradient(0, 0, bossSize * 0.15, 0, 0, bossSize * 0.75);
      bossGrad.addColorStop(
        0,
        boss.element === 'fire'
          ? '#f87171'
          : boss.element === 'water'
            ? '#38bdf8'
            : boss.element === 'nature'
              ? '#4ade80'
              : boss.element === 'electric'
                ? '#fde047'
                : '#c084fc',
      );
      bossGrad.addColorStop(
        1,
        boss.element === 'fire'
          ? '#991b1b'
          : boss.element === 'water'
            ? '#0369a1'
            : boss.element === 'nature'
              ? '#166534'
              : boss.element === 'electric'
                ? '#854d0e'
                : '#581c87',
      );
      ctx.fillStyle = bossGrad;
      ctx.beginPath();
      ctx.arc(0, 0, bossSize * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Animated Glowing Core
      const corePulse = bossSize * (0.15 + Math.sin(game.elapsed * 6) * 0.06);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, corePulse, 0, Math.PI * 2);
      ctx.fill();

      // Boss Animated Eyes
      const eyeGlow = game.bossEntity.isTelegraphing ? '#ef4444' : '#facc15';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-bossSize * 0.18, -bossSize * 0.12, bossSize * 0.12, bossSize * 0.18, 0, 0, Math.PI * 2);
      ctx.ellipse(bossSize * 0.18, -bossSize * 0.12, bossSize * 0.12, bossSize * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = eyeGlow;
      ctx.beginPath();
      const eyeDirection = Math.sign(game.distance - game.bossEntity.x) * bossSize * 0.025;
      ctx.arc(-bossSize * 0.18 + eyeDirection, -bossSize * 0.12, bossSize * 0.07, 0, Math.PI * 2);
      ctx.arc(bossSize * 0.18 + eyeDirection, -bossSize * 0.12, bossSize * 0.07, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = Math.max(1.5, bossSize * 0.035);
      ctx.beginPath(); ctx.arc(0, bossSize * 0.16, bossSize * 0.17, 0.15, Math.PI - 0.15); ctx.stroke();

      // Boss Health Bar
      const barWidth = 140 * scale;
      const barHeight = 12 * scale;
      const hpRatio = Math.max(0, game.bossEntity.health / game.bossEntity.maxHealth);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.roundRect(-barWidth / 2, -bossSize * 0.7 - barHeight, barWidth, barHeight, 6);
      ctx.fill();

      ctx.fillStyle = hpRatio > 0.4 ? '#22c55e' : hpRatio > 0.2 ? '#f59e0b' : '#ef4444';
      ctx.roundRect(-barWidth / 2, -bossSize * 0.7 - barHeight, barWidth * hpRatio, barHeight, 6);
      ctx.fill();

      // Boss Name Label
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(10, Math.round(11 * scale))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(boss.name, 0, -bossSize * 0.7 - barHeight - 4);

      ctx.restore();
    }

  }

  private drawItemSide(ctx: CanvasRenderingContext2D, kind: ItemKind) {
    if (kind === 'coin') {
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(0, -62, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'log') {
      ctx.fillStyle = '#866248';
      ctx.fillRect(-24, -31, 48, 31);
    } else if (kind === 'rock') {
      ctx.fillStyle = '#95a49b';
      ctx.beginPath();
      ctx.moveTo(-25, 0);
      ctx.lineTo(-20, -31);
      ctx.lineTo(1, -47);
      ctx.lineTo(22, -32);
      ctx.lineTo(29, 0);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'branch') {
      ctx.fillStyle = '#70533e';
      ctx.fillRect(-26, -85, 52, 38);
    } else {
      ctx.fillStyle = '#afdbef';
      ctx.beginPath();
      ctx.roundRect(-15, -85, 30, 30, 9);
      ctx.fill();
    }
  }
}
