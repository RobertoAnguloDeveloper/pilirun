'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Eraser,
  FileCode,
  Image as ImageIcon,
  Layers,
  Paintbrush,
  PaintBucket,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  Copy,
  X,
  Pipette,
  Scissors,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  Brush,
  Crosshair,
  Sliders,
  Camera,
  Layers as LayersIcon,
  MousePointer,
  HelpCircle,
  Grid,
  Zap,
  Play,
  Pause,
} from 'lucide-react';
import { AnimationEditor, type Movement } from './animation-editor';
import { Avatar } from './art';
import type { Character } from '@/lib/types';

export const COLOR_PALETTES: { name: string; colors: string[] }[] = [
  {
    name: 'Tierra & Bosque',
    colors: ['#ec9565', '#d47b4e', '#fff3d7', '#243b32', '#315c49', '#82b79b', '#b8a5d0', '#f18c73', '#f3d67d', '#759bbd', '#4a7298'],
  },
  {
    name: 'Neón & Fantasía',
    colors: ['#d8f36a', '#00f0ff', '#ff007f', '#a855f7', '#facc15', '#fb923c', '#4ade80', '#38bdf8', '#818cf8', '#f43f5e', '#10b981'],
  },
  {
    name: 'Pieles, Pelajes & Sombras',
    colors: ['#ffe0bd', '#ffd1a4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3818', '#3a230f', '#2a1a0a', '#ffb6c1', '#c08081'],
  },
  {
    name: 'Monocromo & Metales',
    colors: ['#000000', '#1c2524', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f8fafc', '#ffffff', '#ffd700', '#c0c0c0'],
  },
];

const COLORS = Array.from(new Set(COLOR_PALETTES.flatMap((p) => p.colors)));
const BUILTIN_CHARACTER_IDS = new Set(['pili', 'menta', 'luna']);

// Presets from the project's assets folder (/assets/1.png and /assets/2.png)
const ASSET_PRESETS = [
  {
    name: 'Pili Animado (Assets)',
    src: '/assets/character-sprite-1.webp',
    fallbackSrc: '/assets/2.png',
    icon: '🦊',
    frames: {
      run: [
        '/assets/pili-run-0.webp',
        '/assets/pili-run-1.webp',
        '/assets/pili-run-2.webp',
        '/assets/pili-run-3.webp',
        '/assets/pili-run-4.webp',
        '/assets/pili-run-5.webp',
      ],
      jump: [
        '/assets/pili-jump-0.webp',
        '/assets/pili-jump-1.webp',
      ],
      slide: [
        '/assets/pili-slide-0.webp',
        '/assets/pili-slide-1.webp',
      ],
      idle: [
        '/assets/pili-idle-0.webp',
      ],
    },
  },
  {
    name: 'Paladín Sprite 2',
    src: '/assets/character-sprite-2.webp',
    fallbackSrc: '/assets/2.png',
    icon: '🛡️',
  },
];

// Curated starter sprite archetypes
const SPRITE_TEMPLATES: { name: string; icon: string; pixels: string[] }[] = [
  {
    name: 'Zorro Pili',
    icon: '🦊',
    pixels: createTemplatePixels([
      '................',
      '...o......o.....',
      '...oo....oo.....',
      '...okoooo ko.....',
      '...oooooooo.....',
      '...oofoof oo.....',
      '...oofoof oo.....',
      '....offffo......',
      '....gggggg......',
      '..oooooooooo....',
      '.oooooooooooo...',
      '.ffoooooooooo...',
      '..ffooooooo.....',
      '....oo..oo......',
      '....kk..kk......',
      '................',
    ], { o: '#ec9565', k: '#243b32', f: '#fff3d7', g: '#315c49' }),
  },
  {
    name: 'Ciber Robot',
    icon: '🤖',
    pixels: createTemplatePixels([
      '................',
      '......cc........',
      '....cccccc......',
      '...cclllcc......',
      '...cck..kcc.....',
      '...cccllccc.....',
      '....cccccc......',
      '......oo........',
      '...cccccccc.....',
      '..cccccccccc....',
      '..ccoolloocc....',
      '..cccccccccc....',
      '...cccccccc.....',
      '....cc..cc......',
      '....kk..kk......',
      '................',
    ], { c: '#759bbd', l: '#ffffff', k: '#1c2524', o: '#ec9565' }),
  },
  {
    name: 'Conejo Lunar',
    icon: '🐰',
    pixels: createTemplatePixels([
      '................',
      '..pp....pp......',
      '..pp....pp......',
      '..pp....pp......',
      '..pp....pp......',
      '..pppppppp......',
      '..ppk..kpp......',
      '..pppppppp......',
      '...pppppp.......',
      '..pppppppp......',
      '.pppppppppp.....',
      '.pppppppppp.....',
      '..pppppppp......',
      '..pp....pp......',
      '..pp....pp......',
      '................',
    ], { p: '#b8a5d0', k: '#243b32' }),
  },
];

function createTemplatePixels(rows: string[], colors: Record<string, string>): string[] {
  const pixels = Array<string>(256).fill('transparent');
  rows.forEach((row, y) =>
    row
      .replace(/ /g, '.')
      .slice(0, 16)
      .split('')
      .forEach((c, x) => {
        if (colors[c]) pixels[y * 16 + x] = colors[c];
      }),
  );
  return pixels;
}

function defaultPixels() {
  return SPRITE_TEMPLATES[0].pixels;
}

/**
 * Quantize an RGB color to the closest game palette color
 */
function findClosestPaletteColor(r: number, g: number, b: number): string {
  let minDiff = Infinity;
  let closest = COLORS[0];
  for (const hex of COLORS) {
    const cr = parseInt(hex.slice(1, 3), 16);
    const cg = parseInt(hex.slice(3, 5), 16);
    const cb = parseInt(hex.slice(5, 7), 16);
    const diff = Math.hypot(r - cr, g - cg, b - cb);
    if (diff < minDiff) {
      minDiff = diff;
      closest = hex;
    }
  }
  return closest;
}

/**
 * Freehand character isolation algorithm:
 * In freehand drawing mode, the black brush (#000000 or near-black) defines the character's outer boundary/outline.
 * Any strokes or artifacts outside the shapes enclosed by the black outline are cleared/masked out.
 */
function isolateBlackOutlineContour(canvas: HTMLCanvasElement): string {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas.toDataURL('image/png');

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Identify black outline pixels (r < 50, g < 50, b < 50, a > 180)
  const isBlackBarrier = (x: number, y: number): boolean => {
    const idx = (y * w + x) * 4;
    const a = data[idx + 3];
    if (a < 180) return false;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r < 55 && g < 55 && b < 55;
  };

  // Check if there is any black outline drawn at all
  let hasBlackOutline = false;
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    if (data[idx + 3] >= 180 && data[idx] < 55 && data[idx + 1] < 55 && data[idx + 2] < 55) {
      hasBlackOutline = true;
      break;
    }
  }

  // If no black outline was drawn, return as-is
  if (!hasBlackOutline) {
    return canvas.toDataURL('image/png');
  }

  // Flood fill from all 4 borders inward. Any pixel reached without crossing a black barrier is OUTSIDE the character
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  // Seed with all border coordinates that are not black barriers
  for (let x = 0; x < w; x++) {
    const topIdx = 0 * w + x;
    if (!isBlackBarrier(x, 0)) {
      visited[topIdx] = 1;
      queue.push(topIdx);
    }
    const bottomIdx = (h - 1) * w + x;
    if (!isBlackBarrier(x, h - 1)) {
      visited[bottomIdx] = 1;
      queue.push(bottomIdx);
    }
  }

  for (let y = 0; y < h; y++) {
    const leftIdx = y * w + 0;
    if (!visited[leftIdx] && !isBlackBarrier(0, y)) {
      visited[leftIdx] = 1;
      queue.push(leftIdx);
    }
    const rightIdx = y * w + (w - 1);
    if (!visited[rightIdx] && !isBlackBarrier(w - 1, y)) {
      visited[rightIdx] = 1;
      queue.push(rightIdx);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = Math.floor(curr / w);

    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < w - 1 ? curr + 1 : -1,
      cy > 0 ? curr - w : -1,
      cy < h - 1 ? curr + w : -1,
    ];

    for (const n of neighbors) {
      if (n === -1 || visited[n]) continue;
      const nx = n % w;
      const ny = Math.floor(n / w);
      if (!isBlackBarrier(nx, ny)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  // Check if flood fill reaches the entire canvas or if a protected closed interior exists
  let reachedCount = 0;
  for (let i = 0; i < w * h; i++) {
    if (visited[i]) reachedCount++;
  }

  // If flood-fill reached practically the whole canvas (unclosed loop or open strokes),
  // DO NOT destructively erase the user's drawing!
  // Only isolate if there is an actual enclosed non-barrier region.
  const totalPixels = w * h;
  if (reachedCount > totalPixels * 0.985) {
    return canvas.toDataURL('image/png');
  }

  // Clear every pixel that was reached by the exterior flood fill
  for (let i = 0; i < w * h; i++) {
    if (visited[i]) {
      data[i * 4 + 3] = 0; // Transparent (outside the enclosed shape)
    }
  }

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = w;
  resultCanvas.height = h;
  const rCtx = resultCanvas.getContext('2d')!;
  rCtx.putImageData(imgData, 0, 0);
  return resultCanvas.toDataURL('image/png');
}

/**
 * 4-Way BFS Flood Fill for 16x16 Pixel Art Grid
 */
function floodFillPixel(
  pixels: string[],
  startX: number,
  startY: number,
  fillColor: string,
): string[] {
  if (startX < 0 || startX >= 16 || startY < 0 || startY >= 16) return pixels;
  const targetColor = pixels[startY * 16 + startX];
  if (targetColor === fillColor) return pixels;

  const nextPixels = [...pixels];
  const queue: [number, number][] = [[startX, startY]];
  const visited = new Uint8Array(256);
  visited[startY * 16 + startX] = 1;

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    const idx = cy * 16 + cx;
    nextPixels[idx] = fillColor;

    const neighbors: [number, number][] = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < 16 && ny >= 0 && ny < 16) {
        const nIdx = ny * 16 + nx;
        if (!visited[nIdx] && nextPixels[nIdx] === targetColor) {
          visited[nIdx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  return nextPixels;
}

/**
 * Fast Scanline / Queue Flood Fill for Freehand HTML5 Canvas (320x320)
 */
function floodFillFreehand(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
  tolerance = 32,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const startIdx = (startY * w + startX) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];
  const startA = data[startIdx + 3];

  // Parse fill color
  let fillR = 0, fillG = 0, fillB = 0, fillA = 255;
  if (fillColor === 'transparent') {
    fillA = 0;
  } else if (fillColor.startsWith('#')) {
    const hex = fillColor.replace('#', '');
    if (hex.length === 3) {
      fillR = parseInt(hex[0] + hex[0], 16);
      fillG = parseInt(hex[1] + hex[1], 16);
      fillB = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      fillR = parseInt(hex.slice(0, 2), 16);
      fillG = parseInt(hex.slice(2, 4), 16);
      fillB = parseInt(hex.slice(4, 6), 16);
    }
  }

  // If start color already matches fill color within threshold, do nothing
  const initialDiff = Math.hypot(startR - fillR, startG - fillG, startB - fillB) + Math.abs(startA - fillA);
  if (initialDiff < 8 && ((startA === 0 && fillA === 0) || (startA > 0 && fillA > 0))) {
    return;
  }

  const matchTarget = (idx: number): boolean => {
    const a = data[idx + 3];
    if (startA < 20 && a < 20) return true;
    if (Math.abs(a - startA) > 40) return false;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    return Math.hypot(r - startR, g - startG, b - startB) <= tolerance;
  };

  const visited = new Uint8Array(w * h);
  const queue: number[] = [startY * w + startX];
  visited[startY * w + startX] = 1;

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = Math.floor(curr / w);
    const pixelIdx = curr * 4;

    data[pixelIdx] = fillR;
    data[pixelIdx + 1] = fillG;
    data[pixelIdx + 2] = fillB;
    data[pixelIdx + 3] = fillA;

    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < w - 1 ? curr + 1 : -1,
      cy > 0 ? curr - w : -1,
      cy < h - 1 ? curr + w : -1,
    ];

    for (const n of neighbors) {
      if (n !== -1 && !visited[n] && matchTarget(n * 4)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Rotate a 16x16 pixel array by 90 degrees.
 * clockwise = true rotates 90° clockwise; false rotates 90° counter-clockwise.
 */
export function rotatePixels90(pxs: string[], clockwise = true): string[] {
  const result = Array<string>(256).fill('transparent');
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const srcIdx = r * 16 + c;
      const val = pxs[srcIdx] ?? 'transparent';
      const destR = clockwise ? c : 15 - c;
      const destC = clockwise ? 15 - r : r;
      result[destR * 16 + destC] = val;
    }
  }
  return result;
}

/**
 * Flip a 16x16 pixel array horizontally (mirror along vertical axis).
 */
export function flipPixelsH(pxs: string[]): string[] {
  const result = Array<string>(256).fill('transparent');
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      result[r * 16 + (15 - c)] = pxs[r * 16 + c] ?? 'transparent';
    }
  }
  return result;
}

/**
 * Flip a 16x16 pixel array vertically (mirror along horizontal axis).
 */
export function flipPixelsV(pxs: string[]): string[] {
  const result = Array<string>(256).fill('transparent');
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      result[(15 - r) * 16 + c] = pxs[r * 16 + c] ?? 'transparent';
    }
  }
  return result;
}

