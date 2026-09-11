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
} from 'lucide-react';
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
 * Automatically analyze an image or sprite sheet, extract a single character frame,
 * eliminate background noise / checkerboards if present, and produce:
 * 1. A clean 16x16 pixel art array
 * 2. A crisp transparent PNG Data URL for high-res rendering
 */
function processImageToSprite(img: HTMLImageElement): { pixels: string[]; croppedDataUrl: string } {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // Work with a source canvas to read pixels
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

  // Check corner color to detect neutral or checkerboard backgrounds
  const cornerR = (d[0] + d[(srcW - 1) * 4]) / 2;
  const cornerG = (d[1] + d[(srcW - 1) * 4 + 1]) / 2;
  const cornerB = (d[2] + d[(srcW - 1) * 4 + 2]) / 2;

  // Function to classify if a pixel is foreground character vs background
  const isForeground = (x: number, y: number): boolean => {
    const idx = (y * srcW + x) * 4;
    const a = d[idx + 3];
    if (a < 35) return false;

    // Check RGB distance against corner background
    const r = d[idx], g = d[idx + 1], b = d[idx + 2];
    const diffCorner = Math.hypot(r - cornerR, g - cornerG, b - cornerB);
    const lum = (r + g + b) / 3;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    // If opaque sheet without alpha (like assets/1.png), remove flat neutral/gray borders
    if (diffCorner < 28 && chroma < 16 && lum > 120 && lum < 225) {
      return false;
    }
    return true;
  };

  // 1. Detect if this is a sprite sheet (multiple column clusters)
  let cropX = 0;
  let cropY = 0;
  let cropW = srcW;
  let cropH = srcH;

  if (srcW > 250 || srcH > 250) {
    // Column projection
    const colCounts = new Array(srcW).fill(0);
    const stepY = Math.max(1, Math.floor(srcH / 200));
    for (let x = 0; x < srcW; x++) {
      for (let y = 0; y < srcH; y += stepY) {
        if (isForeground(x, y)) colCounts[x]++;
      }
    }

    const colClusters: { x: number; w: number }[] = [];
    let inCol = false;
    let startCol = 0;
    for (let x = 0; x < srcW; x++) {
      if (colCounts[x] > 15 && !inCol) {
        inCol = true;
        startCol = x;
      } else if (colCounts[x] <= 15 && inCol) {
        inCol = false;
        if (x - startCol > 40) colClusters.push({ x: startCol, w: x - startCol });
      }
    }
    if (inCol && srcW - startCol > 40) {
      colClusters.push({ x: startCol, w: srcW - startCol });
    }

    // If multiple clusters found, choose cluster 1 (often main idle pose) or 0
    if (colClusters.length > 0) {
      const chosenCol = colClusters.length > 1 ? colClusters[1] : colClusters[0];
      cropX = chosenCol.x;
      cropW = chosenCol.w;

      // Now row projection within that column cluster
      const rowCounts = new Array(srcH).fill(0);
      for (let y = 0; y < srcH; y++) {
        for (let x = cropX; x < cropX + cropW; x++) {
          if (isForeground(x, y)) rowCounts[y]++;
        }
      }

      const rowClusters: { y: number; h: number }[] = [];
      let inRow = false;
      let startRow = 0;
      for (let y = 0; y < srcH; y++) {
        if (rowCounts[y] > 15 && !inRow) {
          inRow = true;
          startRow = y;
        } else if (rowCounts[y] <= 15 && inRow) {
          inRow = false;
          if (y - startRow > 40) rowClusters.push({ y: startRow, h: y - startRow });
        }
      }
      if (inRow && srcH - startRow > 40) {
        rowClusters.push({ y: startRow, h: srcH - startRow });
      }

      if (rowClusters.length > 0) {
        cropY = rowClusters[0].y;
        cropH = rowClusters[0].h;
      }
    }
  }

  // 2. Render isolated sprite into cropped canvas with transparent background
  const croppedCanvas = document.createElement('canvas');
  const maxDim = Math.max(cropW, cropH);
  croppedCanvas.width = maxDim;
  croppedCanvas.height = maxDim;
  const croppedCtx = croppedCanvas.getContext('2d', { willReadFrequently: true });

  if (croppedCtx) {
    const offsetX = Math.floor((maxDim - cropW) / 2);
    const offsetY = Math.floor((maxDim - cropH) / 2);
    croppedCtx.drawImage(
      fullCanvas,
      cropX,
      cropY,
      cropW,
      cropH,
      offsetX,
      offsetY,
      cropW,
      cropH,
    );

    // Clean background pixels in cropped area
    const croppedImgData = croppedCtx.getImageData(0, 0, maxDim, maxDim);
    const cd = croppedImgData.data;
    for (let y = 0; y < maxDim; y++) {
      for (let x = 0; x < maxDim; x++) {
        const origX = cropX + (x - offsetX);
        const origY = cropY + (y - offsetY);
        const idx = (y * maxDim + x) * 4;
        if (origX < cropX || origX >= cropX + cropW || origY < cropY || origY >= cropY + cropH) {
          cd[idx + 3] = 0;
        } else if (!isForeground(origX, origY)) {
          cd[idx + 3] = 0;
        }
      }
    }
    croppedCtx.putImageData(croppedImgData, 0, 0);
  }

  // 3. Generate 16x16 pixel art representation
  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width = 16;
  pixelCanvas.height = 16;
  const pCtx = pixelCanvas.getContext('2d', { willReadFrequently: true });
  const sampled: string[] = [];

  if (pCtx) {
    pCtx.drawImage(croppedCanvas, 0, 0, 16, 16);
    const pData = pCtx.getImageData(0, 0, 16, 16).data;
    for (let i = 0; i < 256; i++) {
      const idx = i * 4;
      const r = pData[idx];
      const g = pData[idx + 1];
      const b = pData[idx + 2];
      const a = pData[idx + 3];

      if (a < 65) {
        sampled.push('transparent');
      } else {
        sampled.push(findClosestPaletteColor(r, g, b));
      }
    }
  }

  return {
    pixels: sampled.length === 256 ? sampled : defaultPixels(),
    croppedDataUrl: croppedCanvas.toDataURL('image/png'),
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
    setMessage('Analizando vector/sprite y recortando personaje…');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        try {
          const { pixels: generatedPixels, croppedDataUrl } = processImageToSprite(img);
          setEditing((prev) => ({
            ...prev,
            image: croppedDataUrl || dataUrl,
            pixels: generatedPixels,
          }));
          pixels.current = generatedPixels;
          setProcessing(false);
          setMessage('¡Sprite aislado y avatar generados con éxito! Puedes retocarlo en pixel art.');
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
        pixels: pixels.current.some((p) => p !== 'transparent') ? pixels.current : undefined,
        image: editing.image || undefined,
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

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">CREACIÓN DE SPRITES Y PERSONAJES</p>
          <h1>Tu taller de exploradores.</h1>
          <p>Dibuja en pixel art, elige una plantilla o sube un SVG/PNG para generar tu sprite.</p>
        </div>
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
                    setMode(c.image ? 'auto_sprite' : 'pixel');
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
          <div>
            <strong>Guía de creación y sprites de /assets</strong>
            <p>Elige una plantilla lista para usar, prueba los sprites oficiales de <code>/assets</code> o sube tu PNG/SVG para vectorizarlo y extraerlo automáticamente.</p>
          </div>
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
                    const { pixels: generatedPixels, croppedDataUrl } = processImageToSprite(img);
                    setEditing((prev) => ({
                      ...prev,
                      name: preset.name,
                      image: croppedDataUrl || preset.src,
                      pixels: generatedPixels,
                      frames: (preset as { frames?: Character['frames'] }).frames,
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
              }}
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
    </>
  );
}
