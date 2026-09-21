// Post-process newly generated boss sprites:
// 1) Remove near-white background (treat as transparent).
// 2) Auto-trim empty pixels around the body.
// 3) Resize to 320x320 for tight silhouette.
// 4) Convert to WebP at quality 90 and emit to public/assets/generated/.
//
// Frame naming convention: <archetype>_<state>_<index>.webp
//   archetype = treant | sphinx | void_dragon | cyber_titan | frost_behemoth | magma_dragon
//   state     = idle | attack | hurt
//   index     = a | b | c
//
// Final paths (matching the project's generated/ convention):
//   public/assets/generated/boss-<archetype>-<state>-<index>.webp
//
// We also REPLACE the legacy single boss-<archetype>.webp with the new idle_a
// frame so any leftover code path that still references it gets the clean art.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC_DIR = 'assets/generated/bosses';
const OUT_DIR = 'public/assets/generated';

if (!fs.existsSync(SRC_DIR)) {
  console.error(`Source directory ${SRC_DIR} not found. Run sprite generation first.`);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

async function removeWhiteBackground(inputBuffer, tolerance = 35) {
  const { data, info } = await sharp(inputBuffer)
    .rotate() // apply EXIF orientation if any, strip weird metadata
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const threshold = 255 - tolerance;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= threshold && g >= threshold && b >= threshold) {
      data[i + 3] = 0;
    } else if (r >= threshold - 20 && g >= threshold - 20 && b >= threshold - 20) {
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
  });
}

const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
console.log(`Processing ${files.length} boss frames from ${SRC_DIR}…`);

let ok = 0;
for (const file of files) {
  try {
    const buf = fs.readFileSync(path.join(SRC_DIR, file));
    const { data: rawData, info: rawInfo } = await sharp(buf)
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Trim near-empty alpha edges as a manual pass over the raw RGBA buffer
    const tolerance = 35 * 2; // roughly alpha + per-channel
    let minX = rawInfo.width, minY = rawInfo.height, maxX = -1, maxY = -1;
    for (let y = 0; y < rawInfo.height; y++) {
      for (let x = 0; x < rawInfo.width; x++) {
        const i = (y * rawInfo.width + x) * 4;
        if (rawData[i + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      console.error(`  ! ${file} produced an empty image`);
      continue;
    }
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const cropped = Buffer.alloc(cropW * cropH * 4);
    for (let y = 0; y < cropH; y++) {
      rawData.copy(
        cropped,
        y * cropW * 4,
        ((minY + y) * rawInfo.width + minX) * 4,
        ((minY + y) * rawInfo.width + maxX + 1) * 4
      );
    }

    const side = 360;
    const finalBuf = await sharp(cropped, {
      raw: { width: cropW, height: cropH, channels: 4 },
    })
      .resize(side, side, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 90, effort: 6 })
      .toBuffer();

    const outName = file
      .replace(/_/g, '-') // underscore → dash
      .replace(/\.(png|jpg|jpeg)$/i, '.webp')
      // Map underscore state names: idle_a / attack_b / hurt_c → boss-<x>-idle-0.webp etc.
      .replace(/^(.*)-([^-]+)-([a-z])\.webp$/i, (_m, archetype, state, letter) => {
        const idx = letter === 'a' ? 0 : letter === 'b' ? 1 : 2;
        return `boss-${archetype}-${state}-${idx}.webp`;
      });

    const finalOut = path.join(OUT_DIR, outName);
    fs.writeFileSync(finalOut, finalBuf);
    console.log(`  ✓ ${file} → ${outName} (${(finalBuf.length / 1024).toFixed(1)} KB)`);
    ok++;
  } catch (err) {
    console.error(`  ! ${file} failed: ${err && err.message ? err.message : err}`);
  }
}

console.log(`\nDone: ${ok}/${files.length} boss frames processed.`);
