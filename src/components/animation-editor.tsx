'use client';
import { useState } from 'react';
import type { Character } from '@/lib/types';
import { frameScale } from '@/lib/sprite-geometry';
import { Avatar } from './art';

export type Movement = keyof NonNullable<Character['frames']>;
const MOVEMENTS: Record<Movement, string> = {
  idle: 'Reposo',
  run: 'Carrera',
  jump: 'Salto / caída',
  slide: 'Agachado / deslizamiento',
};

export function AnimationEditor({
  character,
  onChange,
  onSave,
  busy,
}: {
  character: Character;
  onChange: (character: Character) => void;
  onSave: (movement: Movement) => Promise<void>;
  busy: boolean;
}) {
  const [movement, setMovement] = useState<Movement>('run');
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    onChange({ ...character, frames: { ...character.frames, [movement]: next }, frameScales: { ...character.frameScales, [movement]: nextScales } });
  const resize = (value: number) => {
    if (!Number.isFinite(value)) return;
    update(frames, scales.map((scale, i) => i === index ? Math.max(0.25, Math.min(3, value)) : scale));
    setPlaying(false);
  };
  const replace = (src: string) => update(frames.map((frame, i) => (i === index ? src : frame)));
  const move = (offset: number) => {
    const next = [...frames];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    const nextScales = [...scales];
    [nextScales[index], nextScales[index + offset]] = [nextScales[index + offset], nextScales[index]];
    update(next, nextScales);
    setSelected(index + offset);
  };
  async function upload(file: File, replacing: boolean) {
    setLoading(true);
    setError('');
    try {
      if (
        file.size > 8 * 1024 * 1024 ||
        !['image/png', 'image/webp', 'image/jpeg', 'image/svg+xml'].includes(file.type)
      )
        throw new Error('Usa PNG, WebP, JPG o SVG de hasta 8 MB.');
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 40_000_000)
        throw new Error('La imagen supera 40 megapíxeles.');
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
      setError(e instanceof Error ? e.message : 'No se pudo cargar el fotograma.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="animation-editor" aria-label="Editor de animaciones">
      <h2>Editar animaciones</h2>
      <p>Revisa cada movimiento, corrige sus fotogramas y guarda esa animación.</p>
      <fieldset disabled={busy || loading}>
        <label>
          Movimiento
          <select
            aria-label="Movimiento"
            value={movement}
            onChange={(e) => {
              setMovement(e.target.value as Movement);
              setSelected(0);
            }}
          >
            {Object.entries(MOVEMENTS).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="animation-preview">
          <Avatar
            character={character}
            movement={movement}
            frameIndex={playing ? undefined : index}
            showGround
            previewZoom={previewZoom}
            size={240}
          />
          <button type="button" onClick={() => setPlaying(!playing)}>
            {playing ? 'Pausar animación' : 'Reproducir animación'}
          </button>
        </div>
        <label>
          Zoom de la vista previa: {Math.round(previewZoom * 100)} %
          <input type="range" aria-label="Zoom de la vista previa" min="25" max="100" step="5" value={previewZoom * 100} onChange={(event) => setPreviewZoom(Number(event.target.value) / 100)} />
        </label>
        <ol className="animation-frames">
          {frames.map((src, i) => (
            <li key={i}>
              <button
                type="button"
                aria-label={`Fotograma ${i + 1}`}
                aria-pressed={index === i}
                onClick={() => {
                  setSelected(i);
                  setPlaying(false);
                }}
              >
                <img src={src} alt="" />
                <span>{i + 1}</span>
              </button>
            </li>
          ))}
        </ol>
        {!frames.length && <p>Sin fotogramas. Añade una imagen o reutiliza una del personaje.</p>}
        <div className="animation-actions">
          <button type="button" disabled={!source || index === 0} onClick={() => move(-1)}>
            Mover antes
          </button>
          <button
            type="button"
            disabled={!source || index === frames.length - 1}
            onClick={() => move(1)}
          >
            Mover después
          </button>
          <button
            type="button"
            disabled={!source}
            onClick={() => update(frames.filter((_, i) => i !== index), scales.filter((_, i) => i !== index))}
          >
            Quitar fotograma
          </button>
        </div>
        <label>
          Añadir fotograma
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg,image/svg+xml"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void upload(file, false);
            }}
          />
        </label>
        {source && (
          <>
            <label>Tamaño del fotograma (%)
              <input type="number" min="25" max="300" step="5" value={Math.round(scales[index] * 100)} onChange={(e) => resize(Number(e.target.value) / 100)} />
            </label>
            <input aria-label="Ajustar tamaño del fotograma" type="range" min="25" max="300" step="5" value={Math.round(scales[index] * 100)} onChange={(e) => resize(Number(e.target.value) / 100)} />
            <button type="button" onClick={() => resize(1)}>Restablecer tamaño</button>
            <p>El tamaño de este fotograma es visual. Los pies y la caja de colisión conservan su posición.</p>
            <label>
              Reemplazar fotograma seleccionado
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void upload(file, true);
                }}
              />
            </label>
            <label>
              Posición de los pies (% de altura de la imagen)
              <input
                type="number"
                min="1"
                max="100"
                step="0.1"
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
            <p>
              Deja el campo vacío para detectar los pies. Si la imagen incluye una sombra, ajusta el
              porcentaje hasta que los pies toquen la línea.
            </p>
          </>
        )}
        {allFrames.length > 0 && (
          <label>
            Reutilizar fotograma del personaje
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) update([...frames, e.target.value]);
              }}
            >
              <option value="">Selecciona una imagen para añadir</option>
              {allFrames.map((src, i) => (
                <option key={src} value={src}>
                  Imagen {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="primary" onClick={() => void onSave(movement)}>
          Guardar animación: {MOVEMENTS[movement]}
        </button>
      </fieldset>
      <p role="status">{loading ? 'Cargando fotograma…' : error}</p>
    </section>
  );
}
