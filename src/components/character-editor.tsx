'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Eraser, Paintbrush, Plus, Save, Trash2, Upload, Undo2 } from 'lucide-react';
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
  '#ffffff',
  '#1c2524',
];
function defaultPixels() {
  const pixels = Array<string>(256).fill('transparent');
  const rows = [
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
  ];
  const colors: Record<string, string> = { o: '#ec9565', k: '#243b32', f: '#fff3d7', g: '#315c49' };
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
  const [mode, setMode] = useState<'pixel' | 'photo'>('pixel');
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
      setMessage('Este navegador no pudo procesar la foto. Puedes usar pixel art.');
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
  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect(),
      x = Math.floor(((e.clientX - rect.left) / rect.width) * 16),
      y = Math.floor(((e.clientY - rect.top) / rect.height) * 16);
    if (x < 0 || x > 15 || y < 0 || y > 15) return;
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
      const character = {
        ...editing,
        id: editing.id || crypto.randomUUID(),
        name: editing.name.trim(),
        pixels: mode === 'pixel' ? pixels.current : undefined,
        image: mode === 'photo' ? editing.image : undefined,
      };
      await onSave(character);
      setEditing(character);
      setMessage('Tu personaje está listo para correr.');
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
          <p className="eyebrow">HECHO A TU MANERA</p>
          <h1>Pequeños protagonistas.</h1>
          <p>Elige a tu compañero o dibuja uno que sólo exista aquí.</p>
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
                    setMode(c.image ? 'photo' : 'pixel');
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
            setMessage('Nuevo personaje: dale tu toque.');
            undo.current = [];
          }}
        >
          <Plus size={26} />
          <strong>Una nueva personalidad</strong>
          <span>Tu imaginación corre libre</span>
        </button>
      </div>
      <div className="editor-card">
        <div className="editor-main">
          <div className="section-heading compact">
            <h2>Tu taller de personajes</h2>
            <div className="segmented">
              <button className={mode === 'pixel' ? 'active' : ''} onClick={() => setMode('pixel')}>
                Pixel art
              </button>
              <button className={mode === 'photo' ? 'active' : ''} onClick={() => setMode('photo')}>
                Fotografía
              </button>
            </div>
          </div>
          {mode === 'pixel' ? (
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
                    if (previous) setEditing((c) => ({ ...c, pixels: previous }));
                  }}
                >
                  <Undo2 size={17} />
                </button>
              </div>
              <details className="keyboard-pixels">
                <summary>Editor accesible con teclado</summary>
                <div className="accessible-grid">
                  {(editing.pixels ?? []).map((c, i) => (
                    <button
                      key={i}
                      style={{ background: c === 'transparent' ? '#fff' : c }}
                      aria-label={`Fila ${Math.floor(i / 16) + 1}, columna ${(i % 16) + 1}`}
                      onClick={() => {
                        const next = [...pixels.current];
                        undo.current.push([...next]);
                        next[i] = color;
                        pixels.current = next;
                        setEditing((current) => ({ ...current, pixels: next }));
                      }}
                    />
                  ))}
                </div>
              </details>
            </>
          ) : (
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
                    if (
                      file.size > 8 * 1024 * 1024 ||
                      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
                    ) {
                      setMessage('Elige una imagen JPG, PNG o WebP de hasta 8 MB.');
                      return;
                    }
                    setPhoto(file);
                    setZoom(1);
                    setCropX(0.5);
                    setCropY(0.5);
                    setMessage('');
                  }}
                />
              </label>
              {editing.image && (
                <div className="crop-preview">
                  <Avatar character={editing} size={150} />
                </div>
              )}
              {photo && (
                <div className="crop-sliders">
                  <label>
                    Acercamiento
                    <input
                      aria-label="Acercamiento"
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
          <p className="eyebrow">VISTA PREVIA</p>
          <div className="avatar-preview">
            <Avatar
              character={{
                ...editing,
                image: mode === 'photo' ? editing.image : undefined,
                pixels: mode === 'pixel' ? editing.pixels : undefined,
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
            {mode === 'pixel'
              ? 'Pinta cada píxel, elige tus colores y dale vida en la pista.'
              : 'Ajusta el recorte. La foto se procesa y se queda en tu dispositivo.'}
          </p>
          <button className="primary" onClick={() => void save()} disabled={busy || processing}>
            <Save size={17} />{' '}
            {processing ? 'Procesando foto…' : busy ? 'Guardando…' : 'Guardar personaje'}
          </button>
          <p className="form-message" role="status">
            {message}
          </p>
        </aside>
      </div>
    </>
  );
}
