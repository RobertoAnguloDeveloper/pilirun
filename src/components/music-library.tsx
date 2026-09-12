'use client';
import { MAX_AUDIO_BYTES, readAudioDuration } from '@/lib/music';
import { useState } from 'react';
import { Music2, Pause, Play, Trash2, Upload, Volume2, AudioLines } from 'lucide-react';
import { audioEngine } from '@/lib/audio';
import { localStore } from '@/lib/storage';
import type { AudioTrack, Preferences } from '@/lib/types';
export function MusicLibrary({
  music,
  preferences,
  active,
  setActive,
  onAdd,
  onDelete,
  onPreferences,
}: {
  music: AudioTrack[];
  preferences: Preferences;
  active: string | null;
  setActive: (id: string | null) => void;
  onAdd: (t: AudioTrack, blob: Blob) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPreferences: (p: Preferences) => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState<{ file: File; duration: number }>(),
    [start, setStart] = useState(0),
    [end, setEnd] = useState(0);
  const [category, setCategory] = useState<'adventure' | 'boss' | 'chill' | 'retro' | 'custom'>('adventure');
  const play = async (track?: AudioTrack) => {
    try {
      if (active === (track?.id ?? 'ambient')) {
        audioEngine.stop();
        setActive(null);
        return;
      }
      setBusy(true);
      await audioEngine.unlock();
      if (track) {
        const blob = await localStore.request<Blob>({ action: 'music-get', id: track.id });
        await audioEngine.play({ track, blob });
      } else await audioEngine.play();
      setActive(track?.id ?? 'ambient');
      setMessage('');
    } catch {
      setMessage('No se pudo reproducir este audio. Prueba otro archivo.');
    } finally {
      setBusy(false);
    }
  };
  const choose = async (file?: File) => {
    if (!file) return;
    setPending(undefined);
    if (
      file.size > MAX_AUDIO_BYTES ||
      !(/^(audio\/|video\/mp4)/.test(file.type) || /\.(mp3|mp4|ogg|wav|m4a)$/i.test(file.name))
    ) {
      setMessage('Elige un archivo MP3, MP4, OGG o WAV de hasta 100 MB.');
      return;
    }
    setBusy(true);
    setMessage('Preparando tu música…');
    try {
      setPending(undefined);
      const duration = await readAudioDuration(file);
      setPending({ file, duration });
      setStart(0);
      setEnd(duration);
      setMessage('Elige los puntos del bucle y guarda.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Formato no compatible en este navegador.',
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!pending) return;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > pending.duration ||
      end - start < 0.25
    ) {
      setMessage('El bucle debe durar al menos 0,25 s y quedar dentro del audio.');
      return;
    }
    setBusy(true);
    try {
      const { file, duration } = pending;
      await onAdd(
        {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 60),
          mime: file.type,
          size: file.size,
          duration,
          loopStart: start,
          loopEnd: end,
          category,
        },
        file,
      );
      setPending(undefined);
      setMessage('Tu música está guardada. Dale al play.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el audio.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">CADA AVENTURA TIENE SU RITMO</p>
          <h1>La banda sonora es tuya.</h1>
          <p>Deja que suene el bosque o corre con tu canción favorita.</p>
        </div>
      </div>
      <div className="music-hero">
        <div className="vinyl">
          <div>
            <TreeNote />
          </div>
        </div>
        <div>
          <span className="pill">BANDA SONORA RETRO PLATFORMER</span>
          <h2>Aventura Clásica de Plataformas</h2>
          <p>Chiptune de 140 BPM, bajo saltarín, arpegios y batería arcade inspirada en los clásicos.</p>
          <button className="primary" disabled={busy} onClick={() => void play()}>
            {active === 'ambient' ? <Pause size={18} /> : <Play size={18} />}
            {active === 'ambient' ? 'Pausar Banda Sonora' : 'Escuchar Banda Sonora'}
          </button>
        </div>
        <AudioLines className="sound-decoration" />
      </div>
      <div className="music-layout">
        <div className="panel">
          <div className="section-heading compact">
            <h2>Tu biblioteca</h2>
            <span className="count-badge">{music.length}</span>
          </div>
          {music.length ? (
            music.map((track) => (
              <article className="audio-row" key={track.id}>
                <button
                  className="audio-play"
                  aria-label={`${active === track.id ? 'Pausar' : 'Reproducir'} ${track.name}`}
                  disabled={busy}
                  onClick={() => void play(track)}
                >
                  {active === track.id ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong>{track.name}</strong>
                    {track.category && (
                      <span
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(216, 243, 106, 0.15)',
                          color: 'var(--lime)',
                          border: '1px solid rgba(216, 243, 106, 0.3)',
                        }}
                      >
                        {track.category}
                      </span>
                    )}
                  </div>
                  <span>
                    {Math.floor(track.duration / 60)}:
                    {String(Math.floor(track.duration % 60)).padStart(2, '0')} · Bucle{' '}
                    {track.loopStart.toFixed(1)}–{track.loopEnd.toFixed(1)} s
                  </span>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Eliminar ${track.name}`}
                  onClick={() => {
                    if (active === track.id) {
                      audioEngine.stop();
                      setActive(null);
                    }
                    void onDelete(track.id).catch((e) => setMessage(String(e)));
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <Music2 />
              <h3>Espacio para tu ritmo.</h3>
              <p>Importa una canción para llevarla a cualquier mundo.</p>
            </div>
          )}
          <label className={`upload-zone ${busy ? 'disabled' : ''}`}>
            <Upload />
            <strong>Trae tu música</strong>
            <span>MP3, MP4, OGG, WAV · hasta 100 MB por archivo · sin límite de duración</span>
            <input
              disabled={busy}
              type="file"
              accept="audio/*,video/mp4,.mp4,.ogg"
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {pending && (
            <div className="loop-editor">
              <strong>{pending.file.name}</strong>
              <div style={{ margin: '10px 0' }}>
                <label>
                  Categoría de audio
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      marginTop: '4px',
                      borderRadius: '8px',
                    }}
                  >
                    <option value="adventure">Aventura (Niveles normales)</option>
                    <option value="boss">Jefe Final (Combate)</option>
                    <option value="chill">Chill / Relajante</option>
                    <option value="retro">Retro Arcade</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </label>
              </div>
              <div>
                <label>
                  Inicio (s)
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={start}
                    onChange={(e) => setStart(Number(e.target.value))}
                  />
                </label>
                <label>
                  Fin (s)
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    max={pending.duration}
                    value={end}
                    onChange={(e) => setEnd(Number(e.target.value))}
                  />
                </label>
              </div>
              <button className="primary" disabled={busy} onClick={() => void save()}>
                Guardar audio
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setPending(undefined);
                  setMessage('');
                }}
              >
                Cancelar
              </button>
            </div>
          )}
          <p role="status" className="form-message">
            {message}
          </p>
        </div>
        <aside className="panel">
          <Volume2 className="section-icon" />
          <h2>A tu volumen.</h2>
          <p className="subtle">La música sigue contigo al cambiar de pantalla.</p>

          <div style={{ marginBottom: '18px', paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              Modo Jukebox en Juego
              <select
                value={preferences.jukeboxMode || 'assigned'}
                onChange={(e) =>
                  onPreferences({
                    ...preferences,
                    jukeboxMode: e.target.value as any,
                  })
                }
                style={{ width: '100%', padding: '8px 10px', marginTop: '4px', borderRadius: '8px' }}
              >
                <option value="assigned">Pistas Asignadas (Nivel y Jefe)</option>
                <option value="shuffle">Aleatorio (Shuffle)</option>
                <option value="sequential">Secuencial (Lista continua)</option>
              </select>
            </label>

            {preferences.jukeboxMode && preferences.jukeboxMode !== 'assigned' && (
              <label style={{ display: 'block', marginTop: '10px' }}>
                Filtrar por categoría Jukebox
                <select
                  value={preferences.jukeboxCategory || 'all'}
                  onChange={(e) =>
                    onPreferences({
                      ...preferences,
                      jukeboxCategory: e.target.value as any,
                    })
                  }
                  style={{ width: '100%', padding: '8px 10px', marginTop: '4px', borderRadius: '8px' }}
                >
                  <option value="all">Todas las canciones</option>
                  <option value="adventure">Aventura</option>
                  <option value="boss">Jefes</option>
                  <option value="chill">Chill</option>
                  <option value="retro">Retro</option>
                  <option value="custom">Personalizadas</option>
                </select>
              </label>
            )}
          </div>

          <label>
            Volumen general <strong>{Math.round(preferences.volume * 100)}%</strong>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={preferences.volume}
              onChange={(e) => onPreferences({ ...preferences, volume: Number(e.target.value) })}
            />
          </label>
          <label className="toggle-row">
            <span>Silenciar sonido</span>
            <input
              type="checkbox"
              checked={preferences.muted}
              onChange={(e) => onPreferences({ ...preferences, muted: e.target.checked })}
            />
          </label>
          <label>
            Volumen de los efectos
            <input
              aria-label="Volumen de los efectos"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={preferences.sfxVolume}
              onChange={(e) => onPreferences({ ...preferences, sfxVolume: Number(e.target.value) })}
            />
          </label>
          <label>
            Tono de los efectos
            <input
              aria-label="Tono de los efectos"
              type="range"
              min={0.5}
              max={1.8}
              step={0.1}
              value={preferences.sfxPitch}
              onChange={(e) => onPreferences({ ...preferences, sfxPitch: Number(e.target.value) })}
            />
          </label>
          <button
            className="secondary"
            onClick={() =>
              void audioEngine
                .unlock()
                .then(() => audioEngine.effect('coin'))
                .catch(() => setMessage('No se pudo activar el sonido.'))
            }
          >
            Probar efecto <Volume2 size={16} />
          </button>
          <div className="hint-card">
            <ShieldNote />
            <p>Tus archivos se quedan en este dispositivo. Tú eliges lo que suena.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
function TreeNote() {
  return <Music2 size={36} />;
}
function ShieldNote() {
  return <Music2 size={20} />;
}
