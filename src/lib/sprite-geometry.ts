import type { Character } from './types';
export const PLAYER_HEIGHT = 58;
export const PLAYER_SLIDE_HEIGHT = 32;
export const PLAYER_HALF_WIDTH = 24;

export function playerVisualHeight(sliding: boolean): number {
  return sliding ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT;
}

export function proportionalSpriteHeight(
  activeBoundsHeight: number,
  standingBoundsHeight: number,
): number {
  if (
    !Number.isFinite(activeBoundsHeight) ||
    !Number.isFinite(standingBoundsHeight) ||
    activeBoundsHeight <= 0 ||
    standingBoundsHeight <= 0
  )
    return PLAYER_HEIGHT;
  return PLAYER_HEIGHT * (activeBoundsHeight / standingBoundsHeight);
}

export interface SpriteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Heuristic: a pixel looks like a baked-in shadow when it is opaque,
 * has very low chroma (gray-ish), and sits in a mid/dark luminance range.
 * This catches the soft contact ovals that ship embedded in many
 * sprite sheets (e.g. `pili-idle-0.webp`, `pili-run-*.webp`) without
 * throwing away saturated character pixels like eyes or scarves.
 */
export function isShadowPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 128) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lum = (r + g + b) / 3;
  return chroma <= 18 && lum >= 55 && lum <= 215;
}

/** True when the pixel is part of the character art (not shadow, not transparent). */
export function isCharacterPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 128) return false;
  return !isShadowPixel(r, g, b, a);
}

/** Bounds ignoring transparent padding and faint contact shadows. */
export function alphaBounds(data: ArrayLike<number>, width: number, height: number): SpriteBounds {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] < 128) continue;
      if (isShadowPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  return right < 0
    ? { x: 0, y: 0, width, height }
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

const boundsCache = new WeakMap<HTMLImageElement, SpriteBounds>();
export function measureSprite(image: HTMLImageElement): SpriteBounds {
  const cached = boundsCache.get(image);
  if (cached) return cached;
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
    return { x: 0, y: 0, width: Math.max(1, image.width || 64), height: Math.max(1, image.height || 64) };
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let bounds = { x: 0, y: 0, width: canvas.width, height: canvas.height };
  try {
    ctx.drawImage(image, 0, 0);
    bounds = alphaBounds(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    );
  } catch {
    /* An unreadable image retains its original bounds. */
  }
  if (bounds.width > 0 && bounds.height > 0) {
    boundsCache.set(image, bounds);
  }
  return bounds;
}

/** Source baseline is optional for artwork with opaque, baked-in shadows. */
export function drawGroundedSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  height: number,
  baseline?: number,
  options: { hideShadow?: boolean } = {},
) {
  const b = measureSprite(image);
  const naturalH = image.naturalHeight || image.height || 64;
  const feet =
    baseline === undefined
      ? b.y + b.height
      : Math.max(b.y + 1, Math.min(naturalH, baseline * naturalH));
  const diff = Math.max(1, feet - b.y);
  const scale = height / diff;
  if (!Number.isFinite(scale) || scale <= 0) return;

  if (!options.hideShadow) {
    ctx.drawImage(
      image,
      -(b.x + b.width / 2) * scale,
      -feet * scale,
      image.naturalWidth * scale,
      image.naturalHeight * scale,
    );
    return;
  }

  // Mask baked-in shadow pixels in-place so the preview shows a clean
  // character silhouette without the soft oval that ships in many sprites.
  const off = document.createElement('canvas');
  off.width = image.naturalWidth;
  off.height = image.naturalHeight;
  const offCtx = off.getContext('2d', { willReadFrequently: true })!;
  offCtx.drawImage(image, 0, 0);
  let imgData: ImageData;
  try {
    imgData = offCtx.getImageData(0, 0, off.width, off.height);
  } catch {
    // Cross-origin or unreadable — fall back to unaltered draw.
    ctx.drawImage(
      image,
      -(b.x + b.width / 2) * scale,
      -feet * scale,
      image.naturalWidth * scale,
      image.naturalHeight * scale,
    );
    return;
  }
  const data = imgData.data;
  let touched = false;
  for (let i = 0; i < data.length; i += 4) {
    if (isShadowPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
      data[i + 3] = 0;
      touched = true;
    }
  }
  if (touched) offCtx.putImageData(imgData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    off,
    -(b.x + b.width / 2) * scale,
    -feet * scale,
    off.width * scale,
    off.height * scale,
  );
}

export function pixelBounds(pixels: string[]): SpriteBounds {
  const data = new Uint8Array(16 * 16 * 4);
  pixels.forEach((color, i) => {
    if (color !== 'transparent') data[i * 4 + 3] = 255;
  });
  return alphaBounds(data, 16, 16);
}

export function frameScale(character: Character, movement: keyof NonNullable<Character['frames']>, index: number): number {
  const value = character.frameScales?.[movement]?.[index] ?? 1;
  return Number.isFinite(value) ? Math.max(0.25, Math.min(3, value)) : 1;
}