/**
 * Transform an image data URL with rotation (degrees) or flip horizontally/vertically.
 */
export async function transformImageDataUrl(
  dataUrl: string,
  options: { degrees?: number; flipH?: boolean; flipV?: boolean }
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const degrees = (options.degrees ?? 0) % 360;
      const rads = (degrees * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(rads));
      const absSin = Math.abs(Math.sin(rads));
      const newW = Math.max(1, Math.round(w * absCos + h * absSin));
      const newH = Math.max(1, Math.round(w * absSin + h * absCos));

      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.save();
      ctx.translate(newW / 2, newH / 2);
      if (options.flipH || options.flipV) {
        ctx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
      }
      if (degrees !== 0) {
        ctx.rotate(rads);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Convert RGB components to 6-digit hex string #rrggbb.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}



/**
 * Extracts a specific rectangular region of an image, cleaning background while preserving
 * character contours and contact ground shadow.
 */
function extractCellFrame(
  fullCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  cornerRGB: { r: number; g: number; b: number },
): string {
  // Step 1: Draw into intermediate canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  if (!tempCtx) return '';
  tempCtx.drawImage(fullCanvas, x, y, w, h, 0, 0, w, h);

  const imgData = tempCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Background vs foreground & shadow distinction
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let hasOpaque = false;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = (py * w + px) * 4;
      const a = data[idx + 3];
      if (a < 20) {
        data[idx + 3] = 0;
        continue;
      }
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const diff = Math.hypot(r - cornerRGB.r, g - cornerRGB.g, b - cornerRGB.b);
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const lum = (r + g + b) / 3;

      // Only strip flat corner/checkerboard backgrounds; preserve dark/semi-transparent contact shadows
      if (diff < 26 && chroma < 14 && lum > 115 && lum < 235) {
        data[idx + 3] = 0;
      } else {
        hasOpaque = true;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }
  tempCtx.putImageData(imgData, 0, 0);

  // If no content found, fallback
  if (!hasOpaque || minX > maxX || minY > maxY) {
    minX = 0; maxX = w - 1; minY = 0; maxY = h - 1;
  }

  // Step 2: Render into square cellCanvas with feet anchored at bottom
  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const size = Math.max(contentW, contentH);
  const cellCanvas = document.createElement('canvas');
  cellCanvas.width = size;
  cellCanvas.height = size;
  const ctx = cellCanvas.getContext('2d');
  if (!ctx) return '';
  ctx.clearRect(0, 0, size, size);

  // Center horizontally, flush to bottom vertically
  const destX = Math.floor((size - contentW) / 2);
  const destY = size - contentH;
  ctx.drawImage(tempCanvas, minX, minY, contentW, contentH, destX, destY, contentW, contentH);

  return cellCanvas.toDataURL('image/png');
}

/**
 * Automatically analyze an image or sprite sheet, extract individual character frames
 * for all movement actions (run, jump, slide, idle), and generate:
 * 1. An animated Character.frames set (all frames preserved)
 * 2. A clean 16x16 pixel art array from the primary idle/run frame
 * 3. A crisp primary image Data URL
 */
function processImageToSpriteSheet(img: HTMLImageElement): {
  pixels: string[];
  croppedDataUrl: string;
  frames?: Character['frames'];
} {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = srcW;
  fullCanvas.height = srcH;
  const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
  if (!fullCtx) {
    return { pixels: defaultPixels(), croppedDataUrl: '' };
  }
  fullCtx.drawImage(img, 0, 0);
  const imgData = fullCtx.getImageData(0, 0, srcW, srcH);
  const d = imgData.data;

  const cornerR = (d[0] + d[(srcW - 1) * 4]) / 2;
  const cornerG = (d[1] + d[(srcW - 1) * 4 + 1]) / 2;
  const cornerB = (d[2] + d[(srcW - 1) * 4 + 2]) / 2;
  const cornerRGB = { r: cornerR, g: cornerG, b: cornerB };

  // Helper to determine whether pixel is character/shadow foreground
  const isFg = (x: number, y: number): boolean => {
    const idx = (y * srcW + x) * 4;
    const a = d[idx + 3];
    if (a < 25) return false;
    const r = d[idx], g = d[idx + 1], b = d[idx + 2];
    const diff = Math.hypot(r - cornerR, g - cornerG, b - cornerB);
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const lum = (r + g + b) / 3;
    if (diff < 26 && chroma < 14 && lum > 115 && lum < 235) {
      return false;
    }
    return true;
  };

  const frames: {
    run: string[];
    jump: string[];
    slide: string[];
    idle: string[];
  } = { run: [], jump: [], slide: [], idle: [] };

  const extractedList: string[] = [];

  // Strategy A: Grid-based extraction (e.g. 6 columns x 2 rows, or 4x4, or 3x1 banner)
  const isBanner2x6 = Math.abs(srcW / srcH - 3.0) < 0.35 || (srcW >= 600 && srcH >= 200 && srcW > srcH * 2.2);
  const isSquare4x4 = Math.abs(srcW / srcH - 1.0) < 0.15 && srcW >= 512;

  if (isBanner2x6) {
    const cols = 6;
    const rows = 2;
    const cellW = srcW / cols;
    const cellH = srcH / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.round(c * cellW);
        const y = Math.round(r * cellH);
        const w = Math.round(cellW);
        const h = Math.round(cellH);
        const url = extractCellFrame(fullCanvas, x, y, w, h, cornerRGB);
        if (url) extractedList.push(url);
      }
    }

    // Map 12 cells in strict sequential order:
    // Row 1: 0-1: idle, 2-5: run 1-4
    // Row 2: 6-7: run 5-6, 8-9: jump, 10-11: slide/crouch
    if (extractedList.length >= 12) {
      frames.idle = [extractedList[0], extractedList[1]];
      frames.run = [
        extractedList[2],
        extractedList[3],
        extractedList[4],
        extractedList[5],
        extractedList[6],
        extractedList[7],
      ];
      frames.jump = [extractedList[8], extractedList[9]];
      frames.slide = [extractedList[10], extractedList[11]];
    }
  } else if (isSquare4x4) {
    const cols = 4;
    const rows = 4;
    const cellW = srcW / cols;
    const cellH = srcH / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.round(c * cellW);
        const y = Math.round(r * cellH);
        const url = extractCellFrame(fullCanvas, x, y, Math.round(cellW), Math.round(cellH), cornerRGB);
        if (url) extractedList.push(url);
      }
    }
    if (extractedList.length >= 12) {
      frames.idle = [extractedList[0]];
      frames.run = extractedList.slice(1, 7);
      frames.jump = extractedList.slice(7, 9);
      frames.slide = extractedList.slice(9, 11);
    }
  } else if (srcW > 250) {
    // Strategy B: Column and Row projections to find clusters
    const colCounts = new Array(srcW).fill(0);
    const stepY = Math.max(1, Math.floor(srcH / 200));
    for (let x = 0; x < srcW; x++) {
      for (let y = 0; y < srcH; y += stepY) {
        if (isFg(x, y)) colCounts[x]++;
      }
    }

    const colClusters: { x: number; w: number }[] = [];
    let inCol = false;
    let startCol = 0;
    for (let x = 0; x < srcW; x++) {
      if (colCounts[x] > 12 && !inCol) {
        inCol = true;
        startCol = x;
      } else if (colCounts[x] <= 12 && inCol) {
        inCol = false;
        if (x - startCol > 35) colClusters.push({ x: startCol, w: x - startCol });
      }
    }
    if (inCol && srcW - startCol > 35) {
      colClusters.push({ x: startCol, w: srcW - startCol });
    }

    for (const cluster of colClusters) {
      const url = extractCellFrame(fullCanvas, cluster.x, 0, cluster.w, srcH, cornerRGB);
      if (url) extractedList.push(url);
    }

    if (extractedList.length > 1) {
      frames.idle = [extractedList[0]];
      frames.run = extractedList.slice(0, Math.min(extractedList.length, 6));
      frames.jump = [extractedList[Math.min(extractedList.length - 1, 1)]];
      frames.slide = [extractedList[Math.min(extractedList.length - 1, 2)]];
    }
  }

  // Choose primary representative frame for idle/avatar/pixels
  const primaryUrl = frames.idle[0] ?? extractedList[0] ?? fullCanvas.toDataURL('image/png');

  // Generate 16x16 pixel representation from primary frame
  const pixelImg = new Image();
  pixelImg.src = primaryUrl;
  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width = 16;
  pixelCanvas.height = 16;
  const pCtx = pixelCanvas.getContext('2d', { willReadFrequently: true });
  const sampled: string[] = [];

  if (pCtx) {
    pCtx.drawImage(fullCanvas, 0, 0, srcW, srcH, 0, 0, 16, 16);
    const pData = pCtx.getImageData(0, 0, 16, 16).data;
    for (let i = 0; i < 256; i++) {
      const idx = i * 4;
      const r = pData[idx];
      const g = pData[idx + 1];
      const b = pData[idx + 2];
      const a = pData[idx + 3];

      if (a < 50) {
        sampled.push('transparent');
      } else {
        sampled.push(findClosestPaletteColor(r, g, b));
      }
    }
  }

  return {
    pixels: sampled.length === 256 ? sampled : defaultPixels(),
    croppedDataUrl: primaryUrl,
    frames: extractedList.length > 1 ? frames : undefined,
  };
}

