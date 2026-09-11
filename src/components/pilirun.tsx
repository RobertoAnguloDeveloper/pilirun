'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Compass,
  Flag,
  Footprints,
  Gamepad2,
  Headphones,
  Heart,
  Leaf,
  LoaderCircle,
  Map,
  Mountain,
  Music2,
  Palette,
  Play,
  Plus,
  Route,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Avatar, Landscape } from './art';
import { CHARACTERS, TRACKS, WORLDS } from '@/lib/worlds';
import {
  DEFAULT_PREFERENCES,
  type Backend,
  type Character,
  type Preferences,
  type RunResult,
  type SavedData,
  type Track,
  type AudioTrack,
} from '@/lib/types';
import { localStore } from '@/lib/storage';
import { audioEngine } from '@/lib/audio';
const loading = () => (
  <div className="loading-state">
    <LoaderCircle className="spin" /> Preparando tu aventura…
  </div>
);
const CharacterEditor = dynamic(() => import('./character-editor').then((m) => m.CharacterEditor), {
  loading,
});
const TrackBuilder = dynamic(() => import('./track-builder').then((m) => m.TrackBuilder), {
  loading,
});
const MusicLibrary = dynamic(() => import('./music-library').then((m) => m.MusicLibrary), {
  loading,
});
const GameView = dynamic(() => import('./game-view').then((m) => m.GameView), {
  loading,
  ssr: false,
});
type Page = 'home' | 'worlds' | 'characters' | 'builder' | 'music' | 'stats' | 'settings';
const NAV = [
  { id: 'home', name: 'Campamento', icon: Compass },
  { id: 'worlds', name: 'Explorar mundos', icon: Map },
  { id: 'characters', name: 'Mis personajes', icon: Palette },
  { id: 'builder', name: 'Crear una pista', icon: Route },
  { id: 'music', name: 'Mi música', icon: Music2 },
  { id: 'stats', name: 'Mis aventuras', icon: Trophy },
] as const;
export default function PiliRun() {
  const [page, setPage] = useState<Page>('home'),
    [data, setData] = useState<SavedData>({
      characters: [],
      tracks: [],
      runs: [],
      music: [],
      preferences: DEFAULT_PREFERENCES,
    });
  const [backend, setBackend] = useState<Backend>(),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState('');
  const [playing, setPlaying] = useState<Track | null>(null),
    [activeMusic, setActiveMusic] = useState<string | null>(null),
    [help, setHelp] = useState(false),
    [online, setOnline] = useState(true);
  const initialized = useRef(false),
    prefTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentPrefs = useRef(data.preferences);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void localStore
      .init()
      .then(({ backend, data }) => {
        setBackend(backend);
        setData(data);
        currentPrefs.current = data.preferences;
        audioEngine.configure(data.preferences);
        setReady(true);
      })
      .catch((e) => setError(e.message));
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const flush = () => {
      if (prefTimer.current) {
        clearTimeout(prefTimer.current);
        prefTimer.current = undefined;
        void localStore.request({
          action: 'save',
          collection: 'preferences',
          id: 'settings',
          value: currentPrefs.current,
        });
      }
    };
    const hidden = () => {
      if (document.hidden) flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  const characters = [...CHARACTERS, ...data.characters],
    tracks = [...TRACKS, ...data.tracks];
  const character = characters.find((c) => c.id === data.preferences.characterId) ?? CHARACTERS[0],
    selectedTrack = tracks.find((t) => t.id === data.preferences.trackId) ?? TRACKS[0];
  const navigate = (next: Page) => {
    setPage(next);
    setPlaying(null);
    window.scrollTo({ top: 0 });
  };
  const preferences = (p: Preferences) => {
    if (!ready) return;
    currentPrefs.current = p;
    setData((d) => ({ ...d, preferences: p }));
    audioEngine.configure(p);
    if (prefTimer.current) clearTimeout(prefTimer.current);
    prefTimer.current = setTimeout(() => {
      prefTimer.current = undefined;
      void localStore
        .request({ action: 'save', collection: 'preferences', id: 'settings', value: p })
        .catch((e) => setToast(e.message));
    }, 150);
  };
  const start = (track: Track = selectedTrack) => {
    if (!ready) return;
    void audioEngine
      .unlock()
      .catch(() => setToast('El audio no pudo activarse. Puedes seguir jugando.'));
    setPlaying(track);
    window.scrollTo({ top: 0 });
  };
  const saveCharacter = async (c: Character) => {
    await localStore.request({ action: 'save', collection: 'characters', id: c.id, value: c });
    setData((d) => ({ ...d, characters: [...d.characters.filter((item) => item.id !== c.id), c] }));
  };
  const saveTrack = async (t: Track) => {
    await localStore.request({ action: 'save', collection: 'tracks', id: t.id, value: t });
    setData((d) => ({ ...d, tracks: [...d.tracks.filter((item) => item.id !== t.id), t] }));
  };
  const remove = async (collection: 'characters' | 'tracks' | 'music', id: string) => {
    await localStore.request({ action: 'delete', collection, id });
    setData((d) => ({ ...d, [collection]: d[collection].filter((item) => item.id !== id) }));
    if (collection === 'characters' && data.preferences.characterId === id)
      preferences({ ...data.preferences, characterId: 'pili' });
    if (collection === 'tracks' && data.preferences.trackId === id)
      preferences({ ...data.preferences, trackId: 'forest-path' });
    setToast('Creación eliminada.');
  };
  const saveRun = async (run: RunResult) => {
    await localStore.request({ action: 'save', collection: 'runs', id: run.id, value: run });
    setData((d) => ({ ...d, runs: [...d.runs, run] }));
  };
  const saveMusic = async (track: AudioTrack, bytes: ArrayBuffer) => {
    await localStore.request({ action: 'music-put', track, bytes });
    setData((d) => ({ ...d, music: [...d.music, track] }));
  };
  const totalCoins = data.runs.reduce((n, r) => n + r.coins, 0),
    totalDistance = data.runs.reduce((n, r) => n + r.distance, 0),
    best = Math.max(0, ...data.runs.map((r) => r.score));
  return (
    <div className={`app-shell ${data.preferences.reducedMotion ? 'reduced-motion' : ''}`}>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate('home')}
          aria-label="PiliRun, ir al campamento"
        >
          <span className="brand-mark">
            <Footprints size={25} />
          </span>
          <span>
            pili<span>run</span>
            <i />
          </span>
        </button>
        <div className="sidebar-caption">UN MUNDO POR CORRER</div>
        <nav aria-label="Navegación principal">
          {NAV.map(({ id, name, icon: Icon }, i) => (
            <button
              key={id}
              className={`${page === id && !playing ? 'active' : ''} ${i === 2 ? 'nav-gap' : ''}`}
              onClick={() => navigate(id)}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{name}</span>
              {id === 'builder' && <span className="tiny-new">CREA</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card">
            <span className="offline-icon">
              <Sprout size={23} />
            </span>
            <strong>
              Un pequeño mundo.
              <br />
              Todo tuyo.
            </strong>
            <p>
              Sin cuentas. Sin prisas.
              <br />
              Aventuras que se quedan contigo.
            </p>
            <div>
              <span className={`status-dot ${ready ? '' : 'waiting'}`} />
              {ready ? 'Guardado en tu dispositivo' : 'Preparando tu campamento'}
            </div>
          </div>
          <button
            className={page === 'settings' ? 'settings-link active' : 'settings-link'}
            onClick={() => navigate('settings')}
          >
            <Settings2 size={19} /> Ajustes <span>v1.0</span>
          </button>
          <div className="sidebar-footer">
            HECHO PARA DISFRUTAR EL CAMINO <Heart size={10} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Tu pequeño universo</span>
            <ChevronRight size={14} />
            <strong>
              {playing ? 'En la pista' : (NAV.find((n) => n.id === page)?.name ?? 'Ajustes')}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="connection">
              <i className="status-dot" />
              {online ? 'A tu ritmo' : 'Sin conexión'}
            </span>
            <span className="coin-wallet">
              <Coins size={17} />
              {totalCoins.toLocaleString('es')}
            </span>
            <button
              className="icon-button"
              aria-label={data.preferences.muted ? 'Activar sonido' : 'Silenciar sonido'}
              onClick={() => preferences({ ...data.preferences, muted: !data.preferences.muted })}
            >
              {data.preferences.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <button
              className="profile-avatar"
              aria-label="Elegir personaje"
              onClick={() => navigate('characters')}
            >
              <Avatar character={character} size={36} />
            </button>
            <button
              className="mobile-settings icon-button"
              aria-label="Ajustes del juego"
              onClick={() => navigate('settings')}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <ShieldCheck />
              <div>
                <strong>No pudimos abrir tu guardado.</strong>
                <p>{error}</p>
              </div>
              <button className="secondary" onClick={() => location.reload()}>
                Reintentar
              </button>
            </div>
          )}
          {playing ? (
            <GameView
              track={playing}
              character={character}
              reduced={data.preferences.reducedMotion}
              initialCameraView={data.preferences.cameraView || 'side'}
              onClose={() => setPlaying(null)}
              onResult={saveRun}
            />
          ) : (
            <>
              {page === 'home' && (
                <>
                  <div className="greeting">
                    <div>
                      <p className="eyebrow">
                        <span /> QUE EMPIECE LO BUENO
                      </p>
                      <h1>
                        Un salto fuera de la rutina<span>.</span>
                      </h1>
                      <p>Explora, crea y corre a tu manera. El camino es tuyo.</p>
                    </div>
                    <button className="text-button help-button" onClick={() => setHelp(true)}>
                      <Gamepad2 size={18} /> Cómo jugar <ArrowRight size={15} />
                    </button>
                  </div>
                  <section className="home-grid">
                    <article className="hero-adventure">
                      <Landscape world={selectedTrack.world} fox />
                      <div className="hero-shade" />
                      <div className="hero-content">
                        <div className="hero-tags">
                          <span className="pill">
                            <Leaf size={12} /> TU PRÓXIMA AVENTURA
                          </span>
                          <span className="hero-difficulty">
                            <i />
                            {WORLDS[selectedTrack.world].difficulty}
                          </span>
                        </div>
                        <h2>
                          {selectedTrack.name.split(' ').slice(0, -1).join(' ') ||
                            selectedTrack.name}
                          <br />
                          {selectedTrack.name.includes(' ')
                            ? selectedTrack.name.split(' ').at(-1)
                            : ''}
                          <span>.</span>
                        </h2>
                        <p>{WORLDS[selectedTrack.world].subtitle}</p>
                        <button
                          className="primary play-button"
                          disabled={!ready}
                          onClick={() => start()}
                        >
                          {ready ? (
                            <Play size={18} fill="currentColor" />
                          ) : (
                            <LoaderCircle size={18} className="spin" />
                          )}
                          {ready ? 'Vamos a correr' : 'Preparando…'}
                          <ArrowRight size={18} />
                        </button>
                        <div className="hero-meta">
                          <span>
                            <Route size={14} />
                            {selectedTrack.length / 10} m de aventura
                          </span>
                          <span>
                            <Flag size={14} />
                            {Math.ceil(selectedTrack.length / 3000)} etapas
                          </span>
                        </div>
                      </div>
                      <div className="hero-bottom">
                        <span>
                          <kbd>↑</kbd> Salta. <kbd>↓</kbd> Deslízate. <Heart size={12} /> Disfruta.
                        </span>
                        <span>01 / 03</span>
                      </div>
                    </article>
                    <aside className="companion-card">
                      <div className="section-heading compact">
                        <p className="eyebrow">TU COMPAÑERO DE VIAJE</p>
                        <span className="green-dot" />
                      </div>
                      <div className="companion-scene">
                        <div className="orbit orbit-one" />
                        <div className="orbit orbit-two" />
                        <Sparkles className="sparkle-one" size={19} />
                        <Avatar character={character} size={174} />
                        <span className="little-leaf">
                          <Leaf size={18} />
                        </span>
                      </div>
                      <div className="companion-name">
                        <h2>{character.name}</h2>
                        <span className="pill small">EXPLORADOR</span>
                      </div>
                      <p>
                        Grandes aventuras.
                        <br />
                        Pequeñas patas.
                      </p>
                      <div className="companion-divider" />
                      <button className="secondary" onClick={() => navigate('characters')}>
                        <Palette size={16} /> Personalizar <ArrowRight size={16} />
                      </button>
                      <span className="card-footnote">Un personaje tan único como tú.</span>
                    </aside>
                  </section>
                  <section className="journey-strip" aria-label="Tu progreso">
                    <div className="journey-intro">
                      <span className="round-icon">
                        <Footprints size={21} />
                      </span>
                      <div>
                        <strong>Cada paso cuenta.</strong>
                        <span>Tu historia hasta ahora</span>
                      </div>
                    </div>
                    <div>
                      <strong>
                        {totalDistance.toLocaleString('es')} <small>m</small>
                      </strong>
                      <span>camino recorrido</span>
                    </div>
                    <div>
                      <strong>{data.runs.length.toString().padStart(2, '0')}</strong>
                      <span>aventuras vividas</span>
                    </div>
                    <div>
                      <strong>{best.toLocaleString('es')}</strong>
                      <span>tu mejor puntuación</span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Ver mis aventuras"
                      onClick={() => navigate('stats')}
                    >
                      <ArrowRight size={19} />
                    </button>
                  </section>
                  <div className="section-heading world-heading">
                    <div>
                      <p className="eyebrow">SIEMPRE HAY ALGO POR DESCUBRIR</p>
                      <h2>Elige tu próximo horizonte.</h2>
                    </div>
                    <button className="text-button" onClick={() => navigate('worlds')}>
                      Todos los mundos <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="world-grid">
                    {TRACKS.map((track, i) => (
                      <WorldCard
                        key={track.id}
                        track={track}
                        index={i}
                        selected={track.id === selectedTrack.id}
                        onClick={() => {
                          preferences({ ...data.preferences, trackId: track.id });
                          setToast(`${track.name} está listo para tu próxima carrera.`);
                        }}
                      />
                    ))}
                  </div>
                  <div className="create-banner">
                    <div className="create-banner-icon">
                      <Route size={29} />
                      <span>
                        <Plus size={11} />
                      </span>
                    </div>
                    <div>
                      <p className="eyebrow">UN POCO DE IMAGINACIÓN, UN MUNDO NUEVO</p>
                      <h3>¿Y si el próximo camino lo creas tú?</h3>
                      <p>Diseña una pista, añade tu música y hazla tuya.</p>
                    </div>
                    <button className="secondary" onClick={() => navigate('builder')}>
                      Abrir mi taller <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {page === 'worlds' && (
                <>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">SAL A DESCUBRIR</p>
                      <h1>Hay un mundo ahí fuera.</h1>
                      <p>Seis horizontes únicos. Todas las ganas de explorar a máxima velocidad.</p>
                    </div>
                  </div>
                  <div className="world-grid worlds-full">
                    {tracks.map((track, index) => (
                      <WorldCard
                        key={track.id}
                        track={track}
                        index={index}
                        selected={selectedTrack.id === track.id}
                        onClick={() => {
                          preferences({ ...data.preferences, trackId: track.id });
                          start(track);
                        }}
                      />
                    ))}
                  </div>
                  <div className="hint-card">
                    <Compass size={23} />
                    <p>
                      <strong>Cada mundo, un ritmo y desafío.</strong> Explora el bosque, las dunas,
                      el valle estelar, la metrópolis cyberpunk neón, las cumbres celestes o el cráter ígneo.
                      Pulsa cualquier mundo para correr.
                    </p>
                  </div>
                </>
              )}
              {page === 'characters' && ready && (
                <CharacterEditor
                  characters={characters}
                  selected={character.id}
                  onSelect={(id) => preferences({ ...data.preferences, characterId: id })}
                  onSave={saveCharacter}
                  onDelete={(id) => remove('characters', id)}
                />
              )}
              {page === 'builder' && ready && (
                <TrackBuilder
                  tracks={data.tracks}
                  onSave={saveTrack}
                  onDelete={(id) => remove('tracks', id)}
                  onPlay={start}
                />
              )}
              {page === 'music' && ready && (
                <MusicLibrary
                  music={data.music}
                  preferences={data.preferences}
                  active={activeMusic}
                  setActive={setActiveMusic}
                  onAdd={saveMusic}
                  onDelete={(id) => remove('music', id)}
                  onPreferences={preferences}
                />
              )}
              {['characters', 'builder', 'music'].includes(page) && !ready && !error && loading()}
              {page === 'stats' && (
                <>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">TU HISTORIA EN EL CAMINO</p>
                      <h1>Pequeños pasos. Grandes recuerdos.</h1>
                      <p>Cada carrera escribe algo nuevo.</p>
                    </div>
                    <Trophy className="section-icon" />
                  </div>
                  <div className="stat-grid">
                    <Stat
                      icon={<Route />}
                      value={`${totalDistance.toLocaleString('es')} m`}
                      label="Distancia total"
                    />
                    <Stat icon={<Coins />} value={String(totalCoins)} label="Monedas recogidas" />
                    <Stat
                      icon={<Flag />}
                      value={String(data.runs.filter((r) => r.won).length)}
                      label="Metas alcanzadas"
                    />
                    <Stat icon={<Trophy />} value={String(best)} label="Mejor puntuación" />
                  </div>
                  <div className="panel">
                    <h2>Diario de aventuras</h2>
                    {data.runs.length ? (
                      <div className="run-list">
                        {[...data.runs].reverse().map((run) => (
                          <article key={run.id}>
                            <span className="round-icon">
                              {run.won ? <Flag size={20} /> : <Footprints size={20} />}
                            </span>
                            <div>
                              <strong>{run.trackName}</strong>
                              <span>
                                {new Date(run.date).toLocaleDateString('es-CO')} ·{' '}
                                {run.won ? 'Meta alcanzada' : 'Un paso más'} · {run.distance} m
                              </span>
                            </div>
                            <div>
                              <strong>{run.score.toLocaleString('es')} pts</strong>
                              <span>
                                {run.coins} monedas · {run.perfects} perfectos
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <Footprints />
                        <h3>Tu historia está por empezar.</h3>
                        <p>Completa tu primera carrera para verla aquí.</p>
                        <button className="primary" disabled={!ready} onClick={() => start()}>
                          <Play size={17} /> Mi primera aventura
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              {page === 'settings' && (
                <>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">SIÉNTETE EN CASA</p>
                      <h1>A tu manera.</h1>
                      <p>Pequeños ajustes para disfrutar más del camino.</p>
                    </div>
                    <SlidersHorizontal />
                  </div>
                  <div className="settings-grid">
                    <div className="panel">
                      <h2>Sonido y movimiento</h2>
                      <label className="toggle-row">
                        <span>Silenciar audio</span>
                        <input
                          type="checkbox"
                          checked={data.preferences.muted}
                          onChange={(e) =>
                            preferences({ ...data.preferences, muted: e.target.checked })
                          }
                        />
                      </label>
                      <label>
                        Volumen · {Math.round(data.preferences.volume * 100)}%
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={data.preferences.volume}
                          onChange={(e) =>
                            preferences({ ...data.preferences, volume: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label className="toggle-row">
                        <span>Reducir movimiento de fondo</span>
                        <input
                          type="checkbox"
                          checked={data.preferences.reducedMotion}
                          onChange={(e) =>
                            preferences({ ...data.preferences, reducedMotion: e.target.checked })
                          }
                        />
                      </label>
                      <p className="subtle">
                        Detiene el paralaje y las transiciones decorativas. Los elementos de la
                        carrera mantienen su movimiento.
                      </p>
                    </div>
                    <div className="panel">
                      <ShieldCheck className="section-icon" />
                      <h2>Tu mundo se queda contigo.</h2>
                      <p className="subtle">
                        Personajes, pistas, música y carreras se guardan en este navegador. No
                        necesitas registrarte.
                      </p>
                      <div className="storage-info">
                        <span>Almacenamiento</span>
                        <strong>{backend ? `SQLite · ${backend}` : 'Conectando…'}</strong>
                      </div>
                      <div className="storage-info">
                        <span>Estado</span>
                        <strong>{ready ? 'Listo para guardar' : 'No disponible'}</strong>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => {
                          if (navigator.storage?.persist)
                            void navigator.storage
                              .persist()
                              .then((granted) =>
                                setToast(
                                  granted
                                    ? 'El navegador protegió tu guardado contra limpieza automática.'
                                    : 'El navegador administra el espacio disponible. Tus datos siguen guardados.',
                                ),
                              )
                              .catch(() =>
                                setToast('No se pudo solicitar almacenamiento persistente.'),
                              );
                          else
                            setToast(
                              'Este navegador administra el almacenamiento automáticamente.',
                            );
                        }}
                      >
                        Proteger mis guardados <ShieldCheck size={16} />
                      </button>
                      <p className="subtle small-print">
                        Borrar los datos del navegador también elimina tus creaciones. El modo sin
                        conexión queda disponible tras cargar la versión de producción.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="main-footer">
            <span>
              <Sprout size={15} /> Menos prisa. Más aventura.
            </span>
            <span>PiliRun · Tu mundo, tu ritmo.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label="Cerrar aviso" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
function WorldCard({
  track,
  index,
  selected,
  onClick,
}: {
  track: Track;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`world-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="world-art">
        <Landscape world={track.world} />
        <span className="world-number">{String(index + 1).padStart(2, '0')}</span>
        {selected && (
          <span className="selected-tag">
            <Check size={11} /> ELEGIDO
          </span>
        )}
        <span className="world-distance">{track.length / 10} m</span>
      </div>
      <div className="world-info">
        <div>
          <h3>{track.name}</h3>
          <span>
            <i className={`difficulty-dot ${track.world}`} />
            {WORLDS[track.world].difficulty}
            <span className="world-separator">·</span>
            {track.custom
              ? 'Creado por ti'
              : ['Respira y explora', 'Sigue la luz', 'Brilla en la oscuridad'][index % 3]}
          </span>
        </div>
        <span className="world-arrow">
          <ArrowRight size={17} />
        </span>
      </div>
    </button>
  );
}
function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="stat-card">
      <span className="round-icon">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
function Help({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null),
    previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement;
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        e.preventDefault();
        close.current?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous.current?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={close}
          className="icon-button modal-close"
          aria-label="Cerrar instrucciones"
          onClick={onClose}
        >
          <X />
        </button>
        <span className="round-icon">
          <Gamepad2 />
        </span>
        <p className="eyebrow">LO BUENO ES SENCILLO</p>
        <h2 id="help-title">Un salto y ya estás dentro.</h2>
        <div className="help-steps">
          <p>
            <kbd>Espacio / ↑</kbd>
            <span>
              <strong>Salta y vuelve a saltar.</strong> Dos pulsaciones para un doble salto. En el
              móvil, toca la pista o Saltar.
            </span>
          </p>
          <p>
            <kbd>↓</kbd>
            <span>
              <strong>Pasa por debajo.</strong> Desliza hacia abajo o usa Deslizar para esquivar las
              ramas altas.
            </span>
          </p>
          <p>
            <kbd>P / Esc</kbd>
            <span>
              <strong>Tómate un respiro.</strong> Pausa cuando quieras. Cambiar de pestaña también
              pausa la carrera.
            </span>
          </p>
        </div>
        <div className="hint-card">
          <Sparkles size={23} />
          <p>
            Recoge monedas, alcanza checkpoints y supera tres obstáculos sin chocar para conseguir
            un escudo. Cada intento cuenta.
          </p>
        </div>
      </section>
    </div>
  );
}
