import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ARTIFACT_DIR = 'C:/Users/hacke/.gemini/antigravity/brain/3d1dfe8b-805d-4d7b-98e2-1d5d79cd8bba';
const PUBLIC_ASSETS = 'public/assets';
const GENERATED_DIR = 'public/assets/generated';

fs.mkdirSync(GENERATED_DIR, { recursive: true });

/**
 * Turns near-white background into transparent alpha.
 */
async function removeWhiteBackground(inputBuffer, tolerance = 35) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const threshold = 255 - tolerance;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      // Near white - set transparent
      data[i + 3] = 0;
    } else if (r >= threshold - 20 && g >= threshold - 20 && b >= threshold - 20) {
      // Soft antialiasing edge
      const maxVal = Math.max(r, g, b);
      const alphaFactor = (255 - maxVal) / (255 - (threshold - 20));
      data[i + 3] = Math.max(0, Math.min(255, Math.round(data[i + 3] * alphaFactor)));
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim({ threshold: 10 })
    .webp({ quality: 90 });
}

async function run() {
  console.log('Processing generated assets...');

  // 1. Process Kuro (Shadow Fox)
  const kuroFile = path.join(ARTIFACT_DIR, 'kuro_fox_runner_1789964986768.jpg');
  if (fs.existsSync(kuroFile)) {
    console.log('Found Kuro source image. Processing sprite frames...');
    const kuroBuf = fs.readFileSync(kuroFile);
    const transparentKuro = await removeWhiteBackground(kuroBuf, 40);
    const kuroCleanBuf = await transparentKuro.toBuffer();

    // Generate avatar
    await sharp(kuroCleanBuf)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(path.join(PUBLIC_ASSETS, 'kuro-avatar.webp'));

    // Generate idle
    await sharp(kuroCleanBuf)
      .resize(220, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(path.join(PUBLIC_ASSETS, 'kuro-idle-0.webp'));

    // Generate 6-frame run cycle by creating subtle kinematic transforms (bob, stride, ear tilt)
    for (let i = 0; i < 6; i++) {
      const bob = Math.sin(i * Math.PI / 3) * 6;
      const stretch = 1 + Math.cos(i * Math.PI / 3) * 0.05;
      const width = Math.round(220 * (2 - stretch));
      const height = Math.round(220 * stretch);

      await sharp(kuroCleanBuf)
        .resize(width, height, { fit: 'fill' })
        .extend({
          top: Math.max(0, Math.round(15 - bob)),
          bottom: Math.max(0, Math.round(15 + bob)),
          left: 15,
          right: 15,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90 })
        .toFile(path.join(PUBLIC_ASSETS, `kuro-run-${i}.webp`));
    }

    // Generate jump ascent and apex
    await sharp(kuroCleanBuf)
      .resize(190, 240, { fit: 'fill' }) // vertical stretch upward
      .extend({ top: 10, bottom: 20, left: 20, right: 20, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(path.join(PUBLIC_ASSETS, 'kuro-jump-0.webp'));

    await sharp(kuroCleanBuf)
      .resize(230, 200, { fit: 'fill' }) // horizontal tuck
      .extend({ top: 25, bottom: 10, left: 15, right: 15, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(path.join(PUBLIC_ASSETS, 'kuro-jump-1.webp'));

    // Generate slide frames (low compressed crouch)
    await sharp(kuroCleanBuf)
      .resize(250, 130, { fit: 'fill' }) // compressed low profile
      .extend({ top: 90, bottom: 10, left: 10, right: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(path.join(PUBLIC_ASSETS, 'kuro-slide-0.webp'));

    await sharp(kuroCleanBuf)
      .resize(240, 145, { fit: 'fill' })
      .extend({ top: 80, bottom: 10, left: 10, right: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 })
      .toFile(path.join(PUBLIC_ASSETS, 'kuro-slide-1.webp'));

    console.log('Kuro character frames generated successfully!');
  }

  // 2. Process Cyber Titan Boss
  const cyberFile = path.join(ARTIFACT_DIR, 'boss_cyber_titan_1789965019801.jpg');
  if (fs.existsSync(cyberFile)) {
    console.log('Found Cyber Titan boss image. Processing...');
    const cyberBuf = fs.readFileSync(cyberFile);
    const transparentCyber = await removeWhiteBackground(cyberBuf, 40);
    await transparentCyber
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.join(GENERATED_DIR, 'boss-cyber-titan.webp'));
    console.log('Cyber Titan boss asset created: boss-cyber-titan.webp');
  }

  // 3. Process Magma Dragon Boss
  const magmaFile = path.join(ARTIFACT_DIR, 'boss_magma_dragon_1789965053198.jpg');
  if (fs.existsSync(magmaFile)) {
    console.log('Found Magma Dragon boss image. Processing...');
    const magmaBuf = fs.readFileSync(magmaFile);
    const transparentMagma = await removeWhiteBackground(magmaBuf, 40);
    await transparentMagma
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.join(GENERATED_DIR, 'boss-magma-dragon.webp'));
    console.log('Magma Dragon boss asset created: boss-magma-dragon.webp');
  }

  // 4. Generate SVG-rendered high fidelity assets for the other bosses, enemies, and scenarios
  console.log('Generating additional boss, enemy, and scenario textures...');
  await generateAdditionalGameArt();

  console.log('All asset generation complete!');
}

async function generateAdditionalGameArt() {
  // Sylvan Treant Titan (Forest Boss)
  const treantSvg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="barkGrad" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#4a3728"/>
        <stop offset="70%" stop-color="#2a1f17"/>
        <stop offset="100%" stop-color="#140d0a"/>
      </radialGradient>
      <radialGradient id="leafGrad" cx="40%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#84cc16"/>
        <stop offset="60%" stop-color="#22c55e"/>
        <stop offset="100%" stop-color="#15803d"/>
      </radialGradient>
      <filter id="greenGlow">
        <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Giant Root Legs -->
    <path d="M160 380 Q140 460 110 500 L210 500 Q200 450 210 380 Z" fill="url(#barkGrad)" stroke="#1a120c" stroke-width="6"/>
    <path d="M310 380 Q320 450 380 500 L290 500 Q270 440 260 380 Z" fill="url(#barkGrad)" stroke="#1a120c" stroke-width="6"/>
    <!-- Massive Elderwood Trunk -->
    <path d="M150 180 Q130 300 160 390 L310 390 Q340 300 320 180 Z" fill="url(#barkGrad)" stroke="#1a120c" stroke-width="8"/>
    <!-- Branching Crown of Foliage -->
    <circle cx="235" cy="130" r="110" fill="url(#leafGrad)"/>
    <circle cx="160" cy="110" r="85" fill="url(#leafGrad)"/>
    <circle cx="310" cy="115" r="90" fill="url(#leafGrad)"/>
    <circle cx="240" cy="65" r="75" fill="#a3e635"/>
    <!-- Wooden Horns / Antlers -->
    <path d="M170 110 Q110 50 80 10 L110 60 Q150 70 170 110 Z" fill="url(#barkGrad)" stroke="#1a120c" stroke-width="4"/>
    <path d="M300 110 Q360 50 390 10 L360 60 Q320 70 300 110 Z" fill="url(#barkGrad)" stroke="#1a120c" stroke-width="4"/>
    <!-- Glowing Runes & Eyes -->
    <ellipse cx="195" cy="200" rx="14" ry="9" fill="#d8f36a" filter="url(#greenGlow)"/>
    <ellipse cx="275" cy="200" rx="14" ry="9" fill="#d8f36a" filter="url(#greenGlow)"/>
    <!-- Ancient Wooden Beard / Roots -->
    <path d="M210 240 Q235 340 220 370 Q240 330 250 240 Z" fill="#362518"/>
    <path d="M230 250 Q255 360 250 380 Q265 320 270 250 Z" fill="#2a1c12"/>
    <!-- Rune Core -->
    <polygon points="235,270 255,300 235,330 215,300" fill="#a3e635" filter="url(#greenGlow)"/>
  </svg>`;
  await sharp(Buffer.from(treantSvg)).webp({ quality: 90 }).toFile(path.join(GENERATED_DIR, 'boss-treant.webp'));

  // Void Dragon (Night Boss)
  const voidSvg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="voidGrad" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stop-color="#4c1d95"/>
        <stop offset="60%" stop-color="#1e1035"/>
        <stop offset="100%" stop-color="#0b0416"/>
      </radialGradient>
      <filter id="purpleGlow">
        <feGaussianBlur stdDeviation="10" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Starlight Nebulae Wings -->
    <path d="M220 220 Q120 40 20 100 Q100 240 180 260 Z" fill="#7c3aed" opacity="0.85"/>
    <path d="M260 220 Q360 20 480 70 Q410 230 300 250 Z" fill="#9333ea" opacity="0.9"/>
    <!-- Serpentine Shadow Body -->
    <path d="M120 450 Q180 350 250 360 Q330 370 380 430 Q330 470 250 440 Q170 410 120 450 Z" fill="url(#voidGrad)" stroke="#c084fc" stroke-width="3"/>
    <path d="M240 370 Q280 270 260 170 Q230 110 170 120 Q140 160 190 220 Q230 270 220 370 Z" fill="url(#voidGrad)" stroke="#a855f7" stroke-width="4"/>
    <!-- Dragon Head & Horns -->
    <path d="M170 120 Q110 130 90 90 Q140 80 170 120 Z" fill="#581c87"/>
    <path d="M160 100 Q170 30 210 10 Q190 60 180 90 Z" fill="#c084fc" filter="url(#purpleGlow)"/>
    <path d="M140 95 Q130 20 100 15 Q120 60 135 90 Z" fill="#a855f7"/>
    <!-- Cosmic Eyes -->
    <ellipse cx="125" cy="95" rx="8" ry="4" fill="#38bdf8" filter="url(#purpleGlow)"/>
    <!-- Floating Celestial Orbs -->
    <circle cx="80" cy="180" r="12" fill="#38bdf8" filter="url(#purpleGlow)"/>
    <circle cx="430" cy="160" r="15" fill="#f43f5e" filter="url(#purpleGlow)"/>
    <circle cx="280" cy="70" r="10" fill="#facc15" filter="url(#purpleGlow)"/>
  </svg>`;
  await sharp(Buffer.from(voidSvg)).webp({ quality: 90 }).toFile(path.join(GENERATED_DIR, 'boss-void-dragon.webp'));

  // Glacial Frost Behemoth (Alpine Boss)
  const frostSvg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="iceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e0f2fe"/>
        <stop offset="50%" stop-color="#7dd3fc"/>
        <stop offset="100%" stop-color="#0369a1"/>
      </linearGradient>
      <filter id="iceGlow">
        <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Spiked Ice Legs -->
    <polygon points="120,380 90,490 190,490 170,380" fill="url(#iceGrad)" stroke="#0c4a6e" stroke-width="6"/>
    <polygon points="290,380 310,490 410,490 350,380" fill="url(#iceGrad)" stroke="#0c4a6e" stroke-width="6"/>
    <!-- Armored Frozen Torso -->
    <polygon points="130,220 90,380 390,380 350,220 240,180" fill="url(#iceGrad)" stroke="#0c4a6e" stroke-width="8"/>
    <!-- Glacial Spikes on Shoulders -->
    <polygon points="100,240 20,160 130,200" fill="#bae6fd" stroke="#0284c7" stroke-width="4" filter="url(#iceGlow)"/>
    <polygon points="370,240 470,150 340,200" fill="#bae6fd" stroke="#0284c7" stroke-width="4" filter="url(#iceGlow)"/>
    <!-- Beast Head & Ice Horns -->
    <polygon points="180,180 240,110 300,180 240,240" fill="#f0f9ff" stroke="#0369a1" stroke-width="6"/>
    <polygon points="180,130 110,40 200,90" fill="#7dd3fc" filter="url(#iceGlow)"/>
    <polygon points="300,130 380,30 280,90" fill="#7dd3fc" filter="url(#iceGlow)"/>
    <!-- Glowing Cyan Eyes -->
    <ellipse cx="210" cy="165" rx="10" ry="6" fill="#06b6d4" filter="url(#iceGlow)"/>
    <ellipse cx="270" cy="165" rx="10" ry="6" fill="#06b6d4" filter="url(#iceGlow)"/>
  </svg>`;
  await sharp(Buffer.from(frostSvg)).webp({ quality: 90 }).toFile(path.join(GENERATED_DIR, 'boss-frost-behemoth.webp'));

  // Golden Sun Sphinx (Sunset Boss)
  const sphinxSvg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="40%" stop-color="#eab308"/>
        <stop offset="100%" stop-color="#854d0e"/>
      </linearGradient>
      <filter id="goldGlow">
        <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Golden Lion Paws -->
    <path d="M140 370 Q130 460 110 490 L210 490 Q200 440 200 370 Z" fill="url(#goldGrad)" stroke="#713f12" stroke-width="6"/>
    <path d="M300 370 Q300 440 340 490 L420 490 Q390 440 370 370 Z" fill="url(#goldGrad)" stroke="#713f12" stroke-width="6"/>
    <!-- Majestic Golden Wings -->
    <path d="M190 230 Q70 60 20 120 Q80 270 180 270 Z" fill="#fde047" stroke="#ca8a04" stroke-width="4" opacity="0.9"/>
    <path d="M290 230 Q410 40 480 90 Q430 260 300 270 Z" fill="#fde047" stroke="#ca8a04" stroke-width="4" opacity="0.9"/>
    <!-- Lion Sphinx Body -->
    <path d="M160 210 Q140 340 170 380 L320 380 Q350 330 320 210 Z" fill="url(#goldGrad)" stroke="#713f12" stroke-width="7"/>
    <!-- Solar Nemes Headdress / Crown -->
    <path d="M180 180 L140 250 L200 250 L200 200 Z" fill="#0284c7"/>
    <path d="M300 180 L340 250 L280 250 L280 200 Z" fill="#0284c7"/>
    <circle cx="240" cy="170" r="60" fill="url(#goldGrad)" stroke="#713f12" stroke-width="6"/>
    <!-- Sun Crest Disk -->
    <circle cx="240" cy="85" r="35" fill="#f97316" filter="url(#goldGlow)"/>
    <!-- Solar Eyes -->
    <ellipse cx="218" cy="165" rx="8" ry="5" fill="#f8fafc" stroke="#b45309" stroke-width="2"/>
    <ellipse cx="262" cy="165" rx="8" ry="5" fill="#f8fafc" stroke="#b45309" stroke-width="2"/>
  </svg>`;
  await sharp(Buffer.from(sphinxSvg)).webp({ quality: 90 }).toFile(path.join(GENERATED_DIR, 'boss-sphinx.webp'));

  // Cyber Scout Drone Enemy
  const droneSvg = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="droneGlow">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Twin Rotors -->
    <ellipse cx="60" cy="80" rx="45" ry="8" fill="#38bdf8" opacity="0.6"/>
    <ellipse cx="196" cy="80" rx="45" ry="8" fill="#38bdf8" opacity="0.6"/>
    <!-- Drone Chassis -->
    <path d="M80 90 L176 90 L195 140 L128 175 L61 140 Z" fill="#1e293b" stroke="#0ea5e9" stroke-width="5"/>
    <rect x="110" y="70" width="36" height="20" rx="6" fill="#334155" stroke="#38bdf8" stroke-width="3"/>
    <!-- Central Red Sensor Eye -->
    <circle cx="128" cy="130" r="18" fill="#ef4444" filter="url(#droneGlow)"/>
    <circle cx="128" cy="130" r="8" fill="#ffffff"/>
    <!-- Wing Pods -->
    <rect x="40" y="85" width="40" height="15" rx="4" fill="#475569"/>
    <rect x="176" y="85" width="40" height="15" rx="4" fill="#475569"/>
  </svg>`;
  await sharp(Buffer.from(droneSvg)).webp({ quality: 90 }).toFile(path.join(GENERATED_DIR, 'enemy-drone.webp'));

  // Forest Stone Golem Enemy
  const golemSvg = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="golemGlow">
        <feGaussianBlur stdDeviation="5" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Stone Body -->
    <rect x="70" y="80" width="116" height="110" rx="20" fill="#475569" stroke="#1e293b" stroke-width="6"/>
    <!-- Moss Patch -->
    <path d="M75 85 Q110 80 120 105 Q145 90 180 85 L180 110 Q130 115 75 110 Z" fill="#65a30d"/>
    <!-- Stone Fists -->
    <circle cx="45" cy="150" r="30" fill="#334155" stroke="#1e293b" stroke-width="5"/>
    <circle cx="211" cy="150" r="30" fill="#334155" stroke="#1e293b" stroke-width="5"/>
    <!-- Glowing Runes & Eyes -->
    <rect x="95" y="115" width="22" height="10" rx="3" fill="#fbbf24" filter="url(#golemGlow)"/>
    <rect x="139" y="115" width="22" height="10" rx="3" fill="#fbbf24" filter="url(#golemGlow)"/>
    <!-- Stone Feet -->
    <rect x="75" y="185" width="40" height="35" rx="8" fill="#334155"/>
    <rect x="141" y="185" width="40" height="35" rx="8" fill="#334155"/>
  </svg>`;
  await sharp(Buffer.from(golemSvg)).webp({ quality: 90 }).toFile(path.join(GENERATED_DIR, 'enemy-golem.webp'));

  // Magma Fiend Enemy
  const magmaFiendSvg = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="fireGlow">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Molten Body -->
    <ellipse cx="128" cy="140" rx="55" ry="45" fill="#1c1917" stroke="#ea580c" stroke-width="5"/>
    <!-- Glowing Magma Veins -->
    <path d="M100 130 Q128 155 156 130" stroke="#f97316" stroke-width="6" fill="none" filter="url(#fireGlow)"/>
    <path d="M110 155 Q128 170 146 155" stroke="#facc15" stroke-width="4" fill="none" filter="url(#fireGlow)"/>
    <!-- Fire Crest / Horns -->
    <polygon points="90,105 70,50 110,85" fill="#ef4444" filter="url(#fireGlow)"/>
    <polygon points="166,105 186,50 146,85" fill="#ef4444" filter="url(#fireGlow)"/>
    <!-- Blazing Eyes -->
    <ellipse cx="105" cy="120" rx="10" ry="7" fill="#fef08a" filter="url(#fireGlow)"/>
    <ellipse cx="151" cy="120" rx="10" ry="7" fill="#fef08a" filter="url(#fireGlow)"/>
  </svg>`;
  await sharp(Buffer.from(magmaFiendSvg)).webp({ quality: 90 }).toFile(path.join(GENERATED_DIR, 'enemy-magma-fiend.webp'));

  // Parallax Scenarios:
  // Neon Cybercity Skyline Layer
  const neonSkySvg = `
  <svg width="1024" height="512" viewBox="0 0 1024 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="neonSky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f0728"/>
        <stop offset="60%" stop-color="#281152"/>
        <stop offset="100%" stop-color="#090317"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="512" fill="url(#neonSky)"/>
    <!-- Cyber Towers -->
    <rect x="40" y="160" width="90" height="352" fill="#1b0c36" stroke="#ec4899" stroke-width="2"/>
    <rect x="160" y="90" width="110" height="422" fill="#14082b" stroke="#06b6d4" stroke-width="2"/>
    <rect x="300" y="190" width="85" height="322" fill="#1b0c36" stroke="#8b5cf6" stroke-width="2"/>
    <rect x="420" y="120" width="130" height="392" fill="#100524" stroke="#ec4899" stroke-width="2"/>
    <rect x="580" y="210" width="95" height="302" fill="#1b0c36" stroke="#06b6d4" stroke-width="2"/>
    <rect x="710" y="70" width="120" height="442" fill="#14082b" stroke="#8b5cf6" stroke-width="2"/>
    <rect x="860" y="170" width="110" height="342" fill="#1b0c36" stroke="#06b6d4" stroke-width="2"/>
    <!-- Spire Antennas with Glowing Beacons -->
    <line x1="215" y1="20" x2="215" y2="90" stroke="#06b6d4" stroke-width="3"/>
    <circle cx="215" cy="20" r="6" fill="#06b6d4"/>
    <line x1="770" y1="10" x2="770" y2="70" stroke="#ec4899" stroke-width="3"/>
    <circle cx="770" cy="10" r="6" fill="#ec4899"/>
  </svg>`;
  await sharp(Buffer.from(neonSkySvg)).webp({ quality: 85 }).toFile(path.join(GENERATED_DIR, 'scenario-neon-city.webp'));

  // Volcano Magma Cavern Layer
  const volcanoSvg = `
  <svg width="1024" height="512" viewBox="0 0 1024 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="magmaSky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1f0907"/>
        <stop offset="60%" stop-color="#4a150e"/>
        <stop offset="100%" stop-color="#7c220f"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="512" fill="url(#magmaSky)"/>
    <!-- Jagged Basalt Mountains -->
    <polygon points="0,512 80,240 220,512" fill="#1c0907"/>
    <polygon points="170,512 310,180 480,512" fill="#2b0e0a"/>
    <polygon points="420,512 560,210 700,512" fill="#1a0806"/>
    <polygon points="650,512 790,160 930,512" fill="#2a0d09"/>
    <polygon points="880,512 980,220 1024,512" fill="#1c0907"/>
    <!-- Lava Rivers and Fissures -->
    <path d="M0 460 Q300 440 500 470 T1024 455 L1024 512 L0 512 Z" fill="#ea580c"/>
    <path d="M0 480 Q250 465 520 485 T1024 475 L1024 512 L0 512 Z" fill="#facc15"/>
  </svg>`;
  await sharp(Buffer.from(volcanoSvg)).webp({ quality: 85 }).toFile(path.join(GENERATED_DIR, 'scenario-volcano-cavern.webp'));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
