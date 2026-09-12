'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Eraser,
  FileCode,
  Image as ImageIcon,
  Layers,
  Paintbrush,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  Copy,
  X,
} from 'lucide-react';
import { AnimationEditor, type Movement } from './animation-editor';
import { Avatar } from './art';
import type { Character } from '@/lib/types';

const COLORS = [
  '#ec9565',
  '#fff3d7',
  '#243b32',
  '#315c49',
  '#82b79b',
  '#b8a5d0',
  '#f18c73',
  '#f3d67d',
  '#759bbd',
  '#4a7298',
  '#ffffff',
  '#e2e8f0',
  '#94a3b8',
  '#475569',
  '#1c2524',
];

// Presets from the project's assets folder (/assets/1.png and /assets/2.png)
const ASSET_PRESETS = [
  {
    name: 'Pili Animado (Assets)',
    src: '/assets/character-sprite-1.png',
    fallbackSrc: '/assets/2.png',
    icon: '🦊',
    frames: {
      run: [
        '/assets/pili-run-0.png',
        '/assets/pili-run-1.png',
        '/assets/pili-run-2.png',
        '/assets/pili-run-3.png',
        '/assets/pili-run-4.png',
        '/assets/pili-run-5.png',
      ],
      jump: [
        '/assets/pili-jump-0.png',
        '/assets/pili-jump-1.png',
      ],
      slide: [
        '/assets/pili-slide-0.png',
        '/assets/pili-slide-1.png',
      ],
      idle: [
        '/assets/pili-idle-0.png',
      ],
    },
  },
  {
    name: 'Paladín Sprite 2',
    src: '/assets/character-sprite-2.png',
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
  const [photo, setPhoto] = useState<File>(),
    [zoom, setZoom] = useState(1),
    [cropX, setCropX] = useState(0.5),
    [cropY, setCropY] = useState(0.5),
    [processing, setProcessing] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const ref = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false),
    undo = useRef<string[][]>([]),
    pixels = useRef(editing.pixels!),
    imageWorker = useRef<Worker | null>(null),
    requestId = useRef(0);

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
          setEditing((c) => ({ ...c, image: String(reader.result) }));
          setProcessing(false);
        }
      };
      reader.readAsDataURL(event.data.blob!);
    };
    imageWorker.current.onerror = () => {
      setMessage('Este navegador no pudo procesar la foto.');
      setProcessing(false);
    };
    return () => imageWorker.current?.terminate();
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    if (!photo) {
      setProcessing(false);
      return;
    }
    setProcessing(true);
    const timer = setTimeout(
      () => imageWorker.current?.postMessage({ id, file: photo, zoom, x: cropX, y: cropY }),
      120,
    );
    return () => clearTimeout(timer);
  }, [photo, zoom, cropX, cropY]);

  // SVG / PNG Sprite Auto-Generation Handler
  const handleAutoSpriteUpload = (file: File) => {
    if (!['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'].includes(file.type)) {
      setMessage('Sube un archivo de imagen en formato PNG, SVG o JPG.');
      return;
    }

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
    const updated = [...pixels.current];
    updated[y * 16 + x] = color;
    pixels.current = updated;
    setEditing((c) => ({ ...c, pixels: updated }));
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
    if (mode === 'pixel' && pixels.current.every((p) => p === 'transparent')) {
      setMessage('Dibuja al menos un píxel.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const character: Character = {
        ...editing,
        id: editing.id || crypto.randomUUID(),
        name: editing.name.trim(),
        scale: editing.scale ?? 1.0,
        pixels: pixels.current.some((p) => p !== 'transparent') ? pixels.current : undefined,
        image: editing.image || undefined,
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
                minWidth: '240px',
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
            <button onClick={() => onSelect(c.id)} aria-pressed={selected === c.id}>
              <Avatar character={c} />
              <strong>{c.name}</strong>
              <small>
                {selected === c.id ? (
                  <>
                    <Check size={13} /> En tu equipo
                  </>
                ) : (
                  'Elegir personaje'
                )}
              </small>
            </button>
            {!['pili', 'menta', 'luna'].includes(c.id) && (
              <div className="card-actions">
                <button
                  aria-label={`Editar ${c.name}`}
                  onClick={() => {
                    setEditing(c);
                    setMode(c.image || c.frames ? 'auto_sprite' : 'pixel');
                    setPhoto(undefined);
                    undo.current = [];
                    setMessage('');
                  }}
                >
                  <Paintbrush size={15} />
                </button>
                <button
                  aria-label={`Eliminar ${c.name}`}
                  onClick={() => void onDelete(c.id).catch((e) => setMessage(String(e)))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </article>
        ))}
        <button
          className="new-character"
          onClick={() => {
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
              <canvas
                ref={ref}
                width={320}
                height={320}
                className="pixel-editor"
                aria-label="Lienzo de dibujo de 16 por 16 píxeles"
                onPointerDown={(e) => {
                  drawing.current = true;
                  undo.current = [...undo.current.slice(-19), [...pixels.current]];
                  e.currentTarget.setPointerCapture(e.pointerId);
                  paint(e);
                }}
                onPointerMove={(e) => {
                  if (drawing.current) paint(e);
                }}
                onPointerUp={() => {
                  drawing.current = false;
                }}
                onPointerCancel={() => {
                  drawing.current = false;
                }}
              />
              <div className="palette">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    title={c}
                    aria-label={`Pintar con ${c}`}
                    aria-pressed={color === c}
                    className={color === c ? 'active' : ''}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
                <button
                  aria-label="Borrador"
                  className={color === 'transparent' ? 'active' : ''}
                  onClick={() => setColor('transparent')}
                >
                  <Eraser size={17} />
                </button>
                <button
                  aria-label="Deshacer trazo"
                  onClick={() => {
                    const previous = undo.current.pop();
                    if (previous) {
                      setEditing((c) => ({ ...c, pixels: previous }));
                      pixels.current = previous;
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

          {mode === 'auto_sprite' && <AnimationEditor key={editing.id || 'new'} character={editing}
            onChange={setEditing} onSave={saveMovement} busy={busy || processing} />}

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
                    setZoom(1);
                    setCropX(0.5);
                    setCropY(0.5);
                    setMessage('');
                  }}
                />
              </label>
              {photo && (
                <div className="crop-sliders">
                  <label>
                    Acercamiento
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
                    Posición horizontal
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
                    Posición vertical
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
              )}
            </div>
          )}
        </div>

        <aside className="editor-sidebar">
          <p className="eyebrow">VISTA PREVIA ANIMADA</p>
          <div className="avatar-preview">
            <Avatar
              character={{
                ...editing,
                image: editing.image,
                pixels: editing.pixels,
                frames: editing.frames,
              }}
              showGround
              size={145}
            />
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
          <p className="subtle">
            {mode === 'auto_sprite'
              ? 'Sprite generado automáticamente para animaciones en carrera, saltos y caídas.'
              : mode === 'pixel'
                ? 'Pinta cada píxel, elige tus colores y dale vida en la pista.'
                : 'Ajusta el recorte. La foto se procesa en tu dispositivo.'}
          </p>
          <button className="primary" onClick={() => void save()} disabled={busy || processing}>
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