export function CharacterEditor({
  characters,
  selected,
  onSelect,
  onSave,
  onDelete,
}: {
  characters: Character[];
  selected: string;
  onSelect: (id: string) => void;
  onSave: (c: Character) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Character>({
    id: '',
    name: 'Mi explorador',
    color: COLORS[0],
    pixels: defaultPixels(),
  });
  const [color, setColor] = useState(COLORS[0]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [mode, setMode] = useState<'pixel' | 'auto_sprite' | 'photo'>('pixel');
  const [drawType, setDrawType] = useState<'pixel' | 'freehand'>('pixel');
  const [activeTool, setActiveTool] = useState<'brush' | 'fill' | 'pipette'>('brush');
  const [brushSize, setBrushSize] = useState(8);
  const [paletteTab, setPaletteTab] = useState(0);
  const [spriteMovement, setSpriteMovement] = useState<Movement>('run');
  const [activeFrameIdx, setActiveFrameIdx] = useState<number>(0);

  // Free transformation state
  const [freeRotation, setFreeRotation] = useState<number>(0);

  // Sidebar live preview animation controls
  const [previewPlaying, setPreviewPlaying] = useState<boolean>(true);
  const [previewMovement, setPreviewMovement] = useState<Movement>('run');

  // Photo editing state
  const [photo, setPhoto] = useState<File>(),
    [uneditedPhotoUrl, setUneditedPhotoUrl] = useState<string>(''),
    [zoom, setZoom] = useState(1),
    [cropX, setCropX] = useState(0.5),
    [cropY, setCropY] = useState(0.5),
    [photoRotation, setPhotoRotation] = useState<number>(0),
    [processing, setProcessing] = useState(false);
  const [photoTool, setPhotoTool] = useState<'wand' | 'eraser' | 'restore' | 'pipette'>('wand');
  const [wandTolerance, setWandTolerance] = useState(32);
  const [eraserRadius, setEraserRadius] = useState(16);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const ref = useRef<HTMLCanvasElement>(null),
    freehandRef = useRef<HTMLCanvasElement>(null),
    photoCanvasRef = useRef<HTMLCanvasElement>(null),
    originalPhotoImg = useRef<HTMLImageElement | null>(null),
    photoDrawing = useRef(false),
    photoDragStart = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null),
    freehandDrawing = useRef(false),
    freehandUndo = useRef<ImageData[]>([]),
    drawing = useRef(false),
    undo = useRef<string[][]>([]),
    pixels = useRef(editing.pixels!),
    baseSpriteRef = useRef<string | null>(null),
    colorInputRef = useRef<HTMLInputElement>(null),
    colorPickerActive = useRef(false),
    lastColorPickerCloseTime = useRef(0),
    imageWorker = useRef<Worker | null>(null),
    requestId = useRef(0);

  // Helper to convert 16x16 pixels array to a crisp PNG Data URL
  const pixelsToDataUrl = (pxs: string[]): string => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    ctx.clearRect(0, 0, 16, 16);
    pxs.forEach((col, i) => {
      if (col !== 'transparent') {
        ctx.fillStyle = col;
        ctx.fillRect(i % 16, Math.floor(i / 16), 1, 1);
      }
    });
    return c.toDataURL('image/png');
  };

  // Switch to or edit a specific frame in the active movement
  const selectSpriteFrame = (idx: number, mov: Movement = spriteMovement) => {
    baseSpriteRef.current = null;
    setFreeRotation(0);
    const movFrames = editing.frames?.[mov] ?? [];
    setActiveFrameIdx(idx);
    const targetUrl = movFrames[idx];
    if (targetUrl) {
      if (drawType === 'pixel') {
        const img = new Image();
        img.onload = () => {
          const cvs = document.createElement('canvas');
          cvs.width = 16;
          cvs.height = 16;
          const ctx = cvs.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 16, 16);
            const pData = ctx.getImageData(0, 0, 16, 16).data;
            const newPxs: string[] = [];
            for (let i = 0; i < 256; i++) {
              const a = pData[i * 4 + 3];
              if (a < 50) newPxs.push('transparent');
              else newPxs.push(findClosestPaletteColor(pData[i * 4], pData[i * 4 + 1], pData[i * 4 + 2]));
            }
            pixels.current = newPxs;
            setEditing((c) => ({ ...c, pixels: newPxs, image: targetUrl }));
          }
        };
        img.src = targetUrl;
      } else {
        setEditing((c) => ({ ...c, image: targetUrl }));
        if (freehandRef.current) {
          const img = new Image();
          img.onload = () => {
            const ctx = freehandRef.current?.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, 320, 320);
              ctx.drawImage(img, 0, 0, 320, 320);
            }
          };
          img.src = targetUrl;
        }
      }
    }
  };

  // Add a new blank frame or duplicate frame to the current movement
  const addSpriteFrame = (duplicate: boolean = false) => {
    baseSpriteRef.current = null;
    setFreeRotation(0);
    const movFrames = [...(editing.frames?.[spriteMovement] ?? [])];
    let newFrameUrl = '';
    if (duplicate && movFrames[activeFrameIdx]) {
      newFrameUrl = movFrames[activeFrameIdx];
    } else if (drawType === 'pixel') {
      newFrameUrl = pixelsToDataUrl(pixels.current);
    } else if (freehandRef.current) {
      newFrameUrl = freehandRef.current.toDataURL('image/png');
    }
    if (!newFrameUrl) {
      newFrameUrl = pixelsToDataUrl(defaultPixels());
    }
    const updated = [...movFrames, newFrameUrl];
    const newIdx = updated.length - 1;
    const nextFrames = { ...(editing.frames ?? {}), [spriteMovement]: updated };
    setEditing((c) => ({ ...c, frames: nextFrames }));
    setActiveFrameIdx(newIdx);
    setMessage(`Sprite añadido a ${spriteMovement} (fotograma #${newIdx + 1}). Disponible en el Generador SVG/PNG.`);
  };

  // Remove a sprite frame from the current movement
  const deleteSpriteFrame = (idx: number) => {
    baseSpriteRef.current = null;
    setFreeRotation(0);
    const movFrames = [...(editing.frames?.[spriteMovement] ?? [])];
    if (movFrames.length <= 1) {
      setMessage('El movimiento debe conservar al menos un fotograma.');
      return;
    }
    movFrames.splice(idx, 1);
    const nextFrames = { ...(editing.frames ?? {}), [spriteMovement]: movFrames };
    setEditing((c) => ({ ...c, frames: nextFrames }));
    const nextIdx = Math.max(0, Math.min(idx, movFrames.length - 1));
    setActiveFrameIdx(nextIdx);
    selectSpriteFrame(nextIdx, spriteMovement);
  };


  // Clear Canvas handler with undo
  const clearCanvas = () => {
    baseSpriteRef.current = null;
    setFreeRotation(0);
    if (drawType === 'pixel') {
      undo.current = [...undo.current.slice(-19), [...pixels.current]];
      const empty = Array<string>(256).fill('transparent');
      pixels.current = empty;
      setEditing((c) => ({ ...c, pixels: empty }));
    } else {
      const fCanvas = freehandRef.current;
      if (fCanvas) {
        const ctx = fCanvas.getContext('2d')!;
        freehandUndo.current = [...freehandUndo.current.slice(-19), ctx.getImageData(0, 0, fCanvas.width, fCanvas.height)];
        ctx.clearRect(0, 0, fCanvas.width, fCanvas.height);
        const dataUrl = isolateBlackOutlineContour(fCanvas);
        setEditing((c) => ({ ...c, image: dataUrl }));
      }
    }
  };

  // Automatically load character into editor when 'selected' prop changes
  useEffect(() => {
    if (selected) {
      const match = characters.find((c) => c.id === selected);
      if (match && match.id !== editing.id) {
        baseSpriteRef.current = null;
        setEditing(match);
        setMode(match.image || match.frames ? 'auto_sprite' : 'pixel');
        setPhoto(undefined);
        undo.current = [];
        setFreeRotation(0);
      }
    }
  }, [selected, characters]);

  // Transform current sprite: rotate 90 degrees clockwise or counter-clockwise
  const handleRotate90 = (clockwise = true) => {
    baseSpriteRef.current = null;
    setFreeRotation(0);
    if (drawType === 'pixel') {
      undo.current = [...undo.current.slice(-19), [...pixels.current]];
      const rotated = rotatePixels90(pixels.current, clockwise);
      pixels.current = rotated;
      const url = pixelsToDataUrl(rotated);
      setEditing((prev) => {
        const curFrames = prev.frames?.[spriteMovement] ? [...prev.frames[spriteMovement]] : [];
        if (curFrames.length > 0) {
          curFrames[Math.min(activeFrameIdx, curFrames.length - 1)] = url;
        }
        return {
          ...prev,
          pixels: rotated,
          image: url,
          frames: curFrames.length > 0 ? { ...prev.frames, [spriteMovement]: curFrames } : prev.frames,
        };
      });
      setMessage(clockwise ? 'Giro de 90° horario aplicado.' : 'Giro de 90° antihorario aplicado.');
    } else if (freehandRef.current) {
      const canvas = freehandRef.current;
      const ctx = canvas.getContext('2d')!;
      freehandUndo.current = [...freehandUndo.current.slice(-19), ctx.getImageData(0, 0, 320, 320)];
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 320;
      tempCanvas.height = 320;
      tempCanvas.getContext('2d')!.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, 320, 320);
      ctx.save();
      ctx.translate(160, 160);
      ctx.rotate((clockwise ? 90 : -90) * (Math.PI / 180));
      ctx.drawImage(tempCanvas, -160, -160);
      ctx.restore();

      const isolated = isolateBlackOutlineContour(canvas);
      setEditing((prev) => ({ ...prev, image: isolated }));
      setMessage(clockwise ? 'Giro de 90° horario aplicado.' : 'Giro de 90° antihorario aplicado.');
    } else if (editing.image) {
      void transformImageDataUrl(editing.image, { degrees: clockwise ? 90 : -90 }).then((newUrl) => {
        setEditing((prev) => ({ ...prev, image: newUrl }));
        setMessage('Giro aplicado a la imagen.');
      });
    }
  };

  // Transform current sprite: Flip Horizontal
  const handleFlipHorizontal = () => {
    baseSpriteRef.current = null;
    setFreeRotation(0);
    if (drawType === 'pixel') {
      undo.current = [...undo.current.slice(-19), [...pixels.current]];
      const flipped = flipPixelsH(pixels.current);
      pixels.current = flipped;
      const url = pixelsToDataUrl(flipped);
      setEditing((prev) => {
        const curFrames = prev.frames?.[spriteMovement] ? [...prev.frames[spriteMovement]] : [];
        if (curFrames.length > 0) {
          curFrames[Math.min(activeFrameIdx, curFrames.length - 1)] = url;
        }
        return {
          ...prev,
          pixels: flipped,
          image: url,
          frames: curFrames.length > 0 ? { ...prev.frames, [spriteMovement]: curFrames } : prev.frames,
        };
      });
      setMessage('Espejo horizontal aplicado.');
    } else if (freehandRef.current) {
      const canvas = freehandRef.current;
      const ctx = canvas.getContext('2d')!;
      freehandUndo.current = [...freehandUndo.current.slice(-19), ctx.getImageData(0, 0, 320, 320)];
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 320;
      tempCanvas.height = 320;
      tempCanvas.getContext('2d')!.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, 320, 320);
      ctx.save();
      ctx.translate(320, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();

      const isolated = isolateBlackOutlineContour(canvas);
      setEditing((prev) => ({ ...prev, image: isolated }));
      setMessage('Espejo horizontal aplicado.');
    } else if (editing.image) {
      void transformImageDataUrl(editing.image, { flipH: true }).then((newUrl) => {
        setEditing((prev) => ({ ...prev, image: newUrl }));
        setMessage('Espejo horizontal aplicado.');
      });
    }
  };

  // Transform current sprite: Flip Vertical
  const handleFlipVertical = () => {
    baseSpriteRef.current = null;
    setFreeRotation(0);
    if (drawType === 'pixel') {
      undo.current = [...undo.current.slice(-19), [...pixels.current]];
      const flipped = flipPixelsV(pixels.current);
      pixels.current = flipped;
      const url = pixelsToDataUrl(flipped);
      setEditing((prev) => {
        const curFrames = prev.frames?.[spriteMovement] ? [...prev.frames[spriteMovement]] : [];
        if (curFrames.length > 0) {
          curFrames[Math.min(activeFrameIdx, curFrames.length - 1)] = url;
        }
        return {
          ...prev,
          pixels: flipped,
          image: url,
          frames: curFrames.length > 0 ? { ...prev.frames, [spriteMovement]: curFrames } : prev.frames,
        };
      });
      setMessage('Espejo vertical aplicado.');
    } else if (freehandRef.current) {
      const canvas = freehandRef.current;
      const ctx = canvas.getContext('2d')!;
      freehandUndo.current = [...freehandUndo.current.slice(-19), ctx.getImageData(0, 0, 320, 320)];
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 320;
      tempCanvas.height = 320;
      tempCanvas.getContext('2d')!.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, 320, 320);
      ctx.save();
      ctx.translate(0, 320);
      ctx.scale(1, -1);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();

      const isolated = isolateBlackOutlineContour(canvas);
      setEditing((prev) => ({ ...prev, image: isolated }));
      setMessage('Espejo vertical aplicado.');
    } else if (editing.image) {
      void transformImageDataUrl(editing.image, { flipV: true }).then((newUrl) => {
        setEditing((prev) => ({ ...prev, image: newUrl }));
        setMessage('Espejo vertical aplicado.');
      });
    }
  };

  // Transform current sprite: Free rotation by angle (e.g. from slider)
  const handleFreeRotateCanvas = (degrees: number) => {
    setFreeRotation(degrees);
    if (degrees === 0) {
      if (baseSpriteRef.current) {
        setEditing((prev) => ({ ...prev, image: baseSpriteRef.current! }));
      } else if (drawType === 'pixel') {
        const resetUrl = pixelsToDataUrl(pixels.current);
        setEditing((prev) => ({ ...prev, image: resetUrl }));
      }
      setMessage('Rotación restablecida a 0°.');
      return;
    }

    const currentSource = baseSpriteRef.current || editing.image || (drawType === 'pixel' ? pixelsToDataUrl(pixels.current) : '');
    if (!baseSpriteRef.current && currentSource) {
      baseSpriteRef.current = currentSource;
    }

    if (currentSource) {
      void transformImageDataUrl(currentSource, { degrees }).then((newUrl) => {
        setEditing((prev) => ({ ...prev, image: newUrl }));
        setMessage(`Rotación libre de ${degrees}° aplicada.`);
      });
    }
  };

  // Eyedropper API invocation with graceful fallback
  const triggerNativeEyeDropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const EyeDropperClass = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
        const eyeDropper = new EyeDropperClass();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          setColor(result.sRGBHex);
          setActiveTool('brush');
          setMessage(`Color tomado: ${result.sRGBHex}`);
        }
      } catch {
        // User aborted or EyeDropper closed without picking - harmless
        setMessage('Cuentagotas cancelado.');
      }
    } else {
      setActiveTool('pipette');
      setMessage('Haz clic en cualquier punto del lienzo para tomar su color.');
    }
  };

  // Sync freehand canvas when switching or loading image
  useEffect(() => {
    if (drawType === 'freehand' && freehandRef.current) {
      const ctx = freehandRef.current.getContext('2d')!;
      if (!editing.image) {
        ctx.clearRect(0, 0, 320, 320);
      }
    }
  }, [drawType, editing.image]);

  useEffect(() => {
    pixels.current = editing.pixels ?? defaultPixels();
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 320, 320);
    pixels.current.forEach((c, i) => {
      ctx.fillStyle =
        c === 'transparent' ? ((Math.floor(i / 16) + (i % 16)) % 2 ? '#e5e9df' : '#f4f5ee') : c;
      ctx.fillRect((i % 16) * 20, Math.floor(i / 16) * 20, 20, 20);
    });
    ctx.strokeStyle = '#274c3f12';
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 20, 0);
      ctx.lineTo(i * 20, 320);
      ctx.moveTo(0, i * 20);
      ctx.lineTo(320, i * 20);
      ctx.stroke();
    }
  }, [editing.pixels, mode]);

  useEffect(() => {
    imageWorker.current = new Worker('/workers/image.worker.js', { type: 'module' });
    imageWorker.current.onmessage = async (
      event: MessageEvent<{ id: number; blob?: Blob; error?: string }>,
    ) => {
      if (event.data.id !== requestId.current) return;
      if (event.data.error) {
        setMessage(event.data.error);
        setProcessing(false);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (event.data.id === requestId.current) {
          const res = String(reader.result);
          setEditing((c) => ({ ...c, image: res }));
          setUneditedPhotoUrl(res);
          const orig = new Image();
          orig.onload = () => {
            originalPhotoImg.current = orig;
          };
          orig.src = res;
          setProcessing(false);
        }
      };
      reader.readAsDataURL(event.data.blob!);
    };
    imageWorker.current.onerror = () => {
      // Fallback for browsers without full OffscreenCanvas / Worker createImageBitmap support
      if (photo) {
        const reader = new FileReader();
        reader.onload = () => {
          const res = String(reader.result);
          setEditing((c) => ({ ...c, image: res }));
          setUneditedPhotoUrl(res);
          const orig = new Image();
          orig.onload = () => {
            originalPhotoImg.current = orig;
          };
          orig.src = res;
          setProcessing(false);
        };
        reader.readAsDataURL(photo);
      } else {
        setMessage('Este navegador no pudo procesar la foto.');
        setProcessing(false);
      }
    };
    return () => imageWorker.current?.terminate();
  }, [photo]);

  useEffect(() => {
    const id = ++requestId.current;
    if (!photo) {
      setProcessing(false);
      return;
    }
    setProcessing(true);
    // Also synchronously read initial dataUrl so image tools appear immediately
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      setEditing((c) => ({ ...c, image: res }));
      setUneditedPhotoUrl((prev) => prev || res);
      if (!originalPhotoImg.current) {
        const orig = new Image();
        orig.onload = () => {
          originalPhotoImg.current = orig;
        };
        orig.src = res;
      }
    };
    reader.readAsDataURL(photo);

    const timer = setTimeout(
      () => imageWorker.current?.postMessage({ id, file: photo, zoom, x: cropX, y: cropY }),
      120,
    );
    return () => clearTimeout(timer);
  }, [photo, zoom, cropX, cropY]);

  // Sync photoCanvas when editing.image is generated or changed
  useEffect(() => {
    if (mode === 'photo' && editing.image) {
      const img = new Image();
      img.onload = () => {
        if (!originalPhotoImg.current) {
          originalPhotoImg.current = img;
        }
        const canvas = photoCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, 260, 260);
          ctx.drawImage(img, 0, 0, 260, 260);
        }
      };
      img.src = editing.image;
    }
  }, [mode, editing.image]);

  // SVG / PNG Sprite Auto-Generation Handler
  const handleAutoSpriteUpload = (file: File) => {
    if (!['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'].includes(file.type)) {
      setMessage('Sube un archivo de imagen en formato PNG, SVG o JPG.');
      return;
    }

    baseSpriteRef.current = null;
    setFreeRotation(0);
    setProcessing(true);
    setMessage('Analizando hoja de sprites y extrayendo animaciones (carrera, saltos, agachado)…');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        try {
          const { pixels: generatedPixels, croppedDataUrl, frames: extractedFrames } = processImageToSpriteSheet(img);
          setEditing((prev) => ({
            ...prev,
            image: croppedDataUrl || dataUrl,
            pixels: generatedPixels,
            frames: extractedFrames,
          }));
          pixels.current = generatedPixels;
          setProcessing(false);
          setMessage('¡Sprites extraídos con éxito! Ciclos de carrera, salto y agachado listos.');
        } catch {
          setEditing((prev) => ({
            ...prev,
            image: dataUrl,
          }));
          setProcessing(false);
          setMessage('Imagen cargada.');
        }
      };
      img.onerror = () => {
        setMessage('Error al leer el archivo de imagen.');
        setProcessing(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * 16);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * 16);
    if (x < 0 || x >= 16 || y < 0 || y >= 16) return;

    let updated: string[];
    if (activeTool === 'pipette') {
      const pickedColor = pixels.current[y * 16 + x];
      if (pickedColor && pickedColor !== 'transparent') {
        setColor(pickedColor);
        setActiveTool('brush');
        setMessage(`Color seleccionado del píxel: ${pickedColor}`);
      }
      return;
    } else if (activeTool === 'fill') {
      updated = floodFillPixel(pixels.current, x, y, color);
    } else {
      updated = [...pixels.current];
      updated[y * 16 + x] = color;
    }
    pixels.current = updated;
    const frameUrl = pixelsToDataUrl(updated);
    setEditing((c) => {
      const curFrames = c.frames?.[spriteMovement] ? [...c.frames[spriteMovement]] : [];
      if (curFrames.length > 0) {
        const safeIdx = Math.min(activeFrameIdx, curFrames.length - 1);
        curFrames[safeIdx] = frameUrl;
      }
      return {
        ...c,
        pixels: updated,
        image: frameUrl,
        frames: curFrames.length > 0 ? { ...c.frames, [spriteMovement]: curFrames } : c.frames,
      };
    });
  };

  const applyFloodFillFreehand = (clientX: number, clientY: number) => {
    const canvas = freehandRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * 320);
    const y = Math.floor(((clientY - rect.top) / rect.height) * 320);
    if (x < 0 || x >= 320 || y < 0 || y >= 320) return;

    if (activeTool === 'pipette') {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      if (pixel[3] > 10) {
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        setColor(hex);
        setActiveTool('brush');
        setMessage(`Color tomado del lienzo: ${hex}`);
      }
      return;
    }

    freehandUndo.current = [...freehandUndo.current.slice(-19), ctx.getImageData(0, 0, 320, 320)];
    floodFillFreehand(ctx, x, y, color);

    const isolated = isolateBlackOutlineContour(canvas);
    setEditing((prev) => ({
      ...prev,
      image: isolated,
    }));
  };

  const save = async () => {
    if (!editing.name.trim()) {
      setMessage('Dale un nombre a tu personaje.');
      return;
    }
    if (mode === 'photo' && !editing.image) {
      setMessage('Elige una foto primero.');
      return;
    }
    const hasPixels = pixels.current.some((p) => p !== 'transparent');
    const hasImage = Boolean(editing.image);
    if (mode === 'pixel' && !hasPixels && !hasImage) {
      setMessage('Dibuja al menos un trazo o un píxel en tu personaje.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      // If in freehand mode, ensure canvas contour is freshly captured
      let finalImage = editing.image;
      if (mode === 'pixel' && drawType === 'freehand' && freehandRef.current) {
        finalImage = isolateBlackOutlineContour(freehandRef.current);
      }

      const character: Character = {
        ...editing,
        id: editing.id || crypto.randomUUID(),
        name: editing.name.trim(),
        scale: editing.scale ?? 1.0,
        pixels: hasPixels ? pixels.current : undefined,
        image: finalImage || undefined,
        frames: editing.frames,
      };
      await onSave(character);
      setEditing(character);
      setMessage('Tu personaje está listo para correr en la aventura.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  const saveMovement = async (movement: Movement) => {
    if (!editing.name.trim()) { setMessage('Dale un nombre a tu personaje.'); return; }
    setBusy(true);
    try {
      const existing = characters.find((c) => c.id === editing.id);
      const frameBaselines = { ...existing?.frameBaselines };
      for (const source of editing.frames?.[movement] ?? []) {
        if (editing.frameBaselines?.[source] === undefined) delete frameBaselines[source];
        else frameBaselines[source] = editing.frameBaselines[source];
      }
      const character: Character = {
        ...(existing ?? editing),
        id: editing.id || crypto.randomUUID(), name: editing.name.trim(),
        frames: { ...(existing?.frames ?? editing.frames), [movement]: editing.frames?.[movement] },
        frameBaselines,
        frameScales: { ...(existing?.frameScales ?? editing.frameScales), [movement]: editing.frameScales?.[movement] },
      };
      await onSave(character);
      setEditing((current) => ({ ...current, id: character.id }));
      setMessage('Animación guardada. Los otros movimientos conservan su secuencia.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo guardar la animación.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="section-heading" style={{ flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">CREACIÓN DE SPRITES Y PERSONAJES</p>
          <h1>Tu taller de exploradores.</h1>
          <p>Dibuja en pixel art, elige una plantilla o sube un SVG/PNG para generar tu sprite.</p>
        </div>

        {/* Live Character Size Adjuster for the Active Character */}
        {(() => {
          const activeChar = characters.find((c) => c.id === selected) || characters[0];
          const currentScale = activeChar?.scale ?? 1.0;
          return (
            <div
              className="panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 18px',
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                width: '100%',
                maxWidth: '340px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}>
                  Tamaño de {activeChar?.name ?? 'Personaje'}
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--lime)' }}>
                  {Math.round(currentScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.2"
                step="0.05"
                value={currentScale}
                aria-label={`Tamaño de ${activeChar?.name ?? 'personaje'}`}
                onChange={(e) => {
                  const newScale = Number(e.target.value);
                  if (activeChar) {
                    void onSave({ ...activeChar, scale: newScale });
                    if (editing.id === activeChar.id) {
                      setEditing((prev) => ({ ...prev, scale: newScale }));
                    }
                  }
                }}
                style={{ cursor: 'pointer', accentColor: 'var(--lime)' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--subtle)' }}>
                Se aplica inmediatamente en la vista previa y en la carrera.
              </span>
            </div>
          );
        })()}
      </div>

      <div className="character-list">
        {characters.map((c) => (
          <article className={`character-card ${selected === c.id ? 'selected' : ''}`} key={c.id}>
            <button
              onClick={() => {
                onSelect(c.id);
                baseSpriteRef.current = null;
                setEditing(c);
                setMode(c.image || c.frames ? 'auto_sprite' : 'pixel');
                setPhoto(undefined);
                undo.current = [];
                setFreeRotation(0);
                setMessage(`Cargado ${c.name} en el editor y seleccionado para tu equipo.`);
              }}
              aria-pressed={selected === c.id}
            >
              <Avatar character={c} />
              <strong>{c.name}</strong>
              <small>
                {selected === c.id ? (
                  <>
                    <Check size={13} /> En tu equipo
                  </>
                ) : (
                  'Elegir y editar'
                )}
              </small>
            </button>
            <div className="card-actions">
              <button
                aria-label={`Editar ${c.name}`}
                title="Cargar en el editor"
                onClick={() => {
                  baseSpriteRef.current = null;
                  setEditing(c);
                  setMode(c.image || c.frames ? 'auto_sprite' : 'pixel');
                  setPhoto(undefined);
                  undo.current = [];
                  setFreeRotation(0);
                  setMessage(`Editando ${c.name}.`);
                }}
              >
                <Paintbrush size={15} />
              </button>
              {!BUILTIN_CHARACTER_IDS.has(c.id) && (
                <button
                  aria-label={`Eliminar ${c.name}`}
                  onClick={() => void onDelete(c.id).catch((e) => setMessage(String(e)))}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </article>
        ))}
        <button
          className="new-character"
          onClick={() => {
            baseSpriteRef.current = null;
            setEditing({
              id: '',
              name: 'Mi explorador',
              color: COLORS[0],
              pixels: defaultPixels(),
            });
            setMode('pixel');
            setPhoto(undefined);
            setMessage('Nuevo personaje: dale vida.');
            undo.current = [];
            setFreeRotation(0);
          }}
        >
          <Plus size={26} />
          <strong>Nueva aventura</strong>
          <span>Crea o importa un personaje</span>
        </button>
      </div>

      {/* Guided Sprite Assistant Banner */}
      <div className="sprite-guide-banner">
        <div className="guide-header">
          <Sparkles size={20} className="guide-sparkle" />
          <div style={{ flex: 1 }}>
            <strong>Guía de creación y sprites de /assets</strong>
            <p>Elige una plantilla lista para usar, prueba los sprites oficiales de <code>/assets</code> o sube tu PNG/SVG para vectorizarlo y extraerlo automáticamente.</p>
          </div>
          <button
            type="button"
            className="template-pill-btn"
            style={{ borderColor: 'var(--lime)', color: 'var(--lime)', background: 'rgba(216, 243, 106, 0.15)', whiteSpace: 'nowrap' }}
            onClick={() => setShowPrompt(true)}
            title="Ver prompt del sistema para generar Sprite Sheets con IA"
          >
            <FileCode size={15} /> Prompt de Sprite Sheet IA
          </button>
        </div>
        <div className="guide-templates">
          {ASSET_PRESETS.map((preset) => (
            <button
              key={preset.name}
              className="template-pill-btn asset-preset-btn"
              onClick={() => {
                baseSpriteRef.current = null;
                setFreeRotation(0);
                setProcessing(true);
                setMessage(`Cargando sprite de ${preset.name}…`);
                const img = new Image();
                img.onload = () => {
                  try {
                    const { pixels: generatedPixels, croppedDataUrl, frames } = processImageToSpriteSheet(img);
                    setEditing((prev) => ({
                      ...prev,
                      name: preset.name,
                      image: croppedDataUrl || preset.src,
                      pixels: generatedPixels,
                      frames: (preset as { frames?: Character['frames'] }).frames || frames,
                    }));
                    pixels.current = generatedPixels;
                    setMessage(`¡${preset.name} cargado con éxito! Sprite aislado y avatar listos.`);
                  } catch {
                    setEditing((prev) => ({
                      ...prev,
                      name: preset.name,
                      image: preset.src,
                      frames: (preset as { frames?: Character['frames'] }).frames,
                    }));
                    setMessage(`Cargado ${preset.name}.`);
                  } finally {
                    setProcessing(false);
                  }
                };
                img.onerror = () => {
                  setEditing((prev) => ({
                    ...prev,
                    name: preset.name,
                    image: preset.fallbackSrc,
                  }));
                  setProcessing(false);
                  setMessage(`Cargado ${preset.name}.`);
                };
                img.src = preset.src;
              }}
            >
              <span>{preset.icon}</span>
              <span>{preset.name} (Assets)</span>
            </button>
          ))}
          {SPRITE_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.name}
              className="template-pill-btn"
              onClick={() => {
                baseSpriteRef.current = null;
                setFreeRotation(0);
                setEditing((prev) => ({
                  ...prev,
                  name: tmpl.name,
                  pixels: tmpl.pixels,
                  image: undefined,
                }));
                pixels.current = tmpl.pixels;
                setMessage(`Cargada plantilla de ${tmpl.name}.`);
              }}
            >
              <span>{tmpl.icon}</span>
              <span>{tmpl.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="editor-card">
        <div className="editor-main">
          <div className="section-heading compact">
            <h2>Modo de creación</h2>
            <div className="segmented">
              <button className={mode === 'pixel' ? 'active' : ''} onClick={() => setMode('pixel')}>
                <Paintbrush size={14} /> Pixel Art
              </button>
              <button
                className={mode === 'auto_sprite' ? 'active' : ''}
                onClick={() => setMode('auto_sprite')}
              >
                <Wand2 size={14} /> Generador SVG/PNG
              </button>
              <button className={mode === 'photo' ? 'active' : ''} onClick={() => setMode('photo')}>
                <ImageIcon size={14} /> Fotografía
              </button>
            </div>
          </div>

          {mode === 'pixel' && (
            <>
              {/* Movement Classification & Sprite-by-Sprite Shelf */}
              <div
                className="sprite-movement-shelf"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} style={{ color: 'var(--lime)' }} />
                    <strong style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>Clasificar para movimiento:</strong>
                  </div>
                  <div className="segmented" style={{ width: 'fit-content' }}>
                    {(['idle', 'run', 'jump', 'slide'] as Movement[]).map((mov) => {
                      const labels: Record<Movement, string> = {
                        idle: 'Reposo',
                        run: 'Carrera',
                        jump: 'Salto',
                        slide: 'Agachado',
                      };
                      const count = editing.frames?.[mov]?.length ?? (mov === 'idle' ? 1 : 0);
                      return (
                        <button
                          key={mov}
                          type="button"
                          className={spriteMovement === mov ? 'active' : ''}
                          onClick={() => {
                            setSpriteMovement(mov);
                            setActiveFrameIdx(0);
                            selectSpriteFrame(0, mov);
                          }}
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        >
                          {labels[mov]} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sprite Frames Carousel for selected movement */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {(() => {
                    const curFrames = editing.frames?.[spriteMovement] ?? [];
                    if (curFrames.length === 0) {
                      return (
                        <div style={{ fontSize: '0.75rem', color: 'var(--subtle)', padding: '4px 0' }}>
                          Sin sprites en este movimiento. El sprite actual del lienzo se guardará aquí.
                        </div>
                      );
                    }
                    return curFrames.map((fUrl, fIdx) => (
                      <div
                        key={fIdx}
                        onClick={() => selectSpriteFrame(fIdx, spriteMovement)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '4px',
                          borderRadius: '8px',
                          border: activeFrameIdx === fIdx ? '2px solid var(--lime)' : '1px solid var(--border)',
                          background: activeFrameIdx === fIdx ? 'rgba(216, 243, 106, 0.15)' : 'var(--bg)',
                          cursor: 'pointer',
                          minWidth: '52px',
                          position: 'relative',
                        }}
                        title={`Fotograma #${fIdx + 1}`}
                      >
                        <img
                          src={fUrl}
                          alt={`Frame ${fIdx + 1}`}
                          style={{ width: '36px', height: '36px', objectFit: 'contain', imageRendering: 'pixelated' }}
                        />
                        <span style={{ fontSize: '0.65rem', color: 'var(--ink)', marginTop: '2px', fontWeight: activeFrameIdx === fIdx ? 700 : 400 }}>
                          #{fIdx + 1}
                        </span>
                        {curFrames.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSpriteFrame(fIdx);
                            }}
                            title="Eliminar este sprite"
                            style={{
                              position: 'absolute',
                              top: '-4px',
                              right: '-4px',
                              background: '#ef4444',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '50%',
                              width: '15px',
                              height: '15px',
                              fontSize: '10px',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ));
                  })()}

                  <div style={{ display: 'flex', gap: '6px', marginLeft: '6px' }}>
                    <button
                      type="button"
                      className="template-pill-btn"
                      onClick={() => addSpriteFrame(false)}
                      title="Guardar el sprite actual como nuevo fotograma en este movimiento"
                      style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={13} /> + Nuevo sprite
                    </button>
                    <button
                      type="button"
                      className="template-pill-btn"
                      onClick={() => addSpriteFrame(true)}
                      title="Duplicar el fotograma seleccionado para variar la animación"
                      style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Copy size={13} /> Duplicar
                    </button>
                  </div>
                </div>
              </div>

              {/* Draw Type Selector: Pixel-by-Pixel vs Freehand & Tools */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 0 14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div className="segmented" style={{ width: 'fit-content' }}>
                    <button
                      type="button"
                      className={drawType === 'pixel' ? 'active' : ''}
                      onClick={() => setDrawType('pixel')}
                    >
                      <Grid size={13} style={{ marginRight: 4 }} /> Píxel por píxel (16x16)
                    </button>
                    <button
                      type="button"
                      className={drawType === 'freehand' ? 'active' : ''}
                      onClick={() => setDrawType('freehand')}
                    >
                      <Brush size={13} style={{ marginRight: 4 }} /> Trazo a mano alzada
                    </button>
                  </div>

                    {/* Tool mode: Brush vs Fill Bucket vs Pipette */}
                  <div className="segmented" style={{ width: 'fit-content' }}>
                    <button
                      type="button"
                      className={activeTool === 'brush' && color !== 'transparent' ? 'active' : ''}
                      onClick={() => {
                        setActiveTool('brush');
                        if (color === 'transparent') setColor(COLORS[0]);
                      }}
                      title="Pincel / Lápiz: Dibuja trazos o píxeles individuales"
                    >
                      <Paintbrush size={13} style={{ marginRight: 4 }} /> Pincel
                    </button>
                    <button
                      type="button"
                      className={activeTool === 'fill' ? 'active' : ''}
                      onClick={() => {
                        setActiveTool('fill');
                        if (color === 'transparent') setColor(COLORS[0]);
                      }}
                      title="Bote de pintura: Rellena formas cerradas o áreas del mismo color (como en Paint)"
                    >
                      <PaintBucket size={13} style={{ marginRight: 4 }} /> Relleno
                    </button>
                    <button
                      type="button"
                      className={activeTool === 'pipette' ? 'active' : ''}
                      onClick={() => void triggerNativeEyeDropper()}
                      title="Cuentagotas: Toma una muestra de cualquier color en pantalla o lienzo"
                    >
                      <Pipette size={13} style={{ marginRight: 4 }} /> Cuentagotas
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {drawType === 'freehand' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--ink)' }}>
                      <span>Grosor:</span>
                      <input
                        type="range"
                        min="2"
                        max="28"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        style={{ width: '70px', accentColor: 'var(--lime)' }}
                      />
                      <span>{brushSize}px</span>
                    </div>
                  )}

                  {/* Clear Canvas Button */}
                  <button
                    type="button"
                    className="template-pill-btn"
                    onClick={clearCanvas}
                    title="Limpiar completamente el lienzo para comenzar desde cero"
                    style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', borderColor: '#ef4444', padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RotateCcw size={13} /> Limpiar lienzo
                  </button>

                  {drawType === 'freehand' && (
                    <button
                      type="button"
                      className="template-pill-btn"
                      onClick={() => {
                        const canvas = freehandRef.current;
                        if (canvas) {
                          const isolated = isolateBlackOutlineContour(canvas);
                          setEditing((prev) => ({ ...prev, image: isolated }));
                          setMessage('Silueta exterior aislada siguiendo el contorno negro.');
                        }
                      }}
                      title="Descarta cualquier trazo o fondo que esté fuera del contorno negro cerrado"
                      style={{ background: 'var(--panel)', color: 'var(--ink)', borderColor: 'var(--border)', padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Scissors size={13} /> Aislar contorno negro
                    </button>
                  )}
                </div>
              </div>

              {/* Free Transformation & Orientation Toolbar */}
              <div
                className="transform-toolbar"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)', marginRight: '4px' }}>
                    Transformar:
                  </span>
                  <button
                    type="button"
                    className="template-pill-btn"
                    onClick={() => handleRotate90(false)}
                    title="Girar 90° hacia la izquierda (antihorario)"
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    <RotateCcw size={13} /> 90° Izq
                  </button>
                  <button
                    type="button"
                    className="template-pill-btn"
                    onClick={() => handleRotate90(true)}
                    title="Girar 90° hacia la derecha (horario)"
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    <RotateCw size={13} /> 90° Der
                  </button>
                  <button
                    type="button"
                    className="template-pill-btn"
                    onClick={handleFlipHorizontal}
                    title="Reflejar / Voltear horizontalmente"
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    <FlipHorizontal size={13} /> Espejo H
                  </button>
                  <button
                    type="button"
                    className="template-pill-btn"
                    onClick={handleFlipVertical}
                    title="Reflejar / Voltear verticalmente"
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    <FlipVertical size={13} /> Espejo V
                  </button>
                </div>

                {/* Free Rotation Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--ink)' }}>
                  <span>Ángulo ({freeRotation}°):</span>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={freeRotation}
                    onChange={(e) => handleFreeRotateCanvas(Number(e.target.value))}
                    style={{ width: '85px', accentColor: 'var(--lime)', margin: 0 }}
                    title="Rotación libre en grados"
                  />
                  {freeRotation !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleFreeRotateCanvas(0)}
                      title="Restablecer rotación a 0°"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--subtle)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        padding: '2px',
                      }}
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>

              {drawType === 'pixel' ? (
                <canvas
                  ref={ref}
                  width={320}
                  height={320}
                  className="pixel-editor"
                  aria-label="Lienzo de dibujo de 16 por 16 píxeles"
                  style={{
                    cursor: activeTool === 'fill' ? 'cell' : color === 'transparent' ? 'crosshair' : 'default',
                  }}
                  onPointerDown={(e) => {
                    if (Date.now() - lastColorPickerCloseTime.current < 250) {
                      return;
                    }
                    undo.current = [...undo.current.slice(-19), [...pixels.current]];
                    if (activeTool === 'fill') {
                      paint(e);
                    } else {
                      drawing.current = true;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      paint(e);
                    }
                  }}
                  onPointerMove={(e) => {
                    if (drawing.current && activeTool !== 'fill') paint(e);
                  }}
                  onPointerUp={() => {
                    drawing.current = false;
                  }}
                  onPointerCancel={() => {
                    drawing.current = false;
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <canvas
                    ref={freehandRef}
                    width={320}
                    height={320}
                    className="freehand-editor"
                    aria-label="Lienzo de dibujo libre a mano alzada"
                    style={{
                      display: 'block',
                      width: 'min(100%, 320px)',
                      aspectRatio: '1',
                      margin: '10px auto',
                      border: '2px dashed var(--border)',
                      borderRadius: '12px',
                      background: '#ffffff',
                      touchAction: 'none',
                      cursor: activeTool === 'fill' ? 'cell' : color === 'transparent' ? 'crosshair' : 'default',
                    }}
                    onPointerDown={(e) => {
                      if (Date.now() - lastColorPickerCloseTime.current < 250) {
                        return;
                      }
                      if (activeTool === 'fill' || activeTool === 'pipette') {
                        applyFloodFillFreehand(e.clientX, e.clientY);
                        return;
                      }
                      const canvas = freehandRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d')!;
                      freehandDrawing.current = true;
                      freehandUndo.current = [...freehandUndo.current.slice(-19), ctx.getImageData(0, 0, 320, 320)];
                      canvas.setPointerCapture(e.pointerId);

                      const rect = canvas.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 320;
                      const y = ((e.clientY - rect.top) / rect.height) * 320;

                      ctx.lineWidth = brushSize;
                      ctx.lineCap = 'round';
                      ctx.lineJoin = 'round';
                      if (color === 'transparent') {
                        ctx.globalCompositeOperation = 'destination-out';
                      } else {
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.strokeStyle = color;
                      }
                      ctx.beginPath();
                      ctx.moveTo(x, y);
                      ctx.lineTo(x, y);
                      ctx.stroke();
                    }}
                    onPointerMove={(e) => {
                      if (!freehandDrawing.current || activeTool === 'fill') return;
                      const canvas = freehandRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d')!;
                      const rect = canvas.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 320;
                      const y = ((e.clientY - rect.top) / rect.height) * 320;
                      ctx.lineTo(x, y);
                      ctx.stroke();
                    }}
                    onPointerUp={() => {
                      if (!freehandDrawing.current || activeTool === 'fill') return;
                      freehandDrawing.current = false;
                      const canvas = freehandRef.current;
                      if (canvas) {
                        const isolated = isolateBlackOutlineContour(canvas);
                        setEditing((prev) => ({
                          ...prev,
                          image: isolated,
                        }));
                      }
                    }}
                    onPointerCancel={() => {
                      freehandDrawing.current = false;
                    }}
                  />
                  <small style={{ color: 'var(--subtle)', fontSize: '0.75rem', display: 'block', marginBottom: '8px' }}>
                    Tip: Dibuja un contorno cerrado con el pincel negro y luego usa el Bote de Relleno para colorear el interior como en Paint.
                  </small>
                </div>
              )}

              {/* Palette Category Selector Tabs */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                {COLOR_PALETTES.map((pal, idx) => (
                  <button
                    key={pal.name}
                    type="button"
                    className={`template-pill-btn ${paletteTab === idx ? 'selected' : ''}`}
                    onClick={() => setPaletteTab(idx)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      background: paletteTab === idx ? 'var(--lime)' : 'var(--panel)',
                      color: paletteTab === idx ? '#183f35' : 'var(--ink)',
                      borderColor: paletteTab === idx ? 'var(--lime)' : 'var(--border)',
                      fontWeight: paletteTab === idx ? 700 : 500,
                    }}
                  >
                    {pal.name}
                  </button>
                ))}
              </div>

              {/* Swatches for Selected Category */}
              <div className="palette" style={{ marginTop: '10px' }}>
                {/* 1-Click Fill / Brush quick toggle button */}
                <button
                  type="button"
                  aria-label={activeTool === 'fill' ? 'Cambiar a Pincel' : 'Cambiar a Bote de Pintura (Relleno)'}
                  className={activeTool === 'fill' ? 'active' : ''}
                  onClick={() => {
                    setActiveTool((prev) => (prev === 'fill' ? 'brush' : 'fill'));
                    if (color === 'transparent') setColor(COLORS[0]);
                  }}
                  title={activeTool === 'fill' ? 'Herramienta activa: Bote de Relleno. Haz clic para cambiar a Pincel' : 'Herramienta activa: Pincel. Haz clic para cambiar a Bote de Relleno'}
                  style={{
                    background: activeTool === 'fill' ? 'var(--lime)' : 'var(--panel)',
                    color: activeTool === 'fill' ? '#183f35' : 'var(--ink)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  {activeTool === 'fill' ? <PaintBucket size={15} /> : <Paintbrush size={15} />}
                </button>

                {COLOR_PALETTES[paletteTab].colors.map((c) => (
                  <button
                    key={c}
                    title={c}
                    aria-label={`Pintar con ${c}`}
                    aria-pressed={color === c && color !== 'transparent'}
                    className={color === c && color !== 'transparent' ? 'active' : ''}
                    style={{ background: c }}
                    onClick={() => {
                      setColor(c);
                      if (activeTool === 'pipette') {
                        setActiveTool('brush');
                      }
                    }}
                  />
                ))}

                {/* Custom Color Picker Input */}
                <div
                  style={{
                    position: 'relative',
                    width: '27px',
                    height: '27px',
                    display: 'inline-block',
                  }}
                >
                  <button
                    type="button"
                    title="Color personalizado (Selector)"
                    aria-label="Color personalizado (Selector)"
                    onClick={(e) => {
                      e.stopPropagation();
                      colorPickerActive.current = true;
                      colorInputRef.current?.click();
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    style={{
                      width: '27px',
                      height: '27px',
                      borderRadius: '50%',
                      border: '1px solid #bac5ae',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      padding: 0,
                      background: color.startsWith('#') ? color : '#ffffff',
                    }}
                  >
                    <Pipette size={14} color={color === '#000000' || color === '#243b32' ? '#ffffff' : '#183f35'} />
                  </button>
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={color.startsWith('#') ? color : '#000000'}
                    onClick={(e) => {
                      e.stopPropagation();
                      colorPickerActive.current = true;
                    }}
                    onChange={(e) => {
                      e.stopPropagation();
                      const chosenColor = e.target.value;
                      setColor(chosenColor);
                      setActiveTool('brush');
                      lastColorPickerCloseTime.current = Date.now();
                      colorPickerActive.current = false;
                    }}
                    onBlur={() => {
                      colorPickerActive.current = false;
                      lastColorPickerCloseTime.current = Date.now();
                    }}
                    style={{
                      opacity: 0,
                      width: 0,
                      height: 0,
                      position: 'absolute',
                      pointerEvents: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                    }}
                  />
                </div>

                {/* Eyedropper / Pipette Screen Color Picker Button */}
                <button
                  type="button"
                  aria-label="Cuentagotas para tomar color"
                  title="Cuentagotas: Tomar muestra de color del lienzo o pantalla"
                  className={activeTool === 'pipette' ? 'active' : ''}
                  onClick={() => void triggerNativeEyeDropper()}
                  style={{
                    background: activeTool === 'pipette' ? 'var(--lime)' : 'var(--panel)',
                    color: activeTool === 'pipette' ? '#183f35' : 'var(--ink)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Pipette size={15} />
                </button>

                {/* Eraser */}
                <button
                  aria-label="Borrador"
                  className={color === 'transparent' ? 'active' : ''}
                  onClick={() => {
                    setColor('transparent');
                    setActiveTool('brush');
                  }}
                  title="Borrador"
                >
                  <Eraser size={17} />
                </button>

                {/* Undo */}
                <button
                  aria-label="Deshacer trazo"
                  title="Deshacer"
                  onClick={() => {
                    if (drawType === 'pixel') {
                      const previous = undo.current.pop();
                      if (previous) {
                        setEditing((c) => ({ ...c, pixels: previous }));
                        pixels.current = previous;
                      }
                    } else if (freehandRef.current) {
                      const prevImg = freehandUndo.current.pop();
                      if (prevImg) {
                        const ctx = freehandRef.current.getContext('2d')!;
                        ctx.putImageData(prevImg, 0, 0);
                        const isolated = isolateBlackOutlineContour(freehandRef.current);
                        setEditing((c) => ({ ...c, image: isolated }));
                      }
                    }
                  }}
                >
                  <Undo2 size={17} />
                </button>
              </div>
            </>
          )}

          {mode === 'auto_sprite' && (
            <div className="auto-sprite-generator">
              <label className="upload-zone">
                <FileCode size={34} />
                <strong>Generador automático desde SVG o PNG</strong>
                <span>Arrastra o selecciona un archivo .svg o .png</span>
                <input
                  type="file"
                  accept="image/png,image/svg+xml,image/webp,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAutoSpriteUpload(file);
                  }}
                />
              </label>

              <div className="generator-steps">
                <div className="step-item">
                  <span className="step-num">1</span>
                  <span>Sube tu archivo SVG vectorial o sprite PNG transparente</span>
                </div>
                <div className="step-item">
                  <span className="step-num">2</span>
                  <span>El sistema mapea los colores a la paleta oficial y genera el avatar</span>
                </div>
                <div className="step-item">
                  <span className="step-num">3</span>
                  <span>Cambia al modo Pixel Art si deseas retocar píxeles individualmente</span>
                </div>
              </div>
            </div>
          )}

          {mode === 'auto_sprite' && (
            <AnimationEditor
              key={editing.id || 'new'}
              character={editing}
              onChange={setEditing}
              onSave={saveMovement}
              busy={busy || processing}
              onEditFrameInCanvas={(targetMovement, frameIdx, frameDataUrl) => {
                if (frameDataUrl) {
                  // Switch to drawing mode and load frame
                  setMode('pixel');
                  setDrawType('freehand');
                  setEditing((prev) => ({ ...prev, image: frameDataUrl }));
                  setMessage(`Editando fotograma #${frameIdx + 1} de ${targetMovement} en el lienzo. Al guardar, se sincroniza.`);
                } else {
                  // Blank frame to draw new
                  setMode('pixel');
                  clearCanvas();
                  setMessage(`Dibuja un nuevo fotograma para ${targetMovement}.`);
                }
              }}
            />
          )}

          {mode === 'photo' && (
            <div className="photo-editor">
              <label className="upload-zone">
                <Upload />
                <strong>Una cara, mil aventuras.</strong>
                <span>JPG, PNG o WebP · hasta 8 MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPhoto(file);
                    setUneditedPhotoUrl('');
                    originalPhotoImg.current = null;
                    setZoom(1);
                    setCropX(0.5);
                    setCropY(0.5);
                    setMessage('');
                  }}
                />
              </label>

              {photo && (
                <>
                  {/* Photo Positioning and Focal Point Drag Stage */}
                  <div className="photo-reposition-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Crosshair size={14} style={{ color: 'var(--lime-dark, #244b36)' }} />
                        Posición de la Foto y Punto Focal del Personaje
                      </span>
                      <button
                        type="button"
                        className="template-pill-btn"
                        onClick={() => {
                          setCropX(0.5);
                          setCropY(0.5);
                          setZoom(1);
                          setPhotoRotation(0);
                          setMessage('Punto focal y rotación centrados a 0°.');
                        }}
                        title="Centrar punto focal y restablecer rotación a 0°"
                      >
                        <Crosshair size={12} /> Centrar
                      </button>
                    </div>

                    {/* Interactive Focal Point & Pan Stage */}
                    <div
                      className="photo-reposition-stage"
                      title="Arrastra para mover la foto y ajustar el punto focal del personaje"
                      onPointerDown={(e) => {
                        const target = e.currentTarget;
                        target.setPointerCapture(e.pointerId);
                        photoDragStart.current = {
                          clientX: e.clientX,
                          clientY: e.clientY,
                          startX: cropX,
                          startY: cropY,
                        };
                      }}
                      onPointerMove={(e) => {
                        if (!photoDragStart.current) return;
                        const target = e.currentTarget;
                        const rect = target.getBoundingClientRect();
                        const dx = (e.clientX - photoDragStart.current.clientX) / (rect.width * Math.max(1, zoom));
                        const dy = (e.clientY - photoDragStart.current.clientY) / (rect.height * Math.max(1, zoom));
                        const newX = Math.max(0, Math.min(1, photoDragStart.current.startX - dx));
                        const newY = Math.max(0, Math.min(1, photoDragStart.current.startY - dy));
                        setCropX(Number(newX.toFixed(3)));
                        setCropY(Number(newY.toFixed(3)));
                      }}
                      onPointerUp={(e) => {
                        if (photoDragStart.current) {
                          try {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          } catch {}
                          photoDragStart.current = null;
                        }
                      }}
                      onPointerCancel={() => {
                        photoDragStart.current = null;
                      }}
                    >
                      {(uneditedPhotoUrl || editing.image) && (
                        <img
                          src={uneditedPhotoUrl || editing.image}
                          alt="Focal preview"
                          className="photo-reposition-img"
                          style={{
                            width: `${Math.round(zoom * 100)}%`,
                            height: `${Math.round(zoom * 100)}%`,
                            objectFit: 'cover',
                            transform: `translate(${-cropX * 100}%, ${-cropY * 100}%) rotate(${photoRotation}deg)`,
                          }}
                        />
                      )}
                      {/* Character framing overlay & focal guides */}
                      <div className="photo-focal-frame" />
                      <div className="photo-focal-crosshair-h" />
                      <div className="photo-focal-crosshair-v" />
                      <div className="photo-focal-center-pip" />
                    </div>

                    <small style={{ color: 'var(--subtle)', fontSize: '0.75rem', textAlign: 'center', display: 'block' }}>
                      Arrastra la imagen arriba o usa los controles deslizantes para encuadrar la cara exactamente en el centro.
                    </small>

                    <div className="crop-sliders" style={{ marginTop: '4px' }}>
                      <label>
                        Acercamiento ({zoom.toFixed(2)}x)
                        <input
                          type="range"
                          min="1"
                          max="4"
                          step="0.05"
                          value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))}
                        />
                      </label>
                      <label>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Rotación ({photoRotation}°)</span>
                          {photoRotation !== 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoRotation(0);
                                setMessage('Rotación de foto restablecida a 0°.');
                              }}
                              title="Restablecer rotación a 0°"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--subtle)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '0 4px',
                                lineHeight: 1,
                              }}
                            >
                              ↺ Restablecer
                            </button>
                          )}
                        </span>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="5"
                          value={photoRotation}
                          onChange={(e) => setPhotoRotation(Number(e.target.value))}
                          style={{ accentColor: 'var(--lime)' }}
                        />
                      </label>
                      <label>
                        Posición horizontal ({Math.round(cropX * 100)}%)
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={cropX}
                          onChange={(e) => setCropX(Number(e.target.value))}
                        />
                      </label>
                      <label>
                        Posición vertical ({Math.round(cropY * 100)}%)
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={cropY}
                          onChange={(e) => setCropY(Number(e.target.value))}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Photo Edit & Background Removal Suite */}
                  {editing.image && (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
                          Herramientas de Recorte y Eliminación de Fondo
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="template-pill-btn"
                            style={{ borderColor: '#d14343', color: '#881b1b', background: '#ffecec', fontWeight: 600, fontSize: '0.8rem' }}
                            onClick={() => {
                              const targetUrl = uneditedPhotoUrl || editing.image;
                              if (targetUrl) {
                                setEditing((prev) => ({ ...prev, image: targetUrl }));
                                setPhotoRotation(0);
                                setZoom(1);
                                setCropX(0.5);
                                setCropY(0.5);
                                const pCanvas = photoCanvasRef.current;
                                if (pCanvas) {
                                  const ctx = pCanvas.getContext('2d')!;
                                  const img = new Image();
                                  img.onload = () => {
                                    originalPhotoImg.current = img;
                                    ctx.clearRect(0, 0, 260, 260);
                                    ctx.drawImage(img, 0, 0, 260, 260);
                                  };
                                  img.src = targetUrl;
                                }
                                setMessage('Foto restaurada al estado original con rotación a 0°.');
                              } else {
                                setMessage('No hay foto original para restaurar.');
                              }
                            }}
                            title="Restaura la foto completa a su estado original sin ediciones ni borrados"
                          >
                            <RotateCcw size={14} style={{ marginRight: 4 }} /> Restaurar foto original
                          </button>
                          <button
                            type="button"
                            className="template-pill-btn"
                            style={{ borderColor: 'var(--lime)', color: '#183f35', background: 'var(--lime)', fontWeight: 600, fontSize: '0.8rem' }}
                            onClick={() => {
                              const pCanvas = photoCanvasRef.current;
                              if (!pCanvas) return;
                              const ctx = pCanvas.getContext('2d')!;
                              const w = pCanvas.width;
                              const h = pCanvas.height;
                              const imgData = ctx.getImageData(0, 0, w, h);
                              const data = imgData.data;

                              // Sample corner colors as background references
                              const corners = [
                                { r: data[0], g: data[1], b: data[2] },
                                { r: data[(w - 1) * 4], g: data[(w - 1) * 4 + 1], b: data[(w - 1) * 4 + 2] },
                                { r: data[((h - 1) * w) * 4], g: data[((h - 1) * w) * 4 + 1], b: data[((h - 1) * w) * 4 + 2] },
                                { r: data[(w * h - 1) * 4], g: data[(w * h - 1) * 4 + 1], b: data[(w * h - 1) * 4 + 2] },
                              ];

                              for (let i = 0; i < w * h; i++) {
                                const idx = i * 4;
                                if (data[idx + 3] === 0) continue;
                                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                                for (const c of corners) {
                                  const diff = Math.hypot(r - c.r, g - c.g, b - c.b);
                                  if (diff < wandTolerance) {
                                    data[idx + 3] = 0;
                                    break;
                                  }
                                }
                              }
                              ctx.putImageData(imgData, 0, 0);
                              const updatedUrl = pCanvas.toDataURL('image/png');
                              setEditing((prev) => ({ ...prev, image: updatedUrl }));
                              setMessage('Fondo eliminado automáticamente.');
                            }}
                          >
                            <Sparkles size={14} style={{ marginRight: 4 }} /> Quitar fondo automático
                          </button>
                        </div>
                      </div>

                      {/* Tool selector */}
                      <div className="segmented" style={{ width: 'fit-content', marginBottom: '12px' }}>
                        <button
                          type="button"
                          className={photoTool === 'wand' ? 'active' : ''}
                          onClick={() => setPhotoTool('wand')}
                          title="Varita: Haz clic en cualquier color del fondo para borrarlo"
                        >
                          <Wand2 size={13} style={{ marginRight: 4 }} /> Varita Mágica
                        </button>
                        <button
                          type="button"
                          className={photoTool === 'eraser' ? 'active' : ''}
                          onClick={() => setPhotoTool('eraser')}
                          title="Borrador manual: Pasa el pincel para limpiar bordes"
                        >
                          <Eraser size={13} style={{ marginRight: 4 }} /> Borrador
                        </button>
                        <button
                          type="button"
                          className={photoTool === 'restore' ? 'active' : ''}
                          onClick={() => setPhotoTool('restore')}
                          title="Restaurar: Recupera partes borradas de la foto original"
                        >
                          <RotateCcw size={13} style={{ marginRight: 4 }} /> Pincel Restaurador
                        </button>
                        <button
                          type="button"
                          className={photoTool === 'pipette' ? 'active' : ''}
                          onClick={() => setPhotoTool('pipette')}
                          title="Cuentagotas: Haz clic en la foto para tomar un color de muestra"
                        >
                          <Pipette size={13} style={{ marginRight: 4 }} /> Cuentagotas
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '10px', fontSize: '0.8rem', color: 'var(--ink)' }}>
                        {photoTool === 'wand' ? (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Tolerancia de color: {wandTolerance}
                            <input
                              type="range"
                              min="10"
                              max="90"
                              value={wandTolerance}
                              onChange={(e) => setWandTolerance(Number(e.target.value))}
                              style={{ width: '100px', accentColor: 'var(--lime)' }}
                            />
                          </label>
                        ) : photoTool === 'pipette' ? (
                          <span style={{ color: 'var(--subtle)' }}>
                            Haz clic en cualquier punto de la foto para seleccionar ese color en tu paleta.
                          </span>
                        ) : (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Radio del pincel: {eraserRadius}px
                            <input
                              type="range"
                              min="4"
                              max="40"
                              value={eraserRadius}
                              onChange={(e) => setEraserRadius(Number(e.target.value))}
                              style={{ width: '100px', accentColor: 'var(--lime)' }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Interactive Photo Canvas */}
                      <div style={{ position: 'relative', width: '260px', height: '260px', margin: '0 auto', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"><rect width=\"8\" height=\"8\" fill=\"%23e5e9df\"/><rect x=\"8\" y=\"8\" width=\"8\" height=\"8\" fill=\"%23e5e9df\"/><rect x=\"8\" width=\"8\" height=\"8\" fill=\"%23ffffff\"/><rect y=\"8\" width=\"8\" height=\"8\" fill=\"%23ffffff\"/></svg>')" }}>
                        <canvas
                          ref={photoCanvasRef}
                          width={260}
                          height={260}
                          style={{ display: 'block', width: '100%', height: '100%', cursor: photoTool === 'wand' || photoTool === 'pipette' ? 'crosshair' : 'default', touchAction: 'none' }}
                          onPointerDown={(e) => {
                            const canvas = photoCanvasRef.current;
                            if (!canvas) return;
                            const ctx = canvas.getContext('2d')!;
                            const rect = canvas.getBoundingClientRect();
                            const x = Math.floor(((e.clientX - rect.left) / rect.width) * 260);
                            const y = Math.floor(((e.clientY - rect.top) / rect.height) * 260);

                            if (photoTool === 'pipette') {
                              const pixel = ctx.getImageData(x, y, 1, 1).data;
                              if (pixel[3] > 10) {
                                const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
                                setColor(hex);
                                setMessage(`Color tomado de la foto: ${hex}`);
                              }
                              return;
                            }

                            if (photoTool === 'wand') {
                              const imgData = ctx.getImageData(0, 0, 260, 260);
                              const data = imgData.data;
                              const targetIdx = (y * 260 + x) * 4;
                              const tr = data[targetIdx], tg = data[targetIdx + 1], tb = data[targetIdx + 2], ta = data[targetIdx + 3];
                              if (ta < 20) return;

                              // Flood-fill or color distance erase
                              for (let i = 0; i < 260 * 260; i++) {
                                const idx = i * 4;
                                if (data[idx + 3] === 0) continue;
                                const diff = Math.hypot(data[idx] - tr, data[idx + 1] - tg, data[idx + 2] - tb);
                                if (diff < wandTolerance) {
                                  data[idx + 3] = 0;
                                }
                              }
                              ctx.putImageData(imgData, 0, 0);
                              setEditing((prev) => ({ ...prev, image: canvas.toDataURL('image/png') }));
                            } else {
                              photoDrawing.current = true;
                              canvas.setPointerCapture(e.pointerId);
                              ctx.save();
                              ctx.beginPath();
                              ctx.arc(x, y, eraserRadius, 0, Math.PI * 2);
                              if (photoTool === 'eraser') {
                                ctx.globalCompositeOperation = 'destination-out';
                                ctx.fill();
                              } else if (photoTool === 'restore' && originalPhotoImg.current) {
                                ctx.clip();
                                ctx.drawImage(originalPhotoImg.current, 0, 0, 260, 260);
                              }
                              ctx.restore();
                            }
                          }}
                          onPointerMove={(e) => {
                            if (!photoDrawing.current) return;
                            const canvas = photoCanvasRef.current;
                            if (!canvas) return;
                            const ctx = canvas.getContext('2d')!;
                            const rect = canvas.getBoundingClientRect();
                            const x = Math.floor(((e.clientX - rect.left) / rect.width) * 260);
                            const y = Math.floor(((e.clientY - rect.top) / rect.height) * 260);

                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(x, y, eraserRadius, 0, Math.PI * 2);
                            if (photoTool === 'eraser') {
                              ctx.globalCompositeOperation = 'destination-out';
                              ctx.fill();
                            } else if (photoTool === 'restore' && originalPhotoImg.current) {
                              ctx.clip();
                              ctx.drawImage(originalPhotoImg.current, 0, 0, 260, 260);
                            }
                            ctx.restore();
                          }}
                          onPointerUp={() => {
                            if (!photoDrawing.current) return;
                            photoDrawing.current = false;
                            const canvas = photoCanvasRef.current;
                            if (canvas) {
                              setEditing((prev) => ({ ...prev, image: canvas.toDataURL('image/png') }));
                            }
                          }}
                          onPointerCancel={() => {
                            photoDrawing.current = false;
                          }}
                        />
                      </div>
                      <small style={{ color: 'var(--subtle)', fontSize: '0.75rem', display: 'block', textAlign: 'center', marginTop: '6px' }}>
                        Toca con la Varita para borrar áreas enteras de color, o usa el Borrador y Restaurador para detalles precisos.
                      </small>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <aside className="editor-sidebar">
          <p className="eyebrow">VISTA PREVIA ANIMADA</p>
          <div className="avatar-preview" style={{ flexDirection: 'column', gap: '8px' }}>
            <Avatar
              character={{
                ...editing,
                image: editing.image,
                pixels: editing.pixels,
                frames: editing.frames,
              }}
              movement={previewMovement}
              frameIndex={previewPlaying ? undefined : 0}
              showGround
              size={145}
            />
            {/* Live Animation Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
              <button
                type="button"
                className="template-pill-btn"
                onClick={() => setPreviewPlaying((p) => !p)}
                title={previewPlaying ? 'Pausar animación' : 'Reproducir animación'}
                aria-label={previewPlaying ? 'Pausar animación' : 'Reproducir animación'}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: previewPlaying ? 'var(--lime)' : 'var(--panel)',
                  color: previewPlaying ? '#183f35' : 'var(--ink)',
                  borderColor: previewPlaying ? 'var(--lime)' : 'var(--border)',
                  fontWeight: 600,
                }}
              >
                {previewPlaying ? <Pause size={13} /> : <Play size={13} />}
                <span>{previewPlaying ? 'Pausar' : 'Play'}</span>
              </button>

              <div className="segmented" style={{ width: 'fit-content' }}>
                {(['run', 'jump', 'slide', 'idle'] as Movement[]).map((mov) => (
                  <button
                    key={mov}
                    type="button"
                    className={previewMovement === mov ? 'active' : ''}
                    onClick={() => setPreviewMovement(mov)}
                    style={{ fontSize: '0.7rem', padding: '3px 7px' }}
                    title={`Ver animación de ${mov}`}
                  >
                    {mov === 'run' ? 'Corre' : mov === 'jump' ? 'Salta' : mov === 'slide' ? 'Desliza' : 'Reposo'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label>
            Nombre del personaje
            <input
              maxLength={24}
              value={editing.name}
              onChange={(e) => setEditing((c) => ({ ...c, name: e.target.value }))}
            />
          </label>
          <label>
            Tamaño en el juego · {Math.round((editing.scale ?? 1) * 100)}%
            <input
              type="range"
              min="0.5"
              max="2.2"
              step="0.05"
              value={editing.scale ?? 1}
              onChange={(e) => setEditing((c) => ({ ...c, scale: Number(e.target.value) }))}
            />
          </label>
          <div className="sidebar-quick-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)' }}>Acciones Rápidas</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                className="template-pill-btn"
                onClick={handleFlipHorizontal}
                title="Voltear horizontalmente"
                style={{ fontSize: '0.75rem', padding: '6px 8px', justifyContent: 'center' }}
              >
                <FlipHorizontal size={13} /> Voltear H
              </button>
              <button
                type="button"
                className="template-pill-btn"
                onClick={handleFlipVertical}
                title="Voltear verticalmente"
                style={{ fontSize: '0.75rem', padding: '6px 8px', justifyContent: 'center' }}
              >
                <FlipVertical size={13} /> Voltear V
              </button>
            </div>
            <button
              type="button"
              className="template-pill-btn"
              onClick={() => {
                const cloned: Character = {
                  ...editing,
                  id: crypto.randomUUID(),
                  name: `${editing.name} (Copia)`.slice(0, 24),
                };
                setEditing(cloned);
                void onSave(cloned);
                setMessage(`Copia de ${editing.name} creada y guardada.`);
              }}
              title="Duplica el personaje actual con un solo clic"
              style={{ fontSize: '0.75rem', padding: '6px 8px', justifyContent: 'center', background: 'var(--panel)' }}
            >
              <Copy size={13} /> Duplicar Personaje
            </button>
          </div>

          <button className="primary" onClick={() => void save()} disabled={busy || processing} style={{ marginTop: '14px' }}>
            <Save size={17} />{' '}
            {processing ? 'Generando…' : busy ? 'Guardando…' : 'Guardar personaje'}
          </button>
          <p className="form-message" role="status">
            {message}
          </p>
        </aside>
      </div>

      {/* System Prompt Modal for LLM Sprite Sheet Generation */}
      {showPrompt && (
        <div className="modal-backdrop" onClick={() => setShowPrompt(false)}>
          <section
            className="help-modal"
            style={{ maxWidth: 720, background: '#0e221a', color: '#f1f5f2', border: '1px solid rgba(216, 243, 106, 0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="Cerrar prompt"
              onClick={() => setShowPrompt(false)}
            >
              <X />
            </button>
            <span className="round-icon" style={{ background: 'rgba(216, 243, 106, 0.2)', color: 'var(--lime)' }}>
              <FileCode />
            </span>
            <p className="eyebrow">SISTEMA DETERMINISTA DE SPRITES</p>
            <h2 id="prompt-modal-title" style={{ color: '#fff', marginBottom: 12 }}>
              Prompt del Sistema para Modelos de Imagen IA
            </h2>
            <p style={{ color: '#a7cab8', fontSize: 13, marginBottom: 16 }}>
              Copia y pega este prompt estricto en Midjourney, Stable Diffusion, DALL-E 3, Flux o Imagen. La IA generará la hoja con la cuadrícula, poses y orden exactos (2 filas × 6 columnas) para que el motor del juego anime tu personaje automáticamente.
            </p>

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <textarea
                readOnly
                rows={12}
                value={`[ROLE & PURPOSE]
You are a precision 2D Game Asset Engine. Your sole function is to generate production-ready 2D platformer character sprite sheets formatted as a rigid, deterministic, machine-extractable grid. You output only the sprite sheet graphic. The visual identity of the character is specified by the user; you must strictly enforce the spatial, structural, sequential, and kinematic rules below.

[SHEET SPECIFICATION & RESOLUTION]
1. Canvas layout: Fixed grid of exactly 2 ROWS and 6 COLUMNS (total of exactly 12 cells).
2. Canvas aspect ratio: 3:1 horizontal banner (e.g., 1536 x 512 px).
3. Cell size: Every cell has the EXACT same uniform width and height (e.g., 256 x 256 px).
4. Background: Pure transparent background (Alpha = 0). No background color, no gradients, no scenery, and no checkerboard texture.
5. Ground Contact Shadow: EVERY pose in contact with the ground (Frames 0, 1, 2, 3, 4, 5, 6, 7, 10, 11) MUST include a subtle, soft elliptical dark contact drop shadow directly beneath the feet/body. The shadow is an integral part of the character animation to anchor it to the world.
6. Content isolation: Exactly ONE character pose per cell (with its ground contact shadow). Never draw multiple characters, duplicates, ghosting, or debris within any cell.
7. Zero text / Zero UI: Do not include labels, frame numbers, titles, borders, divider lines, crop marks, watermark, or metadata inside the image.

[STRICT 12-FRAME SEQUENTIAL ACTION MAPPING]
Frames are numbered 0 to 11 in strict reading order (Row 1 from Left to Right, then Row 2 from Left to Right). You must output the poses in this EXACT order without skipping, reordering, or swapping:

ROW 1:
- Cell (Row 1, Col 1) -> Frame 0 [IDLE 1]: Neutral standing breathing pose, arms relaxed, feet grounded, contact shadow beneath feet, facing right.
- Cell (Row 1, Col 2) -> Frame 1 [IDLE 2]: Ready idle stance, subtle weight shift, contact shadow beneath feet, facing right.
- Cell (Row 1, Col 3) -> Frame 2 [RUN 1]: Right foot heel strike forward, left foot back, left arm forward, dynamic contact shadow beneath.
- Cell (Row 1, Col 4) -> Frame 3 [RUN 2]: Right foot flat supporting weight, left leg passing through center, contact shadow beneath.
- Cell (Row 1, Col 5) -> Frame 4 [RUN 3]: Right foot push-off with toes, airborne transition phase, smaller lighter shadow beneath.
- Cell (Row 1, Col 6) -> Frame 5 [RUN 4]: Left foot heel strike forward, right foot back, right arm forward, contact shadow beneath.

ROW 2:
- Cell (Row 2, Col 1) -> Frame 6 [RUN 5]: Left foot flat supporting weight, right leg passing through center, contact shadow beneath.
- Cell (Row 2, Col 2) -> Frame 7 [RUN 6]: Left foot push-off with toes, full propulsion extension, contact shadow beneath.
- Cell (Row 2, Col 3) -> Frame 8 [JUMP ASCENT]: High leap upward, body stretched upwards, knees flexing, arms raised, light distant ground shadow.
- Cell (Row 2, Col 4) -> Frame 9 [JUMP APEX / FALL]: Apex tuck and descent, downward velocity anticipation, legs prepared for ground, light distant ground shadow.
- Cell (Row 2, Col 5) -> Frame 10 [CROUCH / SLIDE]: Low-profile obstacle crouch/slide, body lowered close to baseline, legs extended forward, elongated ground shadow beneath body.
- Cell (Row 2, Col 6) -> Frame 11 [CROUCH RECOVERY / STAND TRANSITION]: Low crouch preparing recovery to upright stance, contact shadow beneath.

[GLOBAL KINEMATIC & ANATOMICAL INVARIANTS]
Across all 12 cells, the following parameters MUST remain 100% constant:
- Scale & Proportions: Head-to-body ratio, limb lengths, volume, clothing, colors, and features must be identical across every frame.
- Orientation: Strict lateral profile view facing RIGHT (+X direction). Do not rotate the camera to 3/4 view, front view, or perspective.
- Baseline Alignment: The floor contact line (ground baseline) for grounded poses (Frames 0, 1, 2, 3, 4, 5, 6, 7, 10, 11) must align at the exact same Y-coordinate across all cells (approximately 80% down from the top of the cell).
- Padding: Keep a minimum 16px safety margin between the character outline and cell boundaries so no limbs or accessories cross into neighboring cells.
- Shadow & Lighting: Consistent directional lighting and contact ground drop shadows across all grounded frames.
- Negative Constraints: DO NOT invent actions, DO NOT merge cells, DO NOT draw motion blur or speed lines, DO NOT rotate the character backwards.`}
                style={{
                  width: '100%',
                  background: '#071510',
                  color: '#d8f36a',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowPrompt(false)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const promptText = `[ROLE & PURPOSE]
You are a precision 2D Game Asset Engine. Your sole function is to generate production-ready 2D platformer character sprite sheets formatted as a rigid, deterministic, machine-extractable grid. You output only the sprite sheet graphic. The visual identity of the character is specified by the user; you must strictly enforce the spatial, structural, sequential, and kinematic rules below.

[SHEET SPECIFICATION & RESOLUTION]
1. Canvas layout: Fixed grid of exactly 2 ROWS and 6 COLUMNS (total of exactly 12 cells).
2. Canvas aspect ratio: 3:1 horizontal banner (e.g., 1536 x 512 px).
3. Cell size: Every cell has the EXACT same uniform width and height (e.g., 256 x 256 px).
4. Background: Pure transparent background (Alpha = 0). No background color, no gradients, no scenery, and no checkerboard texture.
5. Ground Contact Shadow: EVERY pose in contact with the ground (Frames 0, 1, 2, 3, 4, 5, 6, 7, 10, 11) MUST include a subtle, soft elliptical dark contact drop shadow directly beneath the feet/body. The shadow is an integral part of the character animation to anchor it to the world.
6. Content isolation: Exactly ONE character pose per cell (with its ground contact shadow). Never draw multiple characters, duplicates, ghosting, or debris within any cell.
7. Zero text / Zero UI: Do not include labels, frame numbers, titles, borders, divider lines, crop marks, watermark, or metadata inside the image.

[STRICT 12-FRAME SEQUENTIAL ACTION MAPPING]
Frames are numbered 0 to 11 in strict reading order (Row 1 from Left to Right, then Row 2 from Left to Right). You must output the poses in this EXACT order without skipping, reordering, or swapping:

ROW 1:
- Cell (Row 1, Col 1) -> Frame 0 [IDLE 1]: Neutral standing breathing pose, arms relaxed, feet grounded, contact shadow beneath feet, facing right.
- Cell (Row 1, Col 2) -> Frame 1 [IDLE 2]: Ready idle stance, subtle weight shift, contact shadow beneath feet, facing right.
- Cell (Row 1, Col 3) -> Frame 2 [RUN 1]: Right foot heel strike forward, left foot back, left arm forward, dynamic contact shadow beneath.
- Cell (Row 1, Col 4) -> Frame 3 [RUN 2]: Right foot flat supporting weight, left leg passing through center, contact shadow beneath.
- Cell (Row 1, Col 5) -> Frame 4 [RUN 3]: Right foot push-off with toes, airborne transition phase, smaller lighter shadow beneath.
- Cell (Row 1, Col 6) -> Frame 5 [RUN 4]: Left foot heel strike forward, right foot back, right arm forward, contact shadow beneath.

ROW 2:
- Cell (Row 2, Col 1) -> Frame 6 [RUN 5]: Left foot flat supporting weight, right leg passing through center, contact shadow beneath.
- Cell (Row 2, Col 2) -> Frame 7 [RUN 6]: Left foot push-off with toes, full propulsion extension, contact shadow beneath.
- Cell (Row 2, Col 3) -> Frame 8 [JUMP ASCENT]: High leap upward, body stretched upwards, knees flexing, arms raised, light distant ground shadow.
- Cell (Row 2, Col 4) -> Frame 9 [JUMP APEX / FALL]: Apex tuck and descent, downward velocity anticipation, legs prepared for ground, light distant ground shadow.
- Cell (Row 2, Col 5) -> Frame 10 [CROUCH / SLIDE]: Low-profile obstacle crouch/slide, body lowered close to baseline, legs extended forward, elongated ground shadow beneath body.
- Cell (Row 2, Col 6) -> Frame 11 [CROUCH RECOVERY / STAND TRANSITION]: Low crouch preparing recovery to upright stance, contact shadow beneath.

[GLOBAL KINEMATIC & ANATOMICAL INVARIANTS]
Across all 12 cells, the following parameters MUST remain 100% constant:
- Scale & Proportions: Head-to-body ratio, limb lengths, volume, clothing, colors, and features must be identical across every frame.
- Orientation: Strict lateral profile view facing RIGHT (+X direction). Do not rotate the camera to 3/4 view, front view, or perspective.
- Baseline Alignment: The floor contact line (ground baseline) for grounded poses (Frames 0, 1, 2, 3, 4, 5, 6, 7, 10, 11) must align at the exact same Y-coordinate across all cells (approximately 80% down from the top of the cell).
- Padding: Keep a minimum 16px safety margin between the character outline and cell boundaries so no limbs or accessories cross into neighboring cells.
- Shadow & Lighting: Consistent directional lighting and contact ground drop shadows across all grounded frames.
- Negative Constraints: DO NOT invent actions, DO NOT merge cells, DO NOT draw motion blur or speed lines, DO NOT rotate the character backwards.`;
                  void navigator.clipboard.writeText(promptText).then(() => {
                    setCopiedPrompt(true);
                    setTimeout(() => setCopiedPrompt(false), 3000);
                  });
                }}
              >
                {copiedPrompt ? <Check size={16} /> : <Copy size={16} />}{' '}
                {copiedPrompt ? '¡Copiado al portapapeles!' : 'Copiar Prompt del Sistema'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
