'use client';
import { useState, useRef } from 'react';
import type { Character } from '@/lib/types';
import { frameScale } from '@/lib/sprite-geometry';
import { Avatar } from './art';
import {
  Copy,
  Paintbrush,
  Plus,
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Upload,
  RotateCcw,
  Sparkles,
  Check,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  Layers,
} from 'lucide-react';

export type Movement = keyof NonNullable<Character['frames']>;

interface MovementInfo {
  name: string;
  emoji: string;
  description: string;
  color: string;
}

const MOVEMENTS: Record<Movement, MovementInfo> = {
  run: {
    name: 'Correr',
    emoji: '🏃',
    description: '¡El movimiento principal de la carrera!',
    color: '#38bdf8',
  },
  jump: {
    name: 'Saltar',
    emoji: '🦘',
    description: 'Cuando sube por el aire o cae.',
    color: '#facc15',
  },
  slide: {
    name: 'Deslizar',
    emoji: '🛝',
    description: 'Agacharse bajo ramas o túneles.',
    color: '#4ade80',
  },
  idle: {
    name: 'Parado',
    emoji: '🧍',
    description: 'Cuando espera o está descansando.',
    color: '#c084fc',
  },
};

export function AnimationEditor({
  character,
  onChange,
  onSave,
  busy,
  onEditFrameInCanvas,
}: {
  character: Character;
  onChange: (character: Character) => void;
  onSave: (movement: Movement) => Promise<void>;
  busy: boolean;
  onEditFrameInCanvas?: (movement: Movement, frameIndex: number, frameDataUrl?: string) => void;
}) {
  const [movement, setMovement] = useState<Movement>('run');
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const frames = character.frames?.[movement] ?? [];
  const index = Math.min(selected, Math.max(0, frames.length - 1));
  const source = frames[index];

  const allFrames = [
    ...new Set(
      [character.image, ...Object.values(character.frames ?? {}).flat()].filter(
        (s): s is string => !!s,
      ),
    ),
  ];

  const scales = frames.map((_, i) => frameScale(character, movement, i));

  const update = (next: string[], nextScales = next.map((_, i) => scales[i] ?? 1)) =>
    onChange({
      ...character,
      frames: { ...character.frames, [movement]: next },
      frameScales: { ...character.frameScales, [movement]: nextScales },
    });

  const resize = (value: number) => {
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(0.25, Math.min(3, value));
    update(frames, scales.map((scale, i) => (i === index ? clamped : scale)));
    setPlaying(false);
  };

  const adjustSizeStep = (delta: number) => {
    const current = scales[index] ?? 1;
    resize(Number((current + delta).toFixed(2)));
  };

  const replace = (src: string) =>
    update(frames.map((frame, i) => (i === index ? src : frame)));

  const move = (offset: number) => {
    const targetIdx = index + offset;
    if (targetIdx < 0 || targetIdx >= frames.length) return;
    const next = [...frames];
    [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
    const nextScales = [...scales];
    [nextScales[index], nextScales[targetIdx]] = [nextScales[targetIdx], nextScales[index]];
    update(next, nextScales);
    setSelected(targetIdx);
  };

  const duplicateFrame = () => {
    if (!source) return;
    const nextFrames = [...frames.slice(0, index + 1), source, ...frames.slice(index + 1)];
    const nextScales = [...scales.slice(0, index + 1), scales[index] ?? 1, ...scales.slice(index + 1)];
    update(nextFrames, nextScales);
    setSelected(index + 1);
  };

  const removeFrame = (frameIndexToRemove = index) => {
    if (frames.length === 0) return;
    const nextFrames = frames.filter((_, i) => i !== frameIndexToRemove);
    const nextScales = scales.filter((_, i) => i !== frameIndexToRemove);
    update(nextFrames, nextScales);
    setSelected(Math.max(0, Math.min(index, nextFrames.length - 1)));
  };

  async function upload(file: File, replacing: boolean) {
    setLoading(true);
    setError('');
    try {
      if (
        file.size > 8 * 1024 * 1024 ||
        !['image/png', 'image/webp', 'image/jpeg', 'image/svg+xml'].includes(file.type)
      ) {
        throw new Error('Usa una imagen PNG, WebP o JPG.');
      }
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 40_000_000) {
        throw new Error('La imagen es demasiado grande.');
      }
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      const normalized = canvas.toDataURL('image/png');
      if (replacing) replace(normalized);
      else {
        update([...frames, normalized]);
        setSelected(frames.length);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la foto.');
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    try {
      await onSave(movement);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2600);
    } catch {
      // Error handled by parent
    }
  };

  const currentMov = MOVEMENTS[movement];

  return (
    <section className="kid-animation-editor" aria-label="Editor de animaciones para niños">
      {/* Header with cheerful title */}
      <div className="kid-editor-header">
        <div className="kid-header-title">
          <span className="kid-title-badge">🎨 Estudio de Animación</span>
          <h2>¡Crea cómo se mueve tu personaje!</h2>
          <p>Elige qué movimiento quieres diseñar y agrega las fotos en orden como un cómic.</p>
        </div>
      </div>

      <fieldset disabled={busy || loading} className="kid-editor-fieldset">
        {/* Big colorful Movement Cards */}
        <div className="kid-movement-grid" role="tablist" aria-label="Selecciona el movimiento">
          {(Object.keys(MOVEMENTS) as Movement[]).map((key) => {
            const info = MOVEMENTS[key];
            const isSelected = movement === key;
            const count = character.frames?.[key]?.length ?? 0;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`kid-movement-card ${isSelected ? 'active' : ''}`}
                style={{ '--accent-color': info.color } as React.CSSProperties}
                onClick={() => {
                  setMovement(key);
                  setSelected(0);
                  setPlaying(true);
                }}
              >
                <span className="kid-card-emoji">{info.emoji}</span>
                <span className="kid-card-name">{info.name}</span>
                <span className="kid-card-count">
                  {count === 0 ? 'Sin fotos' : `${count} ${count === 1 ? 'foto' : 'fotos'}`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Character Preview Stage */}
        <div className="kid-preview-stage">
          <div className="kid-stage-canvas-area">
            <Avatar
              character={character}
              movement={movement}
              frameIndex={playing ? undefined : index}
              showGround
              previewZoom={previewZoom}
              size={240}
            />
          </div>

          {/* Player controls */}
          <div className="kid-preview-toolbar">
            <button
              type="button"
              className={`kid-play-toggle ${playing ? 'playing' : 'paused'}`}
              onClick={() => setPlaying(!playing)}
              title={playing ? 'Pausar animación' : 'Ver animación en movimiento'}
            >
              {playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
              <span>{playing ? 'Pausar' : 'Probar'}</span>
            </button>

            {/* Speed selector for kids */}
            <div className="kid-speed-selector" title="Velocidad del movimiento">
              <button
                type="button"
                className={`kid-speed-btn ${speed === 'slow' ? 'active' : ''}`}
                onClick={() => setSpeed('slow')}
              >
                🐢 Lento
              </button>
              <button
                type="button"
                className={`kid-speed-btn ${speed === 'normal' ? 'active' : ''}`}
                onClick={() => setSpeed('normal')}
              >
                🐇 Normal
              </button>
              <button
                type="button"
                className={`kid-speed-btn ${speed === 'fast' ? 'active' : ''}`}
                onClick={() => setSpeed('fast')}
              >
                ⚡ Rápido
              </button>
            </div>

            {/* Zoom controls */}
            <div className="kid-zoom-controls">
              <button
                type="button"
                className="kid-icon-btn"
                title="Alejar vista"
                onClick={() => setPreviewZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
              >
                <ZoomOut size={16} />
              </button>
              <span className="kid-zoom-text">{Math.round(previewZoom * 100)}%</span>
              <button
                type="button"
                className="kid-icon-btn"
                title="Acercar vista"
                onClick={() => setPreviewZoom((z) => Math.min(1.4, Number((z + 0.15).toFixed(2))))}
              >
                <ZoomIn size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Filmstrip / Timeline */}
        <div className="kid-filmstrip-section">
          <div className="kid-filmstrip-header">
            <h3>🎬 Tira de fotos ({frames.length})</h3>
            <span className="kid-filmstrip-hint">
              Toca una foto para verla o cambiarla de lugar
            </span>
          </div>

          <div className="kid-filmstrip-scroll">
            <ol className="kid-filmstrip-track">
              {frames.map((src, i) => (
                <li key={i} className="kid-filmstrip-item">
                  <button
                    type="button"
                    className={`kid-frame-card ${index === i ? 'selected' : ''}`}
                    aria-label={`Foto número ${i + 1}`}
                    aria-pressed={index === i}
                    onClick={() => {
                      setSelected(i);
                      setPlaying(false);
                    }}
                  >
                    <span className="kid-frame-badge">{i + 1}</span>
                    <img src={src} alt={`Fotograma ${i + 1}`} />
                  </button>
                </li>
              ))}

              {/* Direct Add Buttons at the end of the filmstrip */}
              <li className="kid-filmstrip-add-slot">
                {onEditFrameInCanvas && (
                  <button
                    type="button"
                    className="kid-add-card draw-new"
                    title="Dibujar una foto nueva en el lienzo"
                    onClick={() => onEditFrameInCanvas(movement, frames.length, undefined)}
                  >
                    <Paintbrush size={22} />
                    <span>Dibujar nueva</span>
                  </button>
                )}
                <button
                  type="button"
                  className="kid-add-card upload-new"
                  title="Subir una foto desde la computadora o tablet"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus size={22} />
                  <span>Subir foto</span>
                </button>
              </li>
            </ol>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/webp,image/jpeg,image/svg+xml"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void upload(file, false);
            }}
          />

          {!frames.length && (
            <div className="kid-empty-frames">
              <span className="kid-empty-emoji">🌟</span>
              <p>¡Aún no hay fotos para {currentMov.name.toLowerCase()}!</p>
              <p>Usa los botones arriba para <strong>Dibujar</strong> o <strong>Subir</strong> tu primera foto.</p>
            </div>
          )}

          {/* Quick frame actions for selected frame */}
          {source && (
            <div className="kid-frame-toolbar">
              <div className="kid-toolbar-group">
                <button
                  type="button"
                  className="kid-tool-btn"
                  disabled={index === 0}
                  onClick={() => move(-1)}
                  title="Mover foto a la izquierda"
                >
                  <ArrowLeft size={16} /> Mover antes
                </button>
                <button
                  type="button"
                  className="kid-tool-btn"
                  disabled={index === frames.length - 1}
                  onClick={() => move(1)}
                  title="Mover foto a la derecha"
                >
                  Mover después <ArrowRight size={16} />
                </button>
              </div>

              <div className="kid-toolbar-group">
                <button
                  type="button"
                  className="kid-tool-btn highlight"
                  onClick={duplicateFrame}
                  title="Duplicar esta foto para hacer una variación"
                >
                  <Copy size={16} /> Duplicar
                </button>

                {onEditFrameInCanvas && (
                  <button
                    type="button"
                    className="kid-tool-btn paint"
                    onClick={() => onEditFrameInCanvas(movement, index, source)}
                    title="Retocar esta foto en el lienzo de dibujo"
                  >
                    <Paintbrush size={16} /> Retocar dibujo
                  </button>
                )}

                <button
                  type="button"
                  className="kid-tool-btn danger"
                  onClick={() => removeFrame(index)}
                  title="Borrar esta foto"
                >
                  <Trash2 size={16} /> Borrar foto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Kid-friendly Size Adjuster */}
        {source && (
          <div className="kid-size-box">
            <span className="kid-size-label">
              📏 Tamaño de la foto {index + 1}: <strong>{Math.round((scales[index] ?? 1) * 100)}%</strong>
            </span>
            <div className="kid-size-buttons">
              <button
                type="button"
                className="kid-size-btn"
                onClick={() => adjustSizeStep(-0.1)}
                title="Hacer un poco más pequeña"
              >
                ➖ Más pequeña
              </button>
              <button
                type="button"
                className="kid-size-btn reset"
                onClick={() => resize(1)}
                title="Volver al tamaño normal"
              >
                <RotateCcw size={14} /> Normal
              </button>
              <button
                type="button"
                className="kid-size-btn"
                onClick={() => adjustSizeStep(0.1)}
                title="Hacer un poco más grande"
              >
                ➕ Más grande
              </button>
            </div>
          </div>
        )}

        {/* Re-use character frames */}
        {allFrames.length > 0 && (
          <div className="kid-reuse-box">
            <label className="kid-reuse-label">
              <Layers size={16} />
              <span>Usar otra foto existente del personaje:</span>
            </label>
            <select
              className="kid-reuse-select"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  update([...frames, e.target.value]);
                  setSelected(frames.length);
                }
              }}
            >
              <option value="">➕ Elige una foto ya creada para añadirla aquí...</option>
              {allFrames.map((src, i) => (
                <option key={src} value={src}>
                  Foto {i + 1}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Advanced adjustments (Collapsed for kids) */}
        {source && (
          <details className="kid-advanced-details">
            <summary className="kid-advanced-summary">
              <SlidersHorizontal size={14} /> Ajustes avanzados (Pies en el suelo y reemplazar)
            </summary>
            <div className="kid-advanced-content">
              <label className="kid-adv-field">
                <span>Altura de apoyo de los pies (%):</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.5"
                  placeholder="Automática"
                  value={
                    character.frameBaselines?.[source] === undefined
                      ? ''
                      : Math.round(character.frameBaselines[source] * 1000) / 10
                  }
                  onChange={(e) => {
                    const next = { ...character.frameBaselines };
                    if (!e.target.value) delete next[source];
                    else next[source] = Math.max(0.01, Math.min(1, Number(e.target.value) / 100));
                    onChange({ ...character, frameBaselines: next });
                    setPlaying(false);
                  }}
                />
              </label>

              <button
                type="button"
                className="kid-replace-btn"
                onClick={() => replaceInputRef.current?.click()}
              >
                <Upload size={14} /> Reemplazar esta foto por archivo
              </button>
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/png,image/webp,image/jpeg,image/svg+xml"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void upload(file, true);
                }}
              />
            </div>
          </details>
        )}

        {/* Big Prominent Save Button */}
        <div className="kid-save-section">
          <button
            type="button"
            className={`kid-big-save-btn ${savedToast ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={busy || loading}
          >
            {savedToast ? <Check size={22} /> : <Sparkles size={22} />}
            <span>
              {savedToast
                ? `¡Guardado con éxito!`
                : `✨ ¡Guardar animación de ${currentMov.name}!`}
            </span>
          </button>
        </div>
      </fieldset>

      {error && <p className="kid-error-message" role="alert">{error}</p>}
    </section>
  );
}
