import { frameScale, drawGroundedSprite, measureSprite, pixelBounds, playerVisualHeight, proportionalSpriteHeight } from '../lib/sprite-geometry';
import { WORLDS } from '../lib/worlds';
import { TIME_PERIODS, type TimeOfDay } from '../lib/environment';
import { obstacleHealth } from '../lib/obstacles';
import type {
  BossArchetype,
  BossConfig,
  Character,
  ItemKind,
  Scenario,
  ScenarioAsset,
  ScenarioLayer,
  ScenarioObject,
  TrackItem,
  WeatherCondition,
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
  weather?: WeatherCondition,
) {
  const palette = WORLDS[world] || WORLDS.forest;
  const env = TIME_PERIODS[timeOfDay] || TIME_PERIODS.morning;
  const ground = height * 0.79;

  // 1. Sky background with dynamic Time-of-Day Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ground);
  skyGrad.addColorStop(0, env.skyTop);
  skyGrad.addColorStop(1, env.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-60, -60, width + 120, height + 120);

  // 2. Stars rendering (active during late_night, night, dusk, dawn)
  if (env.starAlpha > 0.05) {
    ctx.save();
    ctx.globalAlpha = env.starAlpha;
    ctx.fillStyle = '#f8fafc';
    for (let i = 0; i < 45; i++) {
      const sx = (i * 127.3 + (reduced ? 0 : distance * 0.01)) % width;
      const sy = (i * 41.7) % (height * 0.52);
      const twinkle = 0.7 + Math.sin(elapsed * 3 + i) * 0.3;
      const sSize = (i % 4 === 0 ? 2.5 : 1.5) * twinkle;
      ctx.fillRect(sx, sy, sSize, sSize);
    }
    // Occasional shooting star comet across night sky
    if (env.starAlpha > 0.3 && !reduced) {
      const cometTime = (elapsed * 0.4) % 8;
      if (cometTime < 1.2) {
        const cometProgress = cometTime / 1.2;
        const startX = width * 0.85 - cometProgress * width * 0.45;
        const startY = height * 0.08 + cometProgress * height * 0.22;
        ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - cometProgress) * 0.85})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + 45, startY - 22);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 2b. Alpine Aurora Borealis (Ethereal shimmering light curtains)
  if (world === 'alpine' && !reduced) {
    ctx.save();
    for (let a = 0; a < 2; a++) {
      const auroraGrad = ctx.createLinearGradient(0, height * 0.05, 0, height * 0.45);
      auroraGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      auroraGrad.addColorStop(0.5, a === 0 ? 'rgba(74, 222, 128, 0.22)' : 'rgba(168, 85, 247, 0.18)');
      auroraGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = auroraGrad;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.4);
      for (let x = 0; x <= width; x += 40) {
        const wave = Math.sin(x * 0.006 + elapsed * 0.8 + a * 1.8) * height * 0.08;
        ctx.lineTo(x, height * 0.16 + wave + a * 20);
      }
      ctx.lineTo(width, height * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. Sun and Moon System with animated corona, rays and halos
  ctx.save();
  const rad = (env.sunMoonAngle * Math.PI) / 180;
  // Arc path across the sky
  const cx = width * (0.15 + (env.sunMoonAngle / 180) * 0.7);
  const cy = height * 0.5 - Math.sin(rad) * height * 0.38;

  // Celestial Glow Aura with breathing pulse
  const celestialPulse = reduced ? 0 : Math.sin(elapsed * 2.2) * 4;
  const auraRad = env.sunMoonSize * 2.2 + celestialPulse;
  const glowGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, Math.max(10, auraRad));
  glowGrad.addColorStop(0, env.sunMoonGlow);
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(10, auraRad), 0, Math.PI * 2);
  ctx.fill();

  if (env.sunMoonType === 'sun') {
    // Dynamic Rotating Solar Corona Rays
    if (!reduced) {
      const rayCount = 12;
      const rayBaseLen = env.sunMoonSize * 0.75;
      for (let r = 0; r < rayCount; r++) {
        const rayAngle = elapsed * 0.25 + r * ((Math.PI * 2) / rayCount);
        const rayLen = rayBaseLen + Math.sin(elapsed * 4 + r * 1.5) * 7;
        const rx1 = cx + Math.cos(rayAngle) * (env.sunMoonSize * 0.45);
        const ry1 = cy + Math.sin(rayAngle) * (env.sunMoonSize * 0.45);
        const rx2 = cx + Math.cos(rayAngle) * (env.sunMoonSize * 0.45 + rayLen);
        const ry2 = cy + Math.sin(rayAngle) * (env.sunMoonSize * 0.45 + rayLen);
        ctx.strokeStyle = `rgba(254, 240, 138, ${0.4 + Math.sin(elapsed * 3 + r) * 0.25})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(rx1, ry1);
        ctx.lineTo(rx2, ry2);
        ctx.stroke();
      }
    }
  } else {
    // Mystical Lunar Rings and Shimmering Motes
    if (!reduced) {
      const lunarHaloTime = (elapsed * 0.35) % 1;
      ctx.strokeStyle = `rgba(196, 214, 255, ${(1 - lunarHaloTime) * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, env.sunMoonSize * (0.6 + lunarHaloTime * 0.9), 0, Math.PI * 2);
      ctx.stroke();

      // Orbiting stardust motes around moon
      ctx.fillStyle = '#e0e7ff';
      for (let m = 0; m < 4; m++) {
        const mAngle = elapsed * 0.8 + m * (Math.PI / 2);
        const mDist = env.sunMoonSize * (1.1 + Math.sin(elapsed * 2 + m) * 0.2);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(mAngle) * mDist, cy + Math.sin(mAngle) * mDist, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

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
    // Synthwave horizontal horizon lines & retro grid
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

    // Billowing volcanic smoke plumes rising into the sky
    if (!reduced) {
      ctx.save();
      for (let p = 0; p < 4; p++) {
        const smokeX = ((width * (0.15 + p * 0.25) - distance * 0.05) % width + width) % width;
        const smokePhase = (elapsed * 0.5 + p * 1.6) % 1;
        const smokeY = ground - height * 0.26 - smokePhase * height * 0.28;
        const smokeR = (16 + smokePhase * 38);
        ctx.fillStyle = `rgba(50, 20, 18, ${Math.max(0, (1 - smokePhase) * 0.32)})`;
        ctx.beginPath();
        ctx.arc(smokeX, smokeY, smokeR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

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
    for (let i = 0; i < 45; i++) {
      const baseX = i * 73.7;
      const flakeX = (((baseX - distance * 0.35 + (reduced ? 0 : Math.sin(elapsed + i) * 18)) % snowLoop) + snowLoop) % snowLoop;
      if (flakeX <= width + 5) {
        const flakeY = ((i * 47 + (reduced ? 0 : elapsed * (22 + i % 5))) % (height * 0.75));
        const flakeSize = i % 3 === 0 ? 3.5 : 2;
        ctx.fillRect(flakeX, flakeY, flakeSize, flakeSize);
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
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle =
      layer === 0 ? palette.mountain : layer === 1 ? palette.trees + '66' : palette.trees + 'aa';

    const drift = reduced ? 0 : distance * (0.09 + layer * 0.11);
    const step = 280 - layer * 50;
    // Calculate first segment index in continuous world space
    const startIdx = Math.floor((drift - step * 2) / step);
    const endIdx = Math.ceil((drift + width + step * 2) / step);

    if (world === 'neon') {
      // Cyberpunk skyline buildings with illuminated animated windows
      for (let idx = startIdx; idx <= endIdx; idx++) {
        const px = idx * step - drift;
        const hash = Math.sin(idx * 9301 + layer * 49297) * 49297;
        const norm = hash - Math.floor(hash);
        const bHeight = height * (0.2 + norm * 0.26);
        ctx.fillStyle = layer === 0 ? palette.mountain : palette.trees + 'aa';
        ctx.fillRect(px, ground - bHeight, step * 0.72, bHeight);

        // Glowing cyber windows
        if (layer >= 1 && !reduced) {
          ctx.fillStyle = idx % 2 === 0 ? 'rgba(0, 229, 255, 0.45)' : 'rgba(255, 0, 127, 0.45)';
          const winRows = Math.floor(bHeight / 16);
          for (let r = 1; r < winRows; r++) {
            if ((r + idx) % 3 === 0) continue;
            ctx.fillRect(px + 8, ground - bHeight + r * 16, step * 0.72 - 16, 2.5);
          }
        }
      }
    } else {
      // Seamless continuous mountain spline
      ctx.beginPath();
      const firstPx = startIdx * step - drift;
      ctx.moveTo(firstPx, ground);

      for (let idx = startIdx; idx <= endIdx; idx++) {
        const px = idx * step - drift;
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

  // 4. Foreground Trees / Structures with Realistic Wind Sway & Foliage Flutter
  ctx.fillStyle = palette.trees;
  const treeSpacing = 160;
  const treeDrift = reduced ? 0 : distance * 0.48;
  const treeStartIdx = Math.floor((treeDrift - treeSpacing * 2) / treeSpacing);
  const treeEndIdx = Math.ceil((treeDrift + width + treeSpacing * 2) / treeSpacing);

  const windWave = reduced ? 0 : Math.sin(elapsed * 1.8) * 0.035 + Math.cos(elapsed * 0.9) * 0.018;

  for (let idx = treeStartIdx; idx <= treeEndIdx; idx++) {
    const x = idx * treeSpacing - treeDrift;
    const hash = Math.sin(idx * 5147) * 21943.123;
    const norm = hash - Math.floor(hash);
    const treeHeight = height * (0.24 + norm * 0.12);

    const sway = reduced ? 0 : windWave + Math.sin(elapsed * 2.4 + idx * 1.5) * 0.022;
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

  // Drifting falling leaves and petals tumbling from tree branches across the scene
  if (!reduced && (world === 'forest' || world === 'sunset' || world === 'night')) {
    ctx.save();
    const leafCount = 16;
    const leafColor = world === 'sunset' ? '#f59e0b' : world === 'night' ? '#c4b5fd' : '#86efac';
    ctx.fillStyle = leafColor;
    for (let l = 0; l < leafCount; l++) {
      const seed = l * 97.1;
      const lx = ((seed * 11 - distance * 0.55 + elapsed * 55) % (width + 60) + width + 60) % (width + 60) - 30;
      const fallSpeed = 35 + (l % 4) * 12;
      const ly = ((seed * 23 + elapsed * fallSpeed) % (ground - 10));
      const wobble = Math.sin(elapsed * 4 + l) * 12;
      const leafAngle = elapsed * 3 + l;

      ctx.save();
      ctx.translate(lx + wobble, ly);
      ctx.rotate(leafAngle);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Deterministic ambient particles (Fireflies in forest, embers in volcano, cyber motes in neon)
  if (!reduced) {
    if (world === 'forest') {
      // Floating glowing fireflies
      ctx.save();
      for (let i = 0; i < 20; i++) {
        const fx = ((i * 83.7 - distance * 0.15 + Math.sin(elapsed * 1.2 + i * 2) * 24) % width + width) % width;
        const fy = ground - 20 - ((i * 37.3 + Math.cos(elapsed * 1.4 + i * 3) * 20) % (height * 0.45));
        const pulse = 0.5 + Math.sin(elapsed * 4 + i * 1.5) * 0.5;
        ctx.fillStyle = `rgba(216, 243, 106, ${pulse * 0.75})`;
        ctx.beginPath();
        ctx.arc(fx, fy, 2 + pulse * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
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
  }

  // 5. Ground plane with 3D perspective shading and World-Specific Terrain Details
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

  // Ground surface terrain details (Wildflowers in forest, lava vein in volcano, frost glints in alpine)
  if (world === 'forest') {
    const grassStep = 45;
    const gStart = Math.floor((distance * 0.48) / grassStep);
    const gEnd = Math.ceil((distance * 0.48 + width) / grassStep);
    for (let i = gStart; i <= gEnd; i++) {
      const gx = i * grassStep - distance * 0.48;
      const sway = Math.sin(elapsed * 2 + i * 0.8) * 3;
      ctx.fillStyle = i % 3 === 0 ? '#d8f36a' : i % 5 === 0 ? '#f472b6' : '#4ade80';
      ctx.fillRect(gx + sway, ground - 6, 2.5, 6);
      if (i % 4 === 0) {
        ctx.beginPath();
        ctx.arc(gx + sway + 1, ground - 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (world === 'volcano') {
    // Flowing glowing lava river vein below ground surface
    const lavaGrad = ctx.createLinearGradient(0, ground + 14, 0, height);
    lavaGrad.addColorStop(0, '#ff4d00');
    lavaGrad.addColorStop(0.5, '#b91c1c');
    lavaGrad.addColorStop(1, '#1c0505');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, ground + 16, width, 12);
    if (!reduced) {
      for (let b = 0; b < 8; b++) {
        const bx = ((b * 133.7 - distance * 0.7) % width + width) % width;
        const bSize = 2 + Math.sin(elapsed * 5 + b) * 1.2;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(bx, ground + 22, Math.max(1, bSize), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (world === 'neon') {
    // Glowing neon conduit pulse line
    const pulseX = (elapsed * 320) % width;
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(0, ground + 8, width, 2);
    ctx.fillStyle = '#ff007f';
    ctx.fillRect(pulseX, ground + 7, 45, 4);
  } else if (world === 'alpine') {
    // Glistening frost crystal glints on ice
    for (let f = 0; f < 10; f++) {
      const fx = ((f * 107.3 - distance * 0.9) % width + width) % width;
      const glint = Math.sin(elapsed * 6 + f * 2);
      if (glint > 0.5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(fx, ground + 8 + (f % 4) * 4, 3, 3);
      }
    }
  }

  // 6. Running speed lines on the ground (perfectly synchronized with character progress)
  ctx.fillStyle = '#ffffff30';
  const speedLineSpacing = 110;
  const speedLineDrift = distance * 1.0;
  const speedLineStartIdx = Math.floor((speedLineDrift - speedLineSpacing) / speedLineSpacing);
  const speedLineEndIdx = Math.ceil((speedLineDrift + width + speedLineSpacing) / speedLineSpacing);

  for (let idx = speedLineStartIdx; idx <= speedLineEndIdx; idx++) {
    const x = idx * speedLineSpacing - speedLineDrift;
    const laneRow = Math.abs(idx) % 5;
    ctx.fillRect(x, ground + 12 + laneRow * 15, 28, 3);
  }

  // 7. Dynamic Weather System (Rain with ripples, Storm with lightning, Snow flutter, Petals, Embers)
  const resolvedWeather: WeatherCondition =
    weather ||
    (world === 'alpine' ? 'snow' : world === 'volcano' ? 'embers' : world === 'neon' ? 'rain' : 'clear');
  drawWeatherVFX(ctx, width, height, ground, resolvedWeather, elapsed, distance, reduced);
}

export function drawWeatherVFX(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ground: number,
  weather: WeatherCondition,
  elapsed: number,
  distance: number,
  reduced = false,
) {
  if (reduced || weather === 'clear') return;
  ctx.save();

  if (weather === 'rain' || weather === 'storm') {
    const isStorm = weather === 'storm';
    if (isStorm) {
      const flashPeriod = (elapsed * 0.6) % 6;
      if (flashPeriod < 0.18) {
        const flashIntensity = Math.sin((flashPeriod / 0.18) * Math.PI) * 0.38;
        ctx.fillStyle = `rgba(240, 248, 255, ${flashIntensity})`;
        ctx.fillRect(0, 0, width, height);
      }
    }

    const dropCount = isStorm ? 70 : 45;
    ctx.strokeStyle = isStorm ? 'rgba(200, 230, 255, 0.65)' : 'rgba(180, 220, 255, 0.45)';
    ctx.lineWidth = isStorm ? 2 : 1.5;
    const rainAngle = Math.PI / 12;
    const slantDx = Math.tan(rainAngle) * 32;

    for (let d = 0; d < dropCount; d++) {
      const dropSeed = d * 139.7;
      const speed = isStorm ? 720 : 560;
      const dx = ((dropSeed - distance * 0.6 + elapsed * speed * 0.25) % (width + 80) + width + 80) % (width + 80) - 40;
      const dy = ((dropSeed * 2.3 + elapsed * speed) % (ground + 20));

      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - slantDx, dy + 28);
      ctx.stroke();

      if (dy >= ground - 8 && dy <= ground + 12 && d % 3 === 0) {
        const ripplePhase = ((elapsed * 4 + d * 0.3) % 1);
        ctx.strokeStyle = `rgba(224, 242, 254, ${(1 - ripplePhase) * 0.45})`;
        ctx.beginPath();
        ctx.ellipse(dx, ground, (8 + ripplePhase * 16), (2.5 + ripplePhase * 4), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (weather === 'snow') {
    const flakeCount = 50;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let f = 0; f < flakeCount; f++) {
      const seed = f * 113.3;
      const driftSpeed = 16 + (f % 5) * 6;
      const fallSpeed = 36 + (f % 4) * 14;
      const wobble = Math.sin(elapsed * 2.2 + f) * 20;
      const fx = ((seed - distance * 0.3 + elapsed * driftSpeed + wobble) % (width + 40) + width + 40) % (width + 40) - 20;
      const fy = ((seed * 1.7 + elapsed * fallSpeed) % (ground + 10));
      const fSize = 1.6 + (f % 3) * 1.2;

      ctx.beginPath();
      ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (weather === 'petals') {
    const petalCount = 26;
    for (let p = 0; p < petalCount; p++) {
      const seed = p * 89.3;
      const px = ((seed * 3 - distance * 0.45 + elapsed * 65) % (width + 60) + width + 60) % (width + 60) - 30;
      const py = ((seed * 1.9 + elapsed * (28 + (p % 3) * 10) + Math.sin(elapsed * 3 + p) * 18) % (ground + 15));
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(elapsed * 2.5 + p);
      ctx.fillStyle = p % 2 === 0 ? 'rgba(244, 114, 182, 0.8)' : 'rgba(251, 191, 36, 0.8)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.8, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (weather === 'embers') {
    const emberCount = 42;
    for (let e = 0; e < emberCount; e++) {
      const seed = e * 71.9;
      const ex = ((seed * 4 - distance * 0.25 + Math.sin(elapsed * 2 + e) * 16) % width + width) % width;
      const ey = ((ground + 20 - (seed * 2.7 + elapsed * (45 + (e % 5) * 15))) % ground + ground) % ground;
      const pulse = 0.4 + Math.sin(elapsed * 6 + e) * 0.6;
      ctx.fillStyle = e % 3 === 0 ? `rgba(254, 240, 138, ${pulse})` : `rgba(249, 115, 22, ${pulse})`;
      ctx.fillRect(ex, ey, 2.5, 2.5);
    }
  }

  ctx.restore();
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
  drone: '/assets/generated/enemy-drone.webp',
  golem: '/assets/generated/enemy-golem.webp',
  magma_fiend: '/assets/generated/enemy-magma-fiend.webp',
  boss_treant: '/assets/generated/boss-treant.webp',
  boss_sphinx: '/assets/generated/boss-sphinx.webp',
  boss_void_dragon: '/assets/generated/boss-void-dragon.webp',
  boss_cyber_titan: '/assets/generated/boss-cyber-titan.webp',
  boss_frost_behemoth: '/assets/generated/boss-frost-behemoth.webp',
  boss_magma_dragon: '/assets/generated/boss-magma-dragon.webp',
  boss_treant_idle: '/assets/generated/boss-treant-idle-0.webp',
  boss_treant_attack: '/assets/generated/boss-treant-attack-1.webp',
  boss_treant_hurt: '/assets/generated/boss-treant-hurt-2.webp',
  boss_sphinx_idle: '/assets/generated/boss-sphinx-idle-0.webp',
  boss_sphinx_attack: '/assets/generated/boss-sphinx-attack-1.webp',
  boss_sphinx_hurt: '/assets/generated/boss-sphinx-hurt-2.webp',
  boss_void_dragon_idle: '/assets/generated/boss-void-dragon-idle-0.webp',
  boss_void_dragon_attack: '/assets/generated/boss-void-dragon-attack-1.webp',
  boss_void_dragon_hurt: '/assets/generated/boss-void-dragon-hurt-2.webp',
  boss_cyber_titan_idle: '/assets/generated/boss-cyber-titan-idle-0.webp',
  boss_cyber_titan_attack: '/assets/generated/boss-cyber-titan-attack-1.webp',
  boss_cyber_titan_hurt: '/assets/generated/boss-cyber-titan-hurt-2.webp',
  boss_frost_behemoth_idle: '/assets/generated/boss-frost-behemoth-idle-0.webp',
  boss_frost_behemoth_attack: '/assets/generated/boss-frost-behemoth-attack-1.webp',
  boss_frost_behemoth_hurt: '/assets/generated/boss-frost-behemoth-hurt-2.webp',
  boss_magma_dragon_idle: '/assets/generated/boss-magma-dragon-idle-0.webp',
  boss_magma_dragon_attack: '/assets/generated/boss-magma-dragon-attack-1.webp',
  boss_magma_dragon_hurt: '/assets/generated/boss-magma-dragon-hurt-2.webp',
  scenario_neon_city: '/assets/generated/scenario-neon-city.webp',
  scenario_volcano_cavern: '/assets/generated/scenario-volcano-cavern.webp',
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

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Screen Shake effect when hit or shield smash
    if (game.shake > 0 && !reduced) {
      const s = Math.min(24, game.shake * 12);
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
      ctx.fillRect(-60, -60, width + 120, height + 120);
    }

    ctx.restore();
  }

  private spawnShatterParticles(worldX: number, kind: string, originY = -30) {
    // Determine debris colors based on obstacle material
    let palette: string[];
    if (kind === 'boss') {
      palette = ['#ffffff', '#fde047', '#c084fc', '#38bdf8', '#ef4444'];
    } else if (kind === 'drone') {
      palette = ['#38bdf8', '#0284c7', '#ef4444', '#f8fafc', '#94a3b8'];
    } else if (kind === 'golem') {
      palette = ['#64748b', '#475569', '#a855f7', '#c084fc', '#e2e8f0'];
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
    ctx.fillRect(-60, -60, width + 120, horizon + 62);
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
    ctx.fillRect(-60, horizon - 2, width + 120, height - horizon + 62);

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
        } else this.drawItem3D(ctx, item.kind, 120 * point.scale, game.elapsed);
      } else this.drawItem3D(ctx, item.kind, 120 * point.scale, game.elapsed);
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

    if (game.track.world === 'neon') {
      const neonCity = this.generatedVisuals.get('scenario_neon_city');
      if (neonCity?.complete && neonCity.naturalWidth) {
        const drift = (game.distance * 0.15) % width;
        ctx.save();
        ctx.globalAlpha = 0.65;
        const scenH = height * 0.48;
        ctx.drawImage(neonCity, -drift, ground - scenH, width, scenH);
        ctx.drawImage(neonCity, width - drift, ground - scenH, width, scenH);
        ctx.restore();
      }
      return;
    }
    if (game.track.world === 'volcano') {
      const volcanoCavern = this.generatedVisuals.get('scenario_volcano_cavern');
      if (volcanoCavern?.complete && volcanoCavern.naturalWidth) {
        const drift = (game.distance * 0.18) % width;
        ctx.save();
        ctx.globalAlpha = 0.7;
        const scenH = height * 0.52;
        ctx.drawImage(volcanoCavern, -drift, ground - scenH, width, scenH);
        ctx.drawImage(volcanoCavern, width - drift, ground - scenH, width, scenH);
        ctx.restore();
      }
      return;
    }
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
  private drawItem3D(ctx: CanvasRenderingContext2D, kind: string, size: number, elapsed = 0) {
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
    } else if (kind === 'drone') {
      ctx.save();
      const s = size / 70;
      ctx.scale(s, s);
      this.drawDrone(ctx, elapsed, 0);
      ctx.restore();
    } else if (kind === 'golem') {
      ctx.save();
      const s = size / 70;
      ctx.scale(s, s);
      this.drawGolem(ctx, elapsed, 0);
      ctx.restore();
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

    drawLandscape(
      ctx,
      width,
      height,
      game.track.world,
      game.distance,
      reduced,
      game.timeOfDay,
      game.elapsed,
      game.track.weather,
    );
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
      } else if (item.kind === 'drone') {
        this.drawDrone(ctx, game.elapsed, item.x);
      } else if (item.kind === 'golem') {
        this.drawGolem(ctx, game.elapsed, item.x);
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

      // Hit Flash overlay when damaged
      const flashTime = game.hitFlashes.get(item.id) ?? 0;
      if (flashTime > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.8, flashTime * 3.5);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const flashH = item.height ?? (item.kind === 'branch' ? 38 : item.kind === 'drone' ? 36 : item.kind === 'golem' ? 50 : 40);
        const flashY = item.y ? -item.y - flashH : (item.kind === 'branch' ? -85 : item.kind === 'drone' ? -85 : -flashH);
        ctx.roundRect(-26, flashY, 52, flashH, 6);
        ctx.fill();
        ctx.restore();
      }

      // Mini Health Bar for damaged obstacles and enemies
      const maxHp = obstacleHealth(item);
      const currentHp = game.obstacleDurability.get(item.id);
      if (currentHp !== undefined && currentHp < maxHp && currentHp > 0) {
        const hpPercent = Math.max(0, currentHp / maxHp);
        const barW = 44;
        const barH = 6;
        const barY = item.y ? -item.y - (item.height ?? 40) - 14 : (item.kind === 'branch' ? -98 : item.kind === 'drone' ? -98 : -56);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.roundRect(-barW / 2, barY, barW, barH, 3);
        ctx.fill();
        ctx.fillStyle = hpPercent > 0.45 ? '#22c55e' : hpPercent > 0.2 ? '#f59e0b' : '#ef4444';
        ctx.roundRect(-barW / 2, barY, barW * hpPercent, barH, 3);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barW / 2, barY, barW, barH);
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

    // 2b. Dynamic Player Movement Effects (Footstep dust, speed trails, slide sparks, power motes)
    this.drawPlayerMovementVFX(game, px, ground, scale, charScale);

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


    // 5. Anime-Style Evolving Energy Aura & Buster Charge with Physics Dynamics
    const auraLevel = game.stats?.auraLevel ?? 1;
    ctx.save();

    // Physics calculations for reactive aura movement
    const isJumpingForAura = game.height > 0;
    const isSlidingForAura = game.slide > 0;
    const speedRatio = Math.min(2.2, game.speed / 290);

    // Horizontal inertia lag: air resistance trails aura behind forward motion
    const lagX = -(speedRatio * 11 + (game.moveAxis ? 5 : 0)) * scale * charScale;

    // Vertical physics:
    // Jumping upward (game.velocity > 0): aura stretches down as a comet tail trailing the leap
    // Falling downward (game.velocity < 0): aura billows upward like rising fire
    // Sliding (isSliding): aura flattens into a low-profile streamlined horizontal wedge
    let lagY = 0;
    let auraStretchX = 1.0;
    let auraStretchY = 1.0;
    let auraTilt = 0;

    if (isSlidingForAura) {
      const slideFactor = Math.min(1, game.slide / 0.45);
      lagY = 14 * scale * charScale; // low to ground
      auraStretchX = 1.4 + (1 - slideFactor) * 0.2; // long horizontal streak
      auraStretchY = 0.55 + slideFactor * 0.15; // compressed vertical
      auraTilt = -0.12 * slideFactor;
    } else if (isJumpingForAura) {
      if (game.velocity > 0) {
        // Ascending leap
        lagY = Math.min(18, game.velocity * 0.02) * scale * charScale;
        auraStretchY = 1.0 + Math.min(0.35, game.velocity * 0.0004);
        auraStretchX = 1.0 - Math.min(0.18, game.velocity * 0.0002);
        auraTilt = Math.max(-0.25, -game.velocity * 0.00025);
      } else {
        // Descending fall
        lagY = Math.max(-22, game.velocity * 0.025) * scale * charScale;
        auraStretchY = 1.0 + Math.min(0.28, -game.velocity * 0.0003);
        auraStretchX = 1.0 + Math.min(0.22, -game.velocity * 0.0002);
        auraTilt = Math.min(0.2, -game.velocity * 0.0002);
      }
    } else {
      // Running bobbing and forward tilt
      const runTilt = Math.sin(game.distance * 0.05) * 0.06;
      auraTilt = runTilt;
      auraStretchX = 1.08;
      auraStretchY = 0.96;
    }

    const auraCenterX = lagX;
    const auraCenterY = -28 * scale * charScale + lagY;

    // Apply physics transform to aura context
    ctx.translate(auraCenterX, auraCenterY);
    ctx.rotate(auraTilt);
    ctx.scale(auraStretchX, auraStretchY);

    const auraPulse = Math.sin(game.elapsed * (8 + speedRatio * 3)) * 4;
    const baseRadius = (32 + auraLevel * 6 + auraPulse) * scale * charScale;

    // Wake / trailing aerodynamic particles behind the runner (never obscures the player sprite!).
    // Bumped the threshold from >= 2 to >= 4 so the wake is reserved for characters at
    // level 10+ in the campaign — that keeps the basic Pili / Copito / Mimi / Posho
    // trails clean instead of permanently emitting a coloured blob that reads as a
    // "green circle" stuck on the runner.
    if (game.phase === 'PLAYING' && auraLevel >= 4) {
      // Stream subtle speed wisps behind the runner instead of a solid ball over the body
      const wispAlpha = Math.min(0.28, 0.12 + auraLevel * 0.04);
      const wispGrad = ctx.createLinearGradient(0, 0, -baseRadius * 1.5, 0);
      const wispColor =
        auraLevel >= 4
          ? 'rgba(168, 85, 247,'
          : auraLevel >= 3
            ? 'rgba(234, 179, 8,'
            : 'rgba(56, 189, 248,';
      wispGrad.addColorStop(0, `${wispColor} ${wispAlpha})`);
      wispGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = wispGrad;
      ctx.beginPath();
      ctx.ellipse(-baseRadius * 0.5, 0, baseRadius * 0.8, baseRadius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (auraLevel >= 4) {
      // Elegant thin outer ring trailing behind (kept in sync with wisp threshold).
      ctx.strokeStyle = auraLevel >= 4 ? 'rgba(192, 132, 252, 0.4)' : 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.ellipse(-baseRadius * 0.3, 0, baseRadius * 0.9, baseRadius * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (auraLevel >= 3) {
      ctx.fillStyle = auraLevel >= 5 ? '#f43f5e' : '#facc15';
      for (let i = 0; i < 6; i++) {
        const sparkPhase = (game.elapsed * 4 + i * (Math.PI / 3)) % (Math.PI * 2);
        const sparkDist = baseRadius * (0.6 + Math.sin(game.elapsed * 6 + i) * 0.3);
        const sx = -Math.abs(Math.cos(sparkPhase)) * sparkDist * 1.25; // streaming backwards in wake!
        const sy = Math.sin(sparkPhase) * sparkDist * 0.85;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (auraLevel >= 4) {
      const shockwave = (game.elapsed * (2 + speedRatio * 0.8)) % 1;
      ctx.strokeStyle = `rgba(216, 180, 254, ${1 - shockwave})`;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * (1 + shockwave * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (auraLevel >= 5) {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.2 * scale;
      ctx.beginPath();
      const zAngle = (game.elapsed * 12) % (Math.PI * 2);
      const zx1 = -Math.abs(Math.cos(zAngle)) * baseRadius * 0.9;
      const zy1 = Math.sin(zAngle) * baseRadius * 0.9;
      const zx2 = zx1 - Math.sin(game.elapsed * 91) * 11 * scale;
      const zy2 = zy1 + Math.cos(game.elapsed * 77) * 9 * scale;
      ctx.moveTo(zx1, zy1);
      ctx.lineTo(zx2, zy2);
      ctx.stroke();
    }

    // 5b. Multi-tier Progressive Buster Charge Aura (Upgrades visually at each 100% / Tier 1, 2, 3+)
    if (game.isChargingPower && game.powerChargeRatio > 0) {
      const charge = game.powerChargeRatio;
      const tier = Math.floor(charge);

      // Color scheme based on charge tier
      let primaryR = 255, primaryG = 255, primaryB = 255;
      let secondaryColor = 'rgba(255, 255, 255, 0.8)';
      let sparkColor = '#ffffff';

      if (tier >= 3) {
        primaryR = 168; primaryG = 85; primaryB = 247;
        secondaryColor = 'rgba(236, 72, 153, 0.9)';
        sparkColor = '#f472b6';
      } else if (tier >= 2) {
        primaryR = 239; primaryG = 68; primaryB = 68;
        secondaryColor = 'rgba(249, 115, 22, 0.9)';
        sparkColor = '#fbbf24';
      } else if (tier >= 1) {
        primaryR = 245; primaryG = 158; primaryB = 11;
        secondaryColor = 'rgba(234, 179, 8, 0.85)';
        sparkColor = '#fef08a';
      } else {
        const sub = Math.min(1, charge);
        primaryR = Math.round(180 + sub * 75);
        primaryG = Math.round(230 + sub * 25);
        primaryB = 255;
        secondaryColor = 'rgba(56, 189, 248, 0.7)';
        sparkColor = '#bae6fd';
      }

      const chargeColor = `rgb(${primaryR}, ${primaryG}, ${primaryB})`;
      const extraRadius = Math.min(charge * 24 + tier * 16, 140);
      const pulse = Math.sin(game.elapsed * (20 + tier * 12)) * (3 + tier * 2);
      const chargeRadius = (32 + extraRadius + pulse) * scale * charScale;

      const chargeGrad = ctx.createRadialGradient(0, 0, 6 * scale, 0, 0, chargeRadius);
      chargeGrad.addColorStop(0, `rgba(255, 255, 255, ${0.7 + Math.min(charge, 2) * 0.15})`);
      chargeGrad.addColorStop(0.35, `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${0.5 + Math.min(tier, 3) * 0.15})`);
      chargeGrad.addColorStop(0.75, secondaryColor);
      chargeGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = chargeGrad;
      ctx.beginPath();
      ctx.arc(0, 0, chargeRadius, 0, Math.PI * 2);
      ctx.fill();

      const ringCount = 1 + tier;
      for (let rIdx = 0; rIdx < ringCount; rIdx++) {
        const ringProgress = ((game.elapsed * (2 + rIdx * 1.2) + rIdx * 0.3) % 1);
        const ringRad = chargeRadius * (0.4 + 0.6 * (1 - ringProgress));
        ctx.strokeStyle = rIdx % 2 === 0 ? chargeColor : secondaryColor;
        ctx.lineWidth = (2 + tier * 1.5) * scale;
        ctx.beginPath();
        ctx.arc(0, 0, ringRad, 0, Math.PI * 2);
        ctx.stroke();
      }

      const particleCount = Math.floor(6 + charge * 8 + tier * 6);
      ctx.fillStyle = sparkColor;
      for (let p = 0; p < particleCount; p++) {
        const pSpeed = 8 + tier * 6;
        const pAngle = (game.elapsed * pSpeed + p * ((Math.PI * 2) / particleCount)) % (Math.PI * 2);
        const pDist = chargeRadius * (0.35 + 0.65 * ((1 - ((game.elapsed * (3 + tier) + p * 0.18) % 1))));
        const pxPos = -Math.abs(Math.cos(pAngle)) * pDist * 1.2;
        const pyPos = Math.sin(pAngle) * pDist;
        ctx.beginPath();
        ctx.arc(pxPos, pyPos, (2 + tier * 1.5) * scale, 0, Math.PI * 2);
        ctx.fill();

        if (tier >= 2 && p % 3 === 0) {
          ctx.strokeStyle = sparkColor;
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(pxPos, pyPos);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // Shield Aura - Elegant Multi-Layered Cyan Crystal Energy Barrier
    if (game.shield > 0) {
      ctx.save();
      const shieldCenterY = -28 * scale * charScale;
      const shieldRadius = 46 * scale * charScale;
      const shieldPulse = Math.sin(game.elapsed * 6) * 2.5 * scale;
      const currentRadius = shieldRadius + shieldPulse;

      // Crystalline energy outer ring with subtle perimeter shimmer (100% transparent interior so character is clear)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 2 * scale;
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 8 * scale;
      ctx.beginPath();
      ctx.arc(0, shieldCenterY, currentRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner orbiting shield nodes
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.7)';
      ctx.lineWidth = 1.5 * scale;
      for (let s = 0; s < 4; s++) {
        const sAngle = game.elapsed * 2.5 + (s * Math.PI) / 2;
        const sx = Math.cos(sAngle) * (currentRadius * 0.95);
        const sy = shieldCenterY + Math.sin(sAngle) * (currentRadius * 0.95);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 2 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
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
        // Multi-tier outer energy aura and shockwaves for charged Buster projectile
        const pulse = Math.sin(game.elapsed * 26) * 3 * scale;
        const outerRadius = (p.size * 0.95 * scale) + pulse;

        const chargedGrad = ctx.createRadialGradient(0, 0, p.size * scale * 0.15, 0, 0, outerRadius);
        chargedGrad.addColorStop(0, '#ffffff');
        chargedGrad.addColorStop(0.35, p.color);
        chargedGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.4)');
        chargedGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = chargedGrad;
        ctx.beginPath();
        ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing shockwave ring around high-tier projectiles
        if (p.size >= 40) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5 * scale;
          ctx.beginPath();
          ctx.arc(0, 0, outerRadius * 0.85, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Energy corona arcs around hyper-charged shots
        if (p.size >= 65) {
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.8 * scale;
          for (let a = 0; a < 4; a++) {
            const arcAngle = (game.elapsed * 15 + a * (Math.PI / 2)) % (Math.PI * 2);
            ctx.beginPath();
            ctx.arc(0, 0, outerRadius * 1.15, arcAngle, arcAngle + 0.6);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * scale * 0.62, 0, Math.PI * 2);
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

    // 8. Render Projectile Impact Feedback (Expanding Shockwave Ring & Floating Damage Numbers)
    if (game.damageFeedbacks.length > 0) {
      ctx.save();
      for (const df of game.damageFeedbacks) {
        const progress = Math.min(1, df.elapsed / df.duration);
        const hitScreenX = px + (df.x - game.distance) * scale;
        const hitScreenY = ground - df.y * scale;

        if (hitScreenX < -50 || hitScreenX > width + 50) continue;

        // Expanding Impact Shockwave Ring & Spark Stars
        const ringAlpha = Math.max(0, 1 - progress);
        const ringRadius = (16 + progress * 48) * scale;
        ctx.strokeStyle = df.color || '#ffffff';
        ctx.lineWidth = Math.max(1.5, 3.5 * (1 - progress) * scale);
        ctx.beginPath();
        ctx.arc(hitScreenX, hitScreenY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        // High intensity white center flash during the first 25% of impact
        if (progress < 0.25) {
          const flashAlpha = 1 - progress / 0.25;
          ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.75})`;
          ctx.beginPath();
          ctx.arc(hitScreenX, hitScreenY, 24 * scale * (1 - progress), 0, Math.PI * 2);
          ctx.fill();
        }

        // Floating Damage Number rising upwards with bouncy deceleration
        const floatY = hitScreenY - Math.sin(progress * Math.PI * 0.5) * 45 * scale;
        const textAlpha = Math.max(0, 1 - Math.pow(progress, 2.5));
        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.font = `900 ${Math.max(14, Math.round((18 + (df.damage >= 50 ? 4 : 0)) * scale))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Black outline for extreme contrast
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4 * scale;
        const damageText = `-${df.damage}`;
        ctx.strokeText(damageText, hitScreenX, floatY);
        // Colored text fill
        ctx.fillStyle = df.color || '#ffffff';
        ctx.fillText(damageText, hitScreenX, floatY);
        ctx.restore();
      }
      ctx.restore();
    }

    this.renderScenarioSide(game, width, height, true);
  }

  private drawPlayerMovementVFX(
    game: Simulation,
    px: number,
    ground: number,
    scale: number,
    charScale: number,
  ) {
    const ctx = this.ctx;
    const isGrounded = game.height <= 0.5;
    const isMoving = game.phase === 'PLAYING' && (game.inBossFight ? game.moveAxis !== 0 : true);
    const isSliding = game.slide > 0;
    const isBoosted = game.boost > 0;

    // 1. Footstep ground terrain dust puffs
    if (isGrounded && isMoving && !isSliding) {
      const stride = game.distance * 0.05;
      const stepPhase = Math.sin(stride * 2);
      if (stepPhase > 0.65) {
        const terrainColor =
          game.track.world === 'forest'
            ? '#8a654c'
            : game.track.world === 'sunset'
              ? '#d89870'
              : game.track.world === 'night'
                ? '#818cf8'
                : game.track.world === 'neon'
                  ? '#00e5ff'
                  : game.track.world === 'alpine'
                    ? '#ffffff'
                    : '#ea580c';
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = terrainColor;
        for (let p = 0; p < 3; p++) {
          const puffX = px - game.facing * (12 + p * 8) * scale * charScale;
          const puffY = ground - (2 + p * 2.5) * scale;
          const puffR = (2.5 + p * 1.5) * scale;
          ctx.beginPath();
          ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 2. Slide friction sparks and ground smoke plume
    if (isGrounded && isSliding) {
      ctx.save();
      ctx.fillStyle = 'rgba(210, 220, 225, 0.45)';
      for (let s = 0; s < 4; s++) {
        const sx = px - game.facing * (16 + s * 12) * scale * charScale;
        const sy = ground - (3 + s * 3) * scale;
        const sr = (5 + s * 2.5) * scale;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fef08a';
      for (let sp = 0; sp < 5; sp++) {
        const sparkAngle = Math.PI - 0.4 + Math.sin(game.elapsed * 28 + sp) * 0.7;
        const sparkDist = (10 + sp * 7) * scale;
        const spX = px - game.facing * Math.cos(sparkAngle) * sparkDist;
        const spY = ground - Math.sin(sparkAngle) * sparkDist * 0.5;
        ctx.fillRect(spX - 1.5 * scale, spY - 1.5 * scale, 3 * scale, 3 * scale);
      }
      ctx.restore();
    }

    // 3. Supersonic Speed Trail & Ghosting
    if (isBoosted || (isMoving && !isGrounded && Math.abs(game.velocity) > 380)) {
      ctx.save();
      const ghostColor = isBoosted ? 'rgba(56, 189, 248, 0.28)' : 'rgba(255, 255, 255, 0.18)';
      const ghostCount = isBoosted ? 3 : 2;
      for (let g = 1; g <= ghostCount; g++) {
        const gOffset = g * 20 * scale * charScale * -game.facing;
        ctx.save();
        ctx.translate(px + gOffset, ground - game.height * scale);
        ctx.scale(game.facing, 1);
        ctx.globalAlpha = 0.32 / g;
        ctx.fillStyle = ghostColor;
        ctx.beginPath();
        ctx.ellipse(0, -28 * scale * charScale, 18 * scale * charScale, 26 * scale * charScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5 * scale;
      for (let w = 0; w < 3; w++) {
        const wy = ground - (game.height + 14 + w * 16) * scale;
        const wx = px - game.facing * 18 * scale;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx - game.facing * (30 + w * 10) * scale, wy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Active Collected Power Swirling Motes
    if (game.activePowerId) {
      ctx.save();
      const powerColors: Record<string, { main: string; glow: string }> = {
        flame_burst: { main: '#f97316', glow: 'rgba(249,115,22,0.45)' },
        aqua_wave: { main: '#06b6d4', glow: 'rgba(6,182,212,0.45)' },
        nature_roots: { main: '#4ade80', glow: 'rgba(74,222,128,0.45)' },
        volt_dash: { main: '#eab308', glow: 'rgba(234,179,8,0.45)' },
        cosmic_void: { main: '#c084fc', glow: 'rgba(192,132,252,0.45)' },
      };
      const powerStyle = powerColors[game.activePowerId] ?? powerColors.flame_burst;
      const moteRadius = 30 * scale * charScale;
      for (let m = 0; m < 4; m++) {
        const mAngle = (game.elapsed * 5.2 + m * (Math.PI / 2)) % (Math.PI * 2);
        const mx = px + Math.cos(mAngle) * moteRadius;
        const my = ground - (game.height + 28) * scale + Math.sin(mAngle) * moteRadius * 0.6;
        ctx.fillStyle = powerStyle.main;
        ctx.shadowColor = powerStyle.glow;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(mx, my, 3 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. Instant Muzzle Flash / Weapon Firing Shockwave (Zero Latency Feedback)
    if (game.muzzleFlash > 0) {
      const mfRatio = game.muzzleFlash / 0.08;
      const blastX = px + game.facing * 28 * scale * charScale;
      const blastY = ground - (game.height + 26) * scale * charScale;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${mfRatio * 0.9})`;
      ctx.fillStyle = `rgba(254, 240, 138, ${mfRatio * 0.6})`;
      ctx.lineWidth = 2.5 * scale;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12 * mfRatio;
      ctx.beginPath();
      ctx.arc(blastX, blastY, (1 - mfRatio) * 22 * scale + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(blastX, blastY, (1 - mfRatio) * 10 * scale + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBoss(game: Simulation, bx: number, by: number, scale: number) {
    const ctx = this.ctx;
    if (
      game.bossEntity &&
      (!game.bossEntity.defeated || game.bossEntity.defeatTimer > 0) &&
      game.boss
    ) {
      const boss = game.boss;
      const bossSize = 65 * boss.size * scale;
      const archetype: BossArchetype =
        boss.archetype ??
        (boss.element === 'nature'
          ? 'treant'
          : boss.element === 'water'
            ? 'frost_behemoth'
            : boss.element === 'electric'
              ? 'cyber_titan'
              : boss.element === 'cosmic'
                ? 'void_dragon'
                : boss.element === 'fire'
                  ? 'magma_dragon'
                  : 'sphinx');
      const hpRatio = Math.max(0, game.bossEntity.health / game.bossEntity.maxHealth);
      const isEnraged = hpRatio <= 0.35;
      const isTelegraphing = game.bossEntity.isTelegraphing;

      ctx.save();
      ctx.translate(bx, by);

      // Defeat disintegration
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
          ctx.arc(0, 0, bossSize * (0.45 + destruction * (1.2 + ring * 0.35)), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Telegraph warning line & indicator
      if (isTelegraphing) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.font = `bold ${Math.round(26 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⚠️', 0, -bossSize * 0.95);
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

      // Enraged crackling flame sparks around perimeter (no solid obscuring circle over boss)
      if (isEnraged) {
        ctx.save();
        ctx.fillStyle = '#f97316';
        for (let s = 0; s < 8; s++) {
          const sAngle = (game.elapsed * 12 + s * (Math.PI / 4)) % (Math.PI * 2);
          const sDist = bossSize * (0.8 + Math.sin(game.elapsed * 8 + s) * 0.22);
          ctx.fillRect(Math.cos(sAngle) * sDist - 2.5 * scale, Math.sin(sAngle) * sDist - 2.5 * scale, 5 * scale, 5 * scale);
        }
        ctx.restore();
      }

      // Dispatch to sprite or specific boss archetype renderer
      const idleFrame = this.generatedVisuals.get(('boss_' + archetype + '_idle') as any);
      const attackFrame = this.generatedVisuals.get(('boss_' + archetype + '_attack') as any);
      const hurtFrame = this.generatedVisuals.get(('boss_' + archetype + '_hurt') as any);
      const fallbackSprite = this.generatedVisuals.get(('boss_' + archetype) as any);
      const bossFlash = game.hitFlashes.get('boss') ?? 0;

      // Choose which frame to show based on state & animation cycle
      let activeFrame = idleFrame;
      const animStep = Math.floor(game.bossEntity?.animFrame ?? (game.elapsed * 4)) % 3;
      if (bossFlash > 0 && hurtFrame?.complete && hurtFrame.naturalWidth) {
        activeFrame = hurtFrame;
      } else if ((isTelegraphing || (animStep === 2 && isEnraged)) && attackFrame?.complete && attackFrame.naturalWidth) {
        activeFrame = attackFrame;
      } else if (!activeFrame?.complete || !activeFrame?.naturalWidth) {
        activeFrame = fallbackSprite;
      }

      if (activeFrame?.complete && activeFrame.naturalWidth) {
        ctx.save();
        // Dynamic continuous hover, wing-beat bobbing, and organic breathing
        const hoverSpeed = isEnraged ? 4.5 : 2.6;
        const hover = Math.sin(game.elapsed * hoverSpeed) * bossSize * 0.07;
        const breathe = Math.sin(game.elapsed * (isEnraged ? 8 : 4.0)) * bossSize * 0.04;
        const swayTilt = Math.sin(game.elapsed * 2.2) * 0.04;
        const drawW = bossSize * 1.45;
        const drawH = bossSize * 1.45;
        ctx.translate(0, hover + breathe);
        ctx.rotate(swayTilt);
        if (isTelegraphing) {
          ctx.rotate(Math.sin(game.elapsed * 28) * 0.06);
          ctx.translate(Math.sin(game.elapsed * 20) * bossSize * 0.05, 0);
        }
        if (bossFlash > 0) {
          // Brief hurt shake
          ctx.translate(
            (Math.random() - 0.5) * 6 * scale,
            (Math.random() - 0.5) * 6 * scale,
          );
          ctx.globalAlpha = 1 - Math.min(0.4, bossFlash * 1.5);
        }
        ctx.drawImage(activeFrame, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      } else {
        switch (archetype) {
          case 'treant':
            this.drawTreantBoss(ctx, game, boss, bossSize, scale, isEnraged, isTelegraphing);
            break;
          case 'sphinx':
            this.drawSphinxBoss(ctx, game, boss, bossSize, scale, isEnraged, isTelegraphing);
            break;
          case 'void_dragon':
            this.drawVoidDragonBoss(ctx, game, boss, bossSize, scale, isEnraged, isTelegraphing);
            break;
          case 'cyber_titan':
            this.drawCyberTitanBoss(ctx, game, boss, bossSize, scale, isEnraged, isTelegraphing);
            break;
          case 'frost_behemoth':
            this.drawFrostBehemothBoss(ctx, game, boss, bossSize, scale, isEnraged, isTelegraphing);
            break;
          case 'magma_dragon':
          default:
            this.drawMagmaDragonBoss(ctx, game, boss, bossSize, scale, isEnraged, isTelegraphing);
            break;
        }
      }

      // Boss Overhead Health Bar
      const barWidth = 140 * scale;
      const barHeight = 12 * scale;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.roundRect(-barWidth / 2, -bossSize * 0.75 - barHeight, barWidth, barHeight, 6);
      ctx.fill();

      ctx.fillStyle = hpRatio > 0.4 ? '#22c55e' : hpRatio > 0.2 ? '#f59e0b' : '#ef4444';
      ctx.roundRect(-barWidth / 2, -bossSize * 0.75 - barHeight, barWidth * hpRatio, barHeight, 6);
      ctx.fill();

      // Boss Name Label
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(10, Math.round(11 * scale))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(boss.name, 0, -bossSize * 0.75 - barHeight - 4);

      // Boss Hit Flash overlay (subtle red damage flash on borders, no solid white circle)
      if (bossFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.4, bossFlash * 1.5);
        ctx.strokeStyle = '#ff334b';
        ctx.lineWidth = 3 * scale;
        ctx.strokeRect(-bossSize * 0.5, -bossSize * 0.5, bossSize, bossSize);
        ctx.restore();
      }

      ctx.restore();
    }
  }

  private drawTreantBoss(
    ctx: CanvasRenderingContext2D,
    game: Simulation,
    boss: BossConfig,
    size: number,
    scale: number,
    isEnraged: boolean,
    isTelegraphing: boolean,
  ) {
    const sway = Math.sin(game.elapsed * (isEnraged ? 6 : 3.5)) * 0.12;
    const breathe = Math.sin(game.elapsed * 4) * size * 0.04;

    ctx.save();
    ctx.rotate(sway * 0.3);

    // Wood Trunk Body
    const bodyGrad = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    bodyGrad.addColorStop(0, '#5c3d2e');
    bodyGrad.addColorStop(0.5, '#43281c');
    bodyGrad.addColorStop(1, '#27170e');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-size * 0.4, -size * 0.45 + breathe, size * 0.8, size * 0.85, 18 * scale);
    ctx.fill();
    ctx.strokeStyle = '#27170e';
    ctx.lineWidth = 3 * scale;
    ctx.stroke();

    // Wood grain lines
    ctx.strokeStyle = '#7f5539';
    ctx.lineWidth = 2 * scale;
    for (let g = -2; g <= 2; g++) {
      ctx.beginPath();
      ctx.moveTo(g * 14 * scale, -size * 0.38 + breathe);
      ctx.quadraticCurveTo(g * 18 * scale + sway * 15, 0, g * 12 * scale, size * 0.32 + breathe);
      ctx.stroke();
    }

    // Twisting Branch Antlers
    ctx.strokeStyle = '#5c3d2e';
    ctx.lineWidth = 8 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-size * 0.25, -size * 0.4 + breathe);
    ctx.quadraticCurveTo(-size * 0.6, -size * 0.7 + sway * 20, -size * 0.45, -size * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.25, -size * 0.4 + breathe);
    ctx.quadraticCurveTo(size * 0.6, -size * 0.7 - sway * 20, size * 0.45, -size * 0.95);
    ctx.stroke();

    // Leaf clusters on antlers
    ctx.fillStyle = '#22c55e';
    const leafPulse = Math.sin(game.elapsed * 6) * 3 * scale;
    ctx.beginPath();
    ctx.arc(-size * 0.45, -size * 0.95, 16 * scale + leafPulse, 0, Math.PI * 2);
    ctx.arc(size * 0.45, -size * 0.95, 16 * scale + leafPulse, 0, Math.PI * 2);
    ctx.arc(-size * 0.58, -size * 0.7, 13 * scale, 0, Math.PI * 2);
    ctx.arc(size * 0.58, -size * 0.7, 13 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.arc(-size * 0.45, -size * 0.95, 7 * scale, 0, Math.PI * 2);
    ctx.arc(size * 0.45, -size * 0.95, 7 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing Emerald Heart Gem — sized as a small accent that nests inside the trunk
    // body. Prior versions used size*0.18+ which produced a giant solid disc (and visually
    // swallowed the rest of the boss at higher bossSize / zoom combos), so we cap at a tiny
    // radius (≤ ~12px even at the largest boss size) and use a gentle shadowBlur.
    const rawHeartPulse =
      (isEnraged ? 0.04 : 0.025) + Math.sin(game.elapsed * (isEnraged ? 10 : 5)) * 0.008;
    const heartPulse = Math.min(rawHeartPulse, 0.06);
    ctx.save();
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 6 * scale;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(0, breathe, size * heartPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ecfdf5';
    ctx.beginPath();
    ctx.arc(0, breathe, size * heartPulse * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glowing Amber Eyes
    const eyeY = -size * 0.2 + breathe;
    ctx.fillStyle = isTelegraphing ? '#ef4444' : '#f59e0b';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(-size * 0.16, eyeY, 6 * scale, 9 * scale, -0.2, 0, Math.PI * 2);
    ctx.ellipse(size * 0.16, eyeY, 6 * scale, 9 * scale, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Telegraphing Bloom tell
    if (isTelegraphing) {
      ctx.save();
      const bloomSize = (14 + Math.sin(game.elapsed * 20) * 5) * scale;
      ctx.fillStyle = '#eab308';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, -size * 0.55 + breathe, bloomSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawSphinxBoss(
    ctx: CanvasRenderingContext2D,
    game: Simulation,
    boss: BossConfig,
    size: number,
    scale: number,
    isEnraged: boolean,
    isTelegraphing: boolean,
  ) {
    const flap = Math.sin(game.elapsed * (isEnraged ? 12 : 8)) * 0.35;
    const breathe = Math.sin(game.elapsed * 5) * size * 0.03;

    ctx.save();

    // Majestic Feathered Solar Wings
    ctx.save();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(-size * 0.55, -size * 0.15 + flap * 20, size * 0.5, size * 0.22, -0.45 + flap * 0.3, 0, Math.PI * 2);
    ctx.ellipse(size * 0.55, -size * 0.15 - flap * 20, size * 0.5, size * 0.22, 0.45 - flap * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(-size * 0.55, -size * 0.15 + flap * 20, size * 0.35, size * 0.14, -0.45 + flap * 0.3, 0, Math.PI * 2);
    ctx.ellipse(size * 0.55, -size * 0.15 - flap * 20, size * 0.35, size * 0.14, 0.45 - flap * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sculpted Sphinx Torso
    const sphinxGrad = ctx.createLinearGradient(0, -size * 0.4, 0, size * 0.4);
    sphinxGrad.addColorStop(0, '#fef08a');
    sphinxGrad.addColorStop(0.4, '#d97706');
    sphinxGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = sphinxGrad;
    ctx.beginPath();
    ctx.ellipse(0, breathe, size * 0.42, size * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Golden Headdress Stripes
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.rect(-size * 0.28, -size * 0.45 + breathe, size * 0.56, 8 * scale);
    ctx.rect(-size * 0.24, -size * 0.35 + breathe, size * 0.48, 7 * scale);
    ctx.fill();

    // Radiant Solar Disc Core
    const coronaR = size * (0.2 + Math.sin(game.elapsed * 7) * 0.04);
    ctx.save();
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 15 * scale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, size * 0.08 + breathe, coronaR, 0, Math.PI * 2);
    ctx.fill();
    // Solar Corona Rays
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2 * scale;
    for (let r = 0; r < 8; r++) {
      const rAngle = game.elapsed * 2 + r * (Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(Math.cos(rAngle) * coronaR, size * 0.08 + breathe + Math.sin(rAngle) * coronaR);
      ctx.lineTo(Math.cos(rAngle) * (coronaR + 10 * scale), size * 0.08 + breathe + Math.sin(rAngle) * (coronaR + 10 * scale));
      ctx.stroke();
    }
    ctx.restore();

    // Turquoise Falcon Eyes
    ctx.fillStyle = isTelegraphing ? '#ef4444' : '#06b6d4';
    ctx.beginPath();
    ctx.ellipse(-size * 0.14, -size * 0.18 + breathe, 6 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(size * 0.14, -size * 0.18 + breathe, 6 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawVoidDragonBoss(
    ctx: CanvasRenderingContext2D,
    game: Simulation,
    boss: BossConfig,
    size: number,
    scale: number,
    isEnraged: boolean,
    isTelegraphing: boolean,
  ) {
    const wave = Math.sin(game.elapsed * (isEnraged ? 7 : 4.5)) * 0.2;
    const breathe = Math.sin(game.elapsed * 4.2) * size * 0.04;

    ctx.save();

    // Shadow Wings with Constellation Star Points
    ctx.save();
    ctx.fillStyle = 'rgba(88, 28, 135, 0.75)';
    ctx.beginPath();
    ctx.moveTo(0, breathe);
    ctx.quadraticCurveTo(-size * 0.5, -size * 0.6 + wave * 25, -size * 0.8, -size * 0.1);
    ctx.quadraticCurveTo(-size * 0.5, size * 0.3, 0, size * 0.2 + breathe);
    ctx.quadraticCurveTo(size * 0.5, size * 0.3, size * 0.8, -size * 0.1);
    ctx.quadraticCurveTo(size * 0.5, -size * 0.6 - wave * 25, 0, breathe);
    ctx.fill();
    // Constellation stars inside wing membrane
    ctx.fillStyle = '#ffffff';
    for (let s = 0; s < 8; s++) {
      const sx = (s < 4 ? -1 : 1) * size * (0.35 + (s % 3) * 0.12);
      const sy = -size * 0.2 + (s % 4) * size * 0.12;
      ctx.fillRect(sx, sy, 2 * scale, 2 * scale);
    }
    ctx.restore();

    // Serpentine Void Body
    const voidGrad = ctx.createRadialGradient(0, breathe, size * 0.1, 0, breathe, size * 0.55);
    voidGrad.addColorStop(0, '#7c3aed');
    voidGrad.addColorStop(0.5, '#312e81');
    voidGrad.addColorStop(1, '#09090b');
    ctx.fillStyle = voidGrad;
    ctx.beginPath();
    ctx.ellipse(0, breathe, size * 0.36, size * 0.44, wave * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Crescent Dragon Horns
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.arc(-size * 0.2, -size * 0.35 + breathe, size * 0.24, Math.PI * 0.8, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.2, -size * 0.35 + breathe, size * 0.24, -Math.PI * 0.6, Math.PI * 0.2);
    ctx.stroke();

    // Swirling Singularity Galaxy Core
    ctx.save();
    const coreR = size * (0.16 + Math.sin(game.elapsed * 8) * 0.04);
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 16 * scale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, breathe, coreR, 0, Math.PI * 2);
    ctx.fill();
    // Orbiting asteroid shards
    ctx.fillStyle = '#e879f9';
    for (let a = 0; a < 4; a++) {
      const aAngle = game.elapsed * 4 + a * (Math.PI / 2);
      const aDist = size * 0.28;
      ctx.fillRect(Math.cos(aAngle) * aDist - 3 * scale, breathe + Math.sin(aAngle) * aDist * 0.6 - 3 * scale, 6 * scale, 6 * scale);
    }
    ctx.restore();

    // Piercing Violet Eyes
    ctx.fillStyle = isTelegraphing ? '#ef4444' : '#e879f9';
    ctx.beginPath();
    ctx.ellipse(-size * 0.12, -size * 0.16 + breathe, 6 * scale, 3 * scale, -0.3, 0, Math.PI * 2);
    ctx.ellipse(size * 0.12, -size * 0.16 + breathe, 6 * scale, 3 * scale, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawCyberTitanBoss(
    ctx: CanvasRenderingContext2D,
    game: Simulation,
    boss: BossConfig,
    size: number,
    scale: number,
    isEnraged: boolean,
    isTelegraphing: boolean,
  ) {
    const hover = Math.sin(game.elapsed * (isEnraged ? 8 : 5)) * 4 * scale;
    const thrusterFlame = 0.8 + Math.sin(game.elapsed * 24) * 0.3;

    ctx.save();
    ctx.translate(0, hover);

    // Twin High-Power Jet Thrusters
    const jetGrad = ctx.createLinearGradient(0, size * 0.3, 0, size * 0.3 + 30 * thrusterFlame * scale);
    jetGrad.addColorStop(0, '#00e5ff');
    jetGrad.addColorStop(0.5, '#3b82f6');
    jetGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = jetGrad;
    ctx.fillRect(-size * 0.38, size * 0.3, 16 * scale, 28 * thrusterFlame * scale);
    ctx.fillRect(size * 0.38 - 16 * scale, size * 0.3, 16 * scale, 28 * thrusterFlame * scale);

    // Angular Heavy Mecha Chassis
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(-size * 0.45, -size * 0.2);
    ctx.lineTo(-size * 0.25, -size * 0.45);
    ctx.lineTo(size * 0.25, -size * 0.45);
    ctx.lineTo(size * 0.45, -size * 0.2);
    ctx.lineTo(size * 0.35, size * 0.32);
    ctx.lineTo(-size * 0.35, size * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dual Shoulder Railgun Cannons
    ctx.fillStyle = '#475569';
    ctx.fillRect(-size * 0.52, -size * 0.15, 12 * scale, 26 * scale);
    ctx.fillRect(size * 0.52 - 12 * scale, -size * 0.15, 12 * scale, 26 * scale);

    // Glowing Neon Circuit Conduits
    ctx.strokeStyle = isEnraged ? '#ff007f' : '#00e5ff';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(-size * 0.25, -size * 0.3);
    ctx.lineTo(0, -size * 0.15);
    ctx.lineTo(size * 0.25, -size * 0.3);
    ctx.moveTo(0, -size * 0.15);
    ctx.lineTo(0, size * 0.12);
    ctx.stroke();

    // Plasma Reactor Core
    const reactorR = size * (0.16 + Math.sin(game.elapsed * 12) * 0.03);
    ctx.save();
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 16 * scale;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(0, size * 0.08, reactorR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, size * 0.08, reactorR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cyclops Scanning Laser Visor
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-size * 0.18, -size * 0.28, size * 0.36, 6 * scale);
    // Laser glint
    const sweep = Math.sin(game.elapsed * 6) * size * 0.14;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sweep - 3 * scale, -size * 0.28, 6 * scale, 6 * scale);

    ctx.restore();
  }

  private drawFrostBehemothBoss(
    ctx: CanvasRenderingContext2D,
    game: Simulation,
    boss: BossConfig,
    size: number,
    scale: number,
    isEnraged: boolean,
    isTelegraphing: boolean,
  ) {
    const floatBob = Math.sin(game.elapsed * 3.5) * 4 * scale;

    ctx.save();
    ctx.translate(0, floatBob);

    // Chiseled Glacier Ice Armor Hull
    const iceGrad = ctx.createLinearGradient(-size * 0.4, -size * 0.4, size * 0.4, size * 0.4);
    iceGrad.addColorStop(0, '#e0f2fe');
    iceGrad.addColorStop(0.4, '#38bdf8');
    iceGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, 0);
    ctx.lineTo(-size * 0.3, -size * 0.42);
    ctx.lineTo(0, -size * 0.52);
    ctx.lineTo(size * 0.3, -size * 0.42);
    ctx.lineTo(size * 0.42, 0);
    ctx.lineTo(size * 0.28, size * 0.4);
    ctx.lineTo(-size * 0.28, size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();

    // Sharp Icicle Horns & Spines
    ctx.fillStyle = '#e0f2fe';
    // Left Horn
    ctx.beginPath();
    ctx.moveTo(-size * 0.28, -size * 0.38);
    ctx.lineTo(-size * 0.6, -size * 0.7);
    ctx.lineTo(-size * 0.2, -size * 0.48);
    ctx.closePath();
    ctx.fill();
    // Right Horn
    ctx.beginPath();
    ctx.moveTo(size * 0.28, -size * 0.38);
    ctx.lineTo(size * 0.6, -size * 0.7);
    ctx.lineTo(size * 0.2, -size * 0.48);
    ctx.closePath();
    ctx.fill();

    // Radiant Sapphire Cryo-Heart
    const cryoPulse = size * (0.17 + Math.sin(game.elapsed * 6) * 0.04);
    ctx.save();
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 18 * scale;
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(0, 0, cryoPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, cryoPulse * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Frost Vapor Breath Mist
    ctx.fillStyle = 'rgba(224, 242, 254, 0.4)';
    for (let f = 0; f < 3; f++) {
      const fDist = size * (0.35 + (f * 0.15));
      const fAngle = Math.PI * 0.5 + Math.sin(game.elapsed * 4 + f) * 0.3;
      ctx.beginPath();
      ctx.arc(Math.cos(fAngle) * fDist, Math.sin(fAngle) * fDist, (8 + f * 5) * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cyan Crystal Eyes
    ctx.fillStyle = isTelegraphing ? '#ef4444' : '#bae6fd';
    ctx.beginPath();
    ctx.ellipse(-size * 0.14, -size * 0.22, 5 * scale, 7 * scale, -0.25, 0, Math.PI * 2);
    ctx.ellipse(size * 0.14, -size * 0.22, 5 * scale, 7 * scale, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawMagmaDragonBoss(
    ctx: CanvasRenderingContext2D,
    game: Simulation,
    boss: BossConfig,
    size: number,
    scale: number,
    isEnraged: boolean,
    isTelegraphing: boolean,
  ) {
    const flap = Math.sin(game.elapsed * (isEnraged ? 11 : 7.5)) * 0.38;
    const breathe = Math.sin(game.elapsed * 4.5) * size * 0.04;

    ctx.save();

    // Fiery Draconic Wings
    ctx.save();
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(0, breathe);
    ctx.quadraticCurveTo(-size * 0.5, -size * 0.6 + flap * 24, -size * 0.85, -size * 0.15);
    ctx.quadraticCurveTo(-size * 0.55, size * 0.25, 0, size * 0.1 + breathe);
    ctx.quadraticCurveTo(size * 0.55, size * 0.25, size * 0.85, -size * 0.15);
    ctx.quadraticCurveTo(size * 0.5, -size * 0.6 - flap * 24, 0, breathe);
    ctx.fill();
    // Ragged flame wing membrane edges
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(-size * 0.55, -size * 0.12 + flap * 16, size * 0.28, size * 0.12, -0.4, 0, Math.PI * 2);
    ctx.ellipse(size * 0.55, -size * 0.12 - flap * 16, size * 0.28, size * 0.12, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Obsidian Dragon Body with glowing fissures
    const magmaGrad = ctx.createRadialGradient(0, breathe, size * 0.1, 0, breathe, size * 0.55);
    magmaGrad.addColorStop(0, '#f97316');
    magmaGrad.addColorStop(0.35, '#b91c1c');
    magmaGrad.addColorStop(0.75, '#292524');
    magmaGrad.addColorStop(1, '#0c0a09');
    ctx.fillStyle = magmaGrad;
    ctx.beginPath();
    ctx.ellipse(0, breathe, size * 0.42, size * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Obsidian Horns
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.moveTo(-size * 0.25, -size * 0.35 + breathe);
    ctx.quadraticCurveTo(-size * 0.55, -size * 0.7, -size * 0.42, -size * 0.9);
    ctx.lineTo(-size * 0.18, -size * 0.45 + breathe);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.25, -size * 0.35 + breathe);
    ctx.quadraticCurveTo(size * 0.55, -size * 0.7, size * 0.42, -size * 0.9);
    ctx.lineTo(size * 0.18, -size * 0.45 + breathe);
    ctx.closePath();
    ctx.fill();

    // Molten Lava Belly Core
    const coreR = size * (0.18 + Math.sin(game.elapsed * 9) * 0.04);
    ctx.save();
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 18 * scale;
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, size * 0.08 + breathe, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Molten Fiery Slit Eyes
    ctx.fillStyle = isTelegraphing ? '#ffffff' : '#fde047';
    ctx.beginPath();
    ctx.ellipse(-size * 0.15, -size * 0.18 + breathe, 4 * scale, 8 * scale, -0.2, 0, Math.PI * 2);
    ctx.ellipse(size * 0.15, -size * 0.18 + breathe, 4 * scale, 8 * scale, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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
    } else if (kind === 'drone') {
      this.drawDrone(ctx, 0, 0);
    } else if (kind === 'golem') {
      this.drawGolem(ctx, 0, 0);
    } else {
      ctx.fillStyle = '#afdbef';
      ctx.beginPath();
      ctx.roundRect(-15, -85, 30, 30, 9);
      ctx.fill();
    }
  }

  private drawDrone(ctx: CanvasRenderingContext2D, elapsed: number, seedX = 0) {
    const hover = Math.sin(elapsed * 4 + seedX * 0.05) * 5;
    const tilt = Math.cos(elapsed * 3 + seedX * 0.05) * 0.08;
    const thrusterFlame = 0.7 + Math.sin(elapsed * 18 + seedX) * 0.3;

    ctx.save();
    ctx.translate(0, -58 + hover);
    ctx.rotate(tilt);

    // Ground searchlight beam
    const groundDist = 58 - hover;
    const beamSweep = Math.sin(elapsed * 2.2 + seedX * 0.1) * 14;
    const searchGrad = ctx.createLinearGradient(0, 0, beamSweep, groundDist);
    searchGrad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
    searchGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.12)');
    searchGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = searchGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(beamSweep - 22, groundDist);
    ctx.lineTo(beamSweep + 22, groundDist);
    ctx.closePath();
    ctx.fill();

    // Ground searchlight projected pool
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.beginPath();
    ctx.ellipse(beamSweep, groundDist, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thruster exhaust flame
    const flameGrad = ctx.createLinearGradient(0, 14, 0, 26 * thrusterFlame);
    flameGrad.addColorStop(0, 'rgba(56, 189, 248, 0.9)');
    flameGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.8)');
    flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-7, 12);
    ctx.lineTo(0, 14 + 12 * thrusterFlame);
    ctx.lineTo(7, 12);
    ctx.closePath();
    ctx.fill();

    // Trailing ion sparks / exhaust particles
    for (let p = 1; p <= 3; p++) {
      const pOffset = ((elapsed * 30 + seedX * 3 + p * 8) % 20);
      const pAlpha = 1 - pOffset / 20;
      const pSpread = Math.sin(elapsed * 10 + p * 2) * 3;
      ctx.fillStyle = `rgba(56, 189, 248, ${pAlpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(pSpread, 16 + pOffset, 2 * pAlpha, 0, Math.PI * 2);
      ctx.fill();
    }

    const droneImg = this.generatedVisuals.get('drone');
    if (droneImg?.complete && droneImg.naturalWidth) {
      ctx.drawImage(droneImg, -28, -28, 56, 56);
    } else {
      // Twin side thrusters/wings
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(-24, -4, 48, 8, 3);
      ctx.fill();
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.arc(-20, 0, 3, 0, Math.PI * 2);
      ctx.arc(20, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      // Drone Chassis / Spherical armored shell
      const shellGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, 18);
      shellGrad.addColorStop(0, '#f8fafc');
      shellGrad.addColorStop(0.6, '#94a3b8');
      shellGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = shellGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Antenna on top
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(0, -23);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -24, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Cyclops glowing red sensor eye
      const eyeGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 8);
      eyeGrad.addColorStop(0, '#ffffff');
      eyeGrad.addColorStop(0.3, '#f87171');
      eyeGrad.addColorStop(0.8, '#dc2626');
      eyeGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = eyeGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Scanning eye glint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(-2, -2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawGolem(ctx: CanvasRenderingContext2D, elapsed: number, seedX = 0) {
    const breathe = Math.sin(elapsed * 2.5 + seedX * 0.05) * 2;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Heavy ground impact seismic shockwave ring
    const shockPhase = (elapsed * 1.5 + seedX * 0.1) % 1;
    const shockRadius = 14 + shockPhase * 28;
    const shockAlpha = (1 - shockPhase) * 0.4;
    ctx.strokeStyle = `rgba(192, 132, 252, ${shockAlpha})`;
    ctx.lineWidth = 2 * (1 - shockPhase);
    ctx.beginPath();
    ctx.ellipse(0, 2, shockRadius, shockRadius * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();

    const torsoY = -38 + breathe * 0.5;
    const golemImg = this.generatedVisuals.get('golem');
    if (golemImg?.complete && golemImg.naturalWidth) {
      ctx.drawImage(golemImg, -34, -68 + breathe * 0.5, 68, 68);
    } else {
      // Massive Stone Legs
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-22, -18, 14, 20, 3);
      ctx.roundRect(8, -18, 14, 20, 3);
      ctx.fill();
      ctx.stroke();

      // Crystal Shards on Ground/Feet
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.moveTo(-18, -4); ctx.lineTo(-14, -14); ctx.lineTo(-10, -4); ctx.closePath();
      ctx.moveTo(10, -4); ctx.lineTo(14, -15); ctx.lineTo(18, -4); ctx.closePath();
      ctx.fill();

      // Heavy Stone Torso
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(-24, torsoY + 22);
      ctx.lineTo(-26, torsoY - 6);
      ctx.lineTo(-18, torsoY - 18);
      ctx.lineTo(18, torsoY - 18);
      ctx.lineTo(26, torsoY - 6);
      ctx.lineTo(24, torsoY + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Runic crack veins branching across the torso
      const runePulse = 0.7 + Math.sin(elapsed * 5 + seedX) * 0.3;
      ctx.strokeStyle = `rgba(216, 180, 254, ${0.35 + runePulse * 0.45})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, torsoY); ctx.lineTo(-15, torsoY - 5); ctx.lineTo(-20, torsoY + 6);
      ctx.moveTo(5, torsoY); ctx.lineTo(15, torsoY - 5); ctx.lineTo(20, torsoY + 6);
      ctx.moveTo(0, torsoY - 7); ctx.lineTo(0, torsoY - 14);
      ctx.stroke();

      // Stone Shoulder Armor Pads
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(-24, torsoY - 8, 8, 11, -0.2, 0, Math.PI * 2);
      ctx.ellipse(24, torsoY - 8, 8, 11, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Glowing Purple/Cosmic Elemental Core Rune
      ctx.save();
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 10 * runePulse;
      ctx.fillStyle = `rgba(192, 132, 252, ${0.7 + runePulse * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(0, torsoY - 8);
      ctx.lineTo(6, torsoY);
      ctx.lineTo(0, torsoY + 8);
      ctx.lineTo(-6, torsoY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Stone Brow & Visor
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-12, torsoY - 16, 24, 7);

      // Twin Glowing Eyes
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 6;
      ctx.fillRect(-8, torsoY - 14, 4, 3);
      ctx.fillRect(4, torsoY - 14, 4, 3);
    }

    // Orbiting Floating Elemental Crystal Shards
    for (let c = 0; c < 3; c++) {
      const orbitAngle = elapsed * 2 + (c * Math.PI * 2) / 3 + seedX;
      const orbitX = Math.cos(orbitAngle) * 32;
      const orbitY = torsoY - 4 + Math.sin(orbitAngle) * 10;
      const shardScale = 0.8 + Math.sin(orbitAngle) * 0.25;
      ctx.save();
      ctx.translate(orbitX, orbitY);
      ctx.rotate(orbitAngle * 0.5);
      ctx.fillStyle = c % 2 === 0 ? '#c084fc' : '#38bdf8';
      ctx.shadowColor = c % 2 === 0 ? '#a855f7' : '#0ea5e9';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, -6 * shardScale);
      ctx.lineTo(3.5 * shardScale, 0);
      ctx.lineTo(0, 6 * shardScale);
      ctx.lineTo(-3.5 * shardScale, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}
