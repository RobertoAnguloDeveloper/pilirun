'use client';
import { useState } from 'react';
import {
  Coins,
  Flag,
  Mountain,
  Plus,
  Save,
  Shield,
  Timer,
  Trash2,
  TreePine,
  Zap,
  Play,
  Pencil,
  Sparkles,
  CircleDot,
} from 'lucide-react';
import type { ItemKind, Track, WorldId } from '@/lib/types';
import { validateTrack, WORLDS } from '@/lib/worlds';
import { Landscape } from './art';
const TOOLS = [
  { kind: 'log', label: 'Tronco', icon: TreePine },
  { kind: 'rock', label: 'Roca', icon: Mountain },
  { kind: 'branch', label: 'Rama alta', icon: Flag },
  { kind: 'spring', label: 'Resorte Vertical', icon: Sparkles },
  { kind: 'ring', label: 'Aro Aéreo', icon: CircleDot },
  { kind: 'coin', label: 'Moneda', icon: Coins },
  { kind: 'shield', label: 'Escudo', icon: Shield },
  { kind: 'boost', label: 'Impulso', icon: Zap },
  { kind: 'time', label: 'Tiempo', icon: Timer },
] as const;
const blank = (): Track => ({
  id: '',
  name: 'Mi sendero secreto',
  world: 'forest',
  length: 9000,
  items: [],
  custom: true,
});
export function TrackBuilder({
  tracks,
  onSave,
  onDelete,
  onPlay,
}: {
  tracks: Track[];
  onSave: (t: Track) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPlay: (t: Track) => void;
}) {
  const [draft, setDraft] = useState<Track>(blank),
    [tool, setTool] = useState<ItemKind>('log'),
    [position, setPosition] = useState(600),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const add = (x: number) => {
    if (draft.items.length >= 200) {
      setMessage('La pista admite hasta 200 elementos.');
      return;
    }
    setDraft((t) => ({
      ...t,
      items: [...t.items, { id: crypto.randomUUID(), kind: tool, x }].sort((a, b) => a.x - b.x),
    }));
    setMessage('');
  };
  const save = async () => {
    const error = validateTrack(draft);
    if (error) {
      setMessage(error);
      return;
    }
    setBusy(true);
    try {
      const track = { ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim() };
      await onSave(track);
      setDraft(track);
      setMessage('Tu pista ya forma parte de la aventura.');
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
          <p className="eyebrow">EL CAMINO LO DIBUJAS TÚ</p>
          <h1>Construye la próxima aventura.</h1>
          <p>Un bosque, unas monedas y esa curva que nadie se espera.</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setDraft(blank());
            setMessage('');
          }}
        >
          <Plus size={17} /> Nueva pista
        </button>
      </div>
      <div className="builder-card">
        <div className="builder-fields">
          <label>
            Nombre de la pista
            <input
              maxLength={40}
              value={draft.name}
              onChange={(e) => setDraft((t) => ({ ...t, name: e.target.value }))}
            />
          </label>
          <label>
            Escenario
            <select
              value={draft.world}
              onChange={(e) => setDraft((t) => ({ ...t, world: e.target.value as WorldId }))}
            >
              {Object.entries(WORLDS).map(([id, w]) => (
                <option key={id} value={id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Distancia
            <select
              value={draft.length}
              onChange={(e) => {
                const length = Number(e.target.value);
                setDraft((t) => ({
                  ...t,
                  length,
                  items: t.items.filter((i) => i.x <= length - 150),
                }));
                setPosition(600);
              }}
            >
              <option value={3000}>300 metros</option>
              <option value={6000}>600 metros</option>
              <option value={9000}>900 metros</option>
              <option value={15000}>1.500 metros</option>
              <option value={30000}>3.000 metros</option>
            </select>
          </label>
        </div>
        <div className="builder-preview">
          <Landscape world={draft.world} />
          <div className="builder-preview-label">
            <span className="pill">TU MUNDO</span>
            <h2>{draft.name || 'Tu próxima aventura'}</h2>
            <p>
              {draft.length / 10} m · {draft.items.length} elementos
            </p>
          </div>
        </div>
        <div className="builder-workspace">
          <p className="eyebrow">1. ELIGE UN ELEMENTO</p>
          <div className="builder-tools">
            {TOOLS.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                aria-pressed={tool === kind}
                className={tool === kind ? 'active' : ''}
                onClick={() => setTool(kind)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">2. DALE UN LUGAR EN LA PISTA</p>
              <p>Selecciona una posición y añade. Pulsa un elemento para retirarlo.</p>
            </div>
            <span className="subtle">Salida → Meta</span>
          </div>
          <div className="timeline" role="group" aria-label="Elementos de la pista">
            <div className="timeline-line" />
            {draft.items.map((item) => {
              const itemTool = TOOLS.find((t) => t.kind === item.kind)!;
              const Icon = itemTool.icon;
              return (
                <button
                  key={item.id}
                  aria-label={`Quitar ${itemTool.label} a ${item.x / 10} metros`}
                  title={`${itemTool.label} · ${item.x / 10} m`}
                  style={{ left: `${(item.x / draft.length) * 96 + 2}%` }}
                  onClick={() =>
                    setDraft((t) => ({ ...t, items: t.items.filter((i) => i.id !== item.id) }))
                  }
                >
                  <Icon size={16} />
                </button>
              );
            })}
            <Flag className="timeline-start" size={18} />
            <Flag className="timeline-end" size={18} />
          </div>
          <div className="position-control">
            <label>
              Posición: <strong>{position / 10} m</strong>
              <input
                aria-label="Posición del elemento"
                type="range"
                min={400}
                max={draft.length - 150}
                step={50}
                value={position}
                onChange={(e) => setPosition(Number(e.target.value))}
              />
            </label>
            <button className="secondary" onClick={() => add(position)}>
              <Plus size={17} /> Añadir {TOOLS.find((t) => t.kind === tool)!.label.toLowerCase()}
            </button>
          </div>
          <p className="subtle">
            Reserva al menos 42 m entre obstáculos. Los checkpoints se añaden cada 300 m.
          </p>
          <div className="builder-footer">
            <p role="status" className="form-message">
              {message}
            </p>
            <button
              className="secondary"
              onClick={() => {
                const error = validateTrack(draft);
                if (error) setMessage(error);
                else onPlay({ ...draft, id: draft.id || 'preview' });
              }}
            >
              <Play size={17} /> Probar pista
            </button>
            <button className="primary" disabled={busy} onClick={() => void save()}>
              <Save size={17} /> {busy ? 'Guardando…' : 'Guardar pista'}
            </button>
          </div>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>Tus senderos</h2>
          <p>Creaciones guardadas en este dispositivo.</p>
        </div>
        <span className="count-badge">{tracks.length}</span>
      </div>
      {tracks.length ? (
        <div className="saved-tracks">
          {tracks.map((track) => (
            <article key={track.id}>
              <Landscape world={track.world} />
              <div>
                <h3>{track.name}</h3>
                <p>
                  {track.length / 10} m · {track.items.length} elementos
                </p>
              </div>
              <button
                className="icon-button"
                aria-label={`Editar ${track.name}`}
                onClick={() => {
                  setDraft(track);
                  setPosition(600);
                  setMessage('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <Pencil size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={`Jugar ${track.name}`}
                onClick={() => onPlay(track)}
              >
                <Play size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={`Eliminar ${track.name}`}
                onClick={() => void onDelete(track.id).catch((e) => setMessage(String(e)))}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <TreePine />
          <h3>Aquí empieza un camino nuevo.</h3>
          <p>Tu primera pista aparecerá aquí cuando la guardes.</p>
        </div>
      )}
    </>
  );
}
