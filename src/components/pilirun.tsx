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
  Maximize2,
  Minimize2,
  Layers3,
  ExternalLink,
} from 'lucide-react';
import { Avatar, Landscape } from './art';
import { BackgroundRunner } from './background-runner';
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
  type Scenario,
  type ScenarioAsset,
} from '@/lib/types';
import { localStore } from '@/lib/storage';
import { audioEngine } from '@/lib/audio';
import { scenarioToTrack } from '@/lib/scenario';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';
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
const ScenarioEditor = dynamic(() => import('./scenario-editor').then((m) => m.ScenarioEditor), {
  loading,
  ssr: false,
});
const MusicLibrary = dynamic(() => import('./music-library').then((m) => m.MusicLibrary), {
  loading,
});
const GameView = dynamic(() => import('./game-view').then((m) => m.GameView), {
  loading,
  ssr: false,
});
type Page =
  'home' | 'worlds' | 'characters' | 'builder' | 'editor' | 'music' | 'stats' | 'settings';
const NAV = [
  { id: 'home', name: 'Campamento', icon: Compass },
  { id: 'worlds', name: 'Explorar mundos', icon: Map },
  { id: 'characters', name: 'Mis personajes', icon: Palette },
  { id: 'builder', name: 'Crear una pista', icon: Route },
  { id: 'editor', name: 'Editor de escenarios', icon: Layers3 },
  { id: 'music', name: 'Mi música', icon: Music2 },
  { id: 'stats', name: 'Mis aventuras', icon: Trophy },
] as const;
export default function PiliRun() {
  const [page, setPage] = useState<Page>('home'),
    [data, setData] = useState<SavedData>({
      characters: [],
      tracks: [],
      scenarios: [],
      runs: [],
      music: [],
      preferences: DEFAULT_PREFERENCES,
    });
  const [backend, setBackend] = useState<Backend>(),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState('');
  const [playing, setPlaying] = useState<{
      track: Track;
      scenario?: Scenario;
      assets: ScenarioAsset[];
      returnPage: Page;
    } | null>(null),
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
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && page !== 'home' && !playing) {
        setPage('home');
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [page, playing]);
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
    tracks = [...TRACKS, ...data.tracks, ...data.scenarios.map(scenarioToTrack)];
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((p) => !p);
    }
  };

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  const start = async (
    track: Track = selectedTrack,
    scenarioOverride?: Scenario,
    assetOverride?: ScenarioAsset[],
    returnPage: Page = 'home',
  ) => {
    if (!ready) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    void audioEngine
      .unlock()
      .catch(() => setToast('El audio no pudo activarse. Puedes seguir jugando.'));
    const scenario =
      scenarioOverride ??
      (track.scenarioId ? data.scenarios.find((item) => item.id === track.scenarioId) : undefined);
    const assets =
      assetOverride ??
      (scenario
        ? await localStore
            .request<ScenarioAsset[]>({ action: 'scenario-assets-get', scenarioId: scenario.id })
            .catch(() => [])
        : []);
    setPlaying({ track, scenario, assets, returnPage });
    setPage('home');
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
  const saveScenario = async (scenario: Scenario, assets: ScenarioAsset[]) => {
    await localStore.request({ action: 'scenario-save', scenario, assets });
    setData((current) => ({
      ...current,
      scenarios: [...current.scenarios.filter((item) => item.id !== scenario.id), scenario],
      draftScenario: undefined,
    }));
  };
  const saveScenarioDraft = async (scenario: Scenario) => {
    await localStore.request({ action: 'scenario-draft-save', scenario });
    setData((current) => ({ ...current, draftScenario: scenario }));
  };
  const discardScenarioDraft = async (scenarioId?: string) => {
    await localStore.request({ action: 'scenario-draft-clear', scenarioId });
    setData((current) => ({ ...current, draftScenario: undefined }));
  };
  const deleteScenario = async (id: string) => {
    await localStore.request({ action: 'scenario-delete', id });
    setData((current) => ({
      ...current,
      scenarios: current.scenarios.filter((item) => item.id !== id),
      draftScenario: current.draftScenario?.id === id ? undefined : current.draftScenario,
    }));
    if (data.preferences.trackId === `scenario:${id}`)
      preferences({ ...data.preferences, trackId: 'forest-path' });
    setToast('Escenario eliminado.');
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
    <div
      className={`game-studio-root ${playing ? 'is-playing' : ''} ${page === 'editor' && !playing ? 'is-scenario-editor' : ''} ${data.preferences.reducedMotion ? 'reduced-motion' : ''} ${isFullscreen ? 'studio-fullscreen' : ''}`}
    >
      {/* 1. Live Ambient 3D Running Canvas Background (always active on main menu) */}
      {!playing && page !== 'editor' && (
        <BackgroundRunner
          track={selectedTrack}
          character={character}
          reduced={data.preferences.reducedMotion}
        />
      )}

      {/* 2. Top In-Game Arcade Header */}
      <header className="arcade-header">
        <div
          className="arcade-brand"
          onClick={() => navigate('home')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate('home');
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="PiliRun, ir al campamento"
        >
          <span className="arcade-logo-mark">
            <Footprints size={22} />
          </span>
          <span className="arcade-logo-text">
            PILI<span>RUN</span>
          </span>
        </div>

        <nav className="arcade-nav-pills" aria-label="Menú del juego">
          {NAV.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={`arcade-pill-btn ${page === id && !playing ? 'active' : ''}`}
              onClick={() => navigate(id)}
            >
              <Icon size={16} />
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="arcade-header-stats">
          <span className="arcade-stat-badge" title="Monedas recolectadas">
            <Coins size={16} />
            <strong>{totalCoins.toLocaleString('es')}</strong>
          </span>

          <button
            className="arcade-icon-btn"
            aria-label={data.preferences.muted ? 'Activar sonido' : 'Silenciar sonido'}
            onClick={() => preferences({ ...data.preferences, muted: !data.preferences.muted })}
            title={data.preferences.muted ? 'Activar sonido' : 'Silenciar'}
          >
            {data.preferences.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            className="arcade-icon-btn"
            tabIndex={-1}
            onPointerDown={(e) => e.currentTarget.blur()}
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            onClick={(e) => {
              e.currentTarget.blur();
              void toggleFullscreen();
            }}
            title="Pantalla Completa [F]"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <button
            className="arcade-icon-btn"
            aria-label="Ajustes de juego"
            onClick={() => navigate('settings')}
            title="Ajustes de Juego"
          >
            <Settings2 size={18} />
          </button>

          <button
            className="arcade-avatar-chip"
            aria-label="Elegir personaje"
            onClick={() => navigate('characters')}
            title="Elegir personaje"
          >
            <Avatar character={character} size={34} />
          </button>
        </div>
      </header>

      {/* 3. Main Viewport / Game Canvas */}
      <main id="main-content" className="game-studio-viewport">
        {error && (
          <div className="error-banner in-game-alert" role="alert">
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
            track={playing.track}
            scenario={playing.scenario}
            scenarioAssets={playing.assets}
            character={character}
            reduced={data.preferences.reducedMotion}
            initialCameraView={data.preferences.cameraView || 'side'}
            onClose={() => {
              const returnPage = playing.returnPage;
              setPlaying(null);
              setPage(returnPage);
            }}
            onResult={saveRun}
          />
        ) : page === 'editor' && ready ? (
          <ScenarioEditor
            scenarios={data.scenarios}
            recoveredDraft={data.draftScenario}
            onSave={saveScenario}
            onDelete={deleteScenario}
            onPlay={(scenario, assets) =>
              void start(scenarioToTrack(scenario), scenario, assets, 'editor')
            }
            onDraft={saveScenarioDraft}
            onDiscardDraft={discardScenarioDraft}
            onClose={() => navigate('home')}
          />
        ) : (
          <>
            {page === 'home' && (
              <div className="arcade-hero-centerpiece">
                <div className="arcade-title-box">
                  <div className="arcade-eyebrow">
                    <Sparkles size={16} /> MODO ARCADE 3D · PILIRUN
                  </div>
                  <h1 className="arcade-game-title">
                    PILI<span>RUN</span>
                  </h1>
                  <p className="arcade-game-subtitle">
                    Mundo actual: <strong>{selectedTrack.name}</strong> (
                    {WORLDS[selectedTrack.world].difficulty})
                  </p>
                </div>

                <div className="arcade-center-actions">
                  <button
                    className="arcade-big-play-btn"
                    tabIndex={-1}
                    disabled={!ready}
                    onPointerDown={(e) => e.currentTarget.blur()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      void start();
                    }}
                  >
                    {ready ? (
                      <Play size={28} fill="currentColor" />
                    ) : (
                      <LoaderCircle size={28} className="spin" />
                    )}
                    <span>{ready ? 'JUGAR AHORA' : 'PREPARANDO…'}</span>
                  </button>

                  <div className="arcade-quick-dock">
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('worlds')}
                      title="Explorar todos los mundos"
                    >
                      <Map size={20} />
                      <span>Mundos</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('characters')}
                      title="Personalizar corredores"
                    >
                      <Palette size={20} />
                      <span>Personajes</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('builder')}
                      title="Crear pistas de carrera"
                    >
                      <Route size={20} />
                      <span>Taller</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('editor')}
                      title="Diseñar escenarios completos"
                    >
                      <Layers3 size={20} />
                      <span>Escenarios</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('music')}
                      title="Música de carrera"
                    >
                      <Music2 size={20} />
                      <span>Música</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('stats')}
                      title="Récords y estadísticas"
                    >
                      <Trophy size={20} />
                      <span>Récords</span>
                    </button>
                  </div>
                </div>

                <div className="arcade-footer-bar">
                  <div className="arcade-footer-hints">
                    <span>
                      <kbd>Espacio</kbd> / <kbd>↑</kbd> Saltar
                    </span>
                    <span>
                      <kbd>↓</kbd> Deslizar
                    </span>
                    <span>
                      <kbd>C</kbd> Cambiar Cámara 3D
                    </span>
                    <span>
                      <kbd>F</kbd> Pantalla Completa
                    </span>
                    <span>
                      <kbd>P</kbd> Pausa
                    </span>
                  </div>
                  <button className="arcade-help-link" onClick={() => setHelp(true)}>
                    <Gamepad2 size={16} /> Instrucciones
                  </button>
                </div>
              </div>
            )}

            {/* In-Game Modal Overlay for Sub-Pages */}
            {page !== 'home' && page !== 'editor' && (
              <div className="in-game-drawer-backdrop" onClick={() => navigate('home')}>
                <div
                  className="in-game-drawer-panel"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="in-game-drawer-header">
                    <div className="drawer-title-group">
                      <h2>{NAV.find((n) => n.id === page)?.name ?? 'Ajustes del Juego'}</h2>
                      <span className="drawer-subtitle">Menú integrado en el juego</span>
                    </div>
                    <button
                      className="arcade-close-btn"
                      onClick={() => navigate('home')}
                      aria-label="Cerrar y volver al juego"
                    >
                      <span>CERRAR [ESC]</span>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="in-game-drawer-body">
                    {page === 'worlds' && (
                      <>
                        <div className="section-heading">
                          <div>
                            <p className="eyebrow">SELECCIÓN DE MUNDO</p>
                            <h1>Elige tu próximo escenario</h1>
                            <p>6 mundos con físicas, saltos y atmósfera 3D única.</p>
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
                                void start(track);
                              }}
                            />
                          ))}
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
                        onPlay={(track) => void start(track, undefined, undefined, 'builder')}
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
                    {['characters', 'builder', 'music'].includes(page) &&
                      !ready &&
                      !error &&
                      loading()}
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
                          <Stat
                            icon={<Coins />}
                            value={String(totalCoins)}
                            label="Monedas recogidas"
                          />
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
                                      {run.won ? 'Meta alcanzada' : 'Un paso más'} · {run.distance}{' '}
                                      m
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
                                  preferences({
                                    ...data.preferences,
                                    volume: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="toggle-row">
                              <span>Reducir movimiento de fondo</span>
                              <input
                                type="checkbox"
                                checked={data.preferences.reducedMotion}
                                onChange={(e) =>
                                  preferences({
                                    ...data.preferences,
                                    reducedMotion: e.target.checked,
                                  })
                                }
                              />
                            </label>
                            <p className="subtle">
                              Detiene el paralaje y las transiciones decorativas. Los elementos de
                              la carrera mantienen su movimiento.
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
                              Borrar los datos del navegador también elimina tus creaciones. El modo
                              sin conexión queda disponible tras cargar la versión de producción.
                            </p>
                          </div>
                          <div className="panel about-panel">
                            <picture className="rocatech-logo">
                              <source
                                srcSet="/assets/rocatech/roca-tech-logo.svg"
                                type="image/svg+xml"
                              />
                              <img
                                src="/assets/rocatech/roca-tech-logo.png"
                                alt="Roca Tech Solutions"
                              />
                            </picture>
                            <p className="eyebrow">ACERCA DEL JUEGO</p>
                            <h2>Acerca de PiliRun</h2>
                            <div className="storage-info">
                              <span>Versión</span>
                              <strong>{APP_VERSION}</strong>
                            </div>
                            <div className="storage-info">
                              <span>Desarrollador</span>
                              <strong>Roca Tech Solutions S.A.S.</strong>
                            </div>
                            <a
                              className="secondary about-link"
                              href="https://www.rocatechsolutions.com/"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Visitar sitio web <ExternalLink size={16} />
                            </a>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <footer className="arcade-bottom-credit">
          <a href="https://www.rocatechsolutions.com/" target="_blank" rel="noopener noreferrer">
            Developed by Roca Tech Solutions
          </a>
        </footer>
      </main>
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
