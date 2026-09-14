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

/** Ignore transparent padding and faint contact shadows when locating the feet. */
export function alphaBounds(data: ArrayLike<number>, width: number, height: number): SpriteBounds {
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 128) continue;
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
  boundsCache.set(image, bounds);
  return bounds;
}

/** Source baseline is optional for artwork with opaque, baked-in shadows. */
export function drawGroundedSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  height: number,
  baseline?: number,
) {
  const b = measureSprite(image);
  const feet =
    baseline === undefined
      ? b.y + b.height
      : Math.max(b.y + 1, Math.min(image.naturalHeight, baseline * image.naturalHeight));
  const scale = height / (feet - b.y);
  ctx.drawImage(
    image,
    -(b.x + b.width / 2) * scale,
    -feet * scale,
    image.naturalWidth * scale,
    image.naturalHeight * scale,
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
