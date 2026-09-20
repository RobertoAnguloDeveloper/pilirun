'use client';
import { mergeTracks } from '@/lib/music';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  Database,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Layers,
  Download,
  TabletSmartphone,
  CheckCircle2,
  Info,
  Share2,
  Swords,
} from 'lucide-react';
import { Avatar, Landscape } from './art';
import { BackgroundRunner } from './background-runner';
import { CHARACTERS, TRACKS, WORLDS, mergeCharacters } from '@/lib/worlds';
import { OFFICIAL_LEVELS, type LevelConfig } from '@/lib/procedural';
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
  type DatabaseSection,
  type StorageDetails,
  type BossConfig,
} from '@/lib/types';
import { localStore } from '@/lib/storage';
import { audioEngine } from '@/lib/audio';
import { scenarioToTrack } from '@/lib/scenario';
import { calculateCharacterStats } from '@/lib/combat';
import { applyBossDifficulty, createDefaultBoss, validateBoss, type BossDifficulty } from '@/lib/boss';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';
export const HOME_MUSIC_ID = 'bmg-a-window-facing-west';
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
  const [storageDetails, setStorageDetails] = useState<StorageDetails | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<DatabaseSection | null>(null);
  const [musicAssignTrack, setMusicAssignTrack] = useState<Track | null>(null);
  const [musicAssignBusy, setMusicAssignBusy] = useState(false);
  const [musicAssignError, setMusicAssignError] = useState('');
  const [bossAssignTrack, setBossAssignTrack] = useState<Track | null>(null);
  const [bossAssignBusy, setBossAssignBusy] = useState(false);
  const [bossAssignError, setBossAssignError] = useState('');
  const startTicket = useRef(0);
  const [cumulativePowers, setCumulativePowers] = useState<import('../lib/combat').PowerId[]>([]);
  const [playing, setPlaying] = useState<{
      sessionId: string;
      sequence: string[];
      sequenceIndex: number;
      autoStart: boolean;
      campaign: boolean;
      track: Track;
      scenario?: Scenario;
      assets: ScenarioAsset[];
      returnPage: Page;
    } | null>(null),
    [activeMusic, setActiveMusic] = useState<string | null>(null),
    [help, setHelp] = useState(false),
    [online, setOnline] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [installedToastShown, setInstalledToastShown] = useState(false);
  const [quickCustomizeOpen, setQuickCustomizeOpen] = useState(false);
  const initialized = useRef(false),
    prefTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentPrefs = useRef(data.preferences);

  const installApp = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setToast('¡Instalando PiliRun en tu dispositivo!');
          setDeferredPrompt(null);
          setInstallModalOpen(false);
          return;
        }
      } catch {
        // Fallback to instruction modal
      }
    }
    setInstallModalOpen(true);
  };

  const loadStorageDetails = async () => {
    try {
      const details = await localStore.request<StorageDetails>({ action: 'storage-details' });
      setStorageDetails(details);
    } catch {
      // ignore
    }
  };
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
        void loadStorageDetails();
      })
      .catch((e) => setError(e.message));
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  const homeBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    // Eagerly prefetch static fallback audio file so blob is in memory on load
    if (!homeBlobRef.current) {
      fetch('/assets/bmg/A_Window_Facing_West.mp3')
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (blob) homeBlobRef.current = blob;
        })
        .catch(() => {});
    }
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
    if (!ready || playing) return;
    const track = data.music.find((item) => item.id === HOME_MUSIC_ID);
    if (!track) return;

    let disposed = false;
    let loading = false;
    let armed = false;
    const events = ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown', 'wheel'] as const;

    const disarm = () => {
      if (!armed) return;
      armed = false;
      events.forEach((evt) => window.removeEventListener(evt, activate, true));
    };

    const play = async () => {
      if (disposed || loading) return;
      loading = true;
      try {
        await audioEngine.unlock();
        let blob = homeBlobRef.current;
        if (!blob) {
          try {
            blob = await localStore.request<Blob>({ action: 'music-get', id: track.id });
            if (blob) homeBlobRef.current = blob;
          } catch {
            const res = await fetch('/assets/bmg/A_Window_Facing_West.mp3');
            if (res.ok) {
              blob = await res.blob();
              homeBlobRef.current = blob;
            }
          }
        }
        if (disposed) {
          loading = false;
          return;
        }
        if (blob) {
          await audioEngine.play({ track, blob });
        } else {
          await audioEngine.play();
        }
        disarm();
        loading = false;
      } catch {
        loading = false;
        if (!disposed) arm();
      }
    };

    const activate = () => {
      void audioEngine.unlock();
      void play();
    };

    const arm = () => {
      if (armed || disposed) return;
      armed = true;
      events.forEach((evt) =>
        window.addEventListener(evt, activate, { once: true, capture: true, passive: true })
      );
    };

    // Arm gesture listeners so if the browser's autoplay policy blocks unprompted audio,
    // it automatically starts and resumes smoothly on the very first touch/click/keypress anywhere.
    arm();

    // Trigger immediate playback attempt as requested
    void play();

    return () => {
      disposed = true;
      disarm();
      audioEngine.stop();
    };
  }, [ready, playing, data.music]);
  useEffect(() => {
    // Detect standalone mode (already installed or running as PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneMode));
    };
    checkStandalone();
    const mediaMatcher = window.matchMedia('(display-mode: standalone)');
    const handleModeChange = () => checkStandalone();
    mediaMatcher.addEventListener?.('change', handleModeChange);

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile/tablet so we can use our rich arcade UI
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setToast('¡PiliRun instalado con éxito! Ya puedes jugar a pantalla completa y sin conexión.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaMatcher.removeEventListener?.('change', handleModeChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
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
  const characters = useMemo(
      () => mergeCharacters(CHARACTERS, data.characters),
      [data.characters],
    ),
    tracks = mergeTracks(TRACKS, data.tracks, data.scenarios.map(scenarioToTrack));
  const character = characters.find((c) => c.id === data.preferences.characterId) ?? CHARACTERS[0],
    selectedTrack = tracks.find((t) => t.id === data.preferences.trackId) ?? tracks[0] ?? TRACKS[0];
  const navigate = (next: Page) => {
    startTicket.current++;
    setPage(next);
    setPlaying(null);
    window.scrollTo({ top: 0 });
    if (next === 'settings') {
      void loadStorageDetails();
    }
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
    sequence = tracks.map((item) => item.id),
    autoStart = false,
  ) => {
    if (!ready) return;
    const ticket = ++startTicket.current;
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
    if (ticket !== startTicket.current) return;
    setPlaying({ sessionId: crypto.randomUUID(), sequence, sequenceIndex: Math.max(0, sequence.indexOf(track.id)), autoStart, campaign: returnPage !== 'editor', track, scenario, assets, returnPage });
    setPage('home');
    window.scrollTo({ top: 0 });
  };
  const saveCharacter = async (c: Character) => {
    await localStore.request({ action: 'save', collection: 'characters', id: c.id, value: c });
    setData((d) => {
      const isSelected = d.preferences.characterId === c.id;
      const updatedPrefs = isSelected && c.scale !== undefined
        ? { ...d.preferences, characterScale: c.scale }
        : d.preferences;
      return {
        ...d,
        characters: [...d.characters.filter((item) => item.id !== c.id), c],
        preferences: updatedPrefs,
      };
    });
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
  const gameCharacter = useMemo(() => ({
    ...character,
    scale: data.preferences.characterScale ?? character.scale ?? 1,
    stats: calculateCharacterStats(data.characterLevel ?? 1),
  }), [character, data.preferences.characterScale, data.characterLevel]);

  const saveRun = async (run: RunResult) => {
    await localStore.request({ action: 'save', collection: 'runs', id: run.id, value: run });
    let newLevel = data.characterLevel ?? 1;
    if (run.won) {
      newLevel = Math.min(20, newLevel + 1);
      setToast(`¡NIVEL AUMENTADO! Tu personaje ahora es Nivel ${newLevel} (Aura más intensa)`);
    }
    setData((d) => ({ ...d, runs: [...d.runs, run], characterLevel: newLevel }));
  };
  const saveMusic = async (track: AudioTrack, blob: Blob) => {
    await localStore.request({ action: 'music-put', track, blob });
    setData((d) => ({ ...d, music: [...d.music, track] }));
  };
  const clearSection = async (section: DatabaseSection) => {
    try {
      const refreshed = await localStore.request<SavedData>({ action: 'section-clear', section });
      setData(refreshed);
      currentPrefs.current = refreshed.preferences;
      audioEngine.configure(refreshed.preferences);
      await loadStorageDetails();
      setSectionToDelete(null);
      setToast(`Sección de base de datos restablecida.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al borrar sección';
      setToast(msg);
    }
  };
  const factoryReset = async () => {
    try {
      const refreshed = await localStore.request<SavedData>({ action: 'factory-reset' });
      setData(refreshed);
      currentPrefs.current = refreshed.preferences;
      audioEngine.configure(refreshed.preferences);
      await loadStorageDetails();
      setResetConfirmOpen(false);
      setToast('Base de datos restaurada al estado de fábrica.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al restablecer de fábrica';
      setToast(msg);
    }
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
              title={name}
              aria-label={name}
            >
              <Icon size={16} className="arcade-pill-icon" />
              <span className="arcade-pill-text">{name}</span>
            </button>
          ))}
        </nav>

        <div className="arcade-header-stats">
          <span className="arcade-stat-badge" title="Monedas recolectadas">
            <Coins size={16} />
            <strong>{totalCoins.toLocaleString('es')}</strong>
          </span>

          {!isStandalone && (
            <button
              className={`arcade-icon-btn pwa-install-header-btn ${deferredPrompt ? 'can-install-pulse' : ''}`}
              aria-label="Instalar PiliRun en tu tableta o dispositivo"
              onClick={() => void installApp()}
              title="Instalar PiliRun como aplicación"
            >
              <Download size={18} />
            </button>
          )}

          <button
            className="arcade-icon-btn arcade-sound-btn"
            aria-label={data.preferences.muted ? 'Activar sonido' : 'Silenciar sonido'}
            onClick={() => preferences({ ...data.preferences, muted: !data.preferences.muted })}
            title={data.preferences.muted ? 'Activar sonido' : 'Silenciar'}
          >
            {data.preferences.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            className="arcade-icon-btn arcade-fullscreen-btn"
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
            className="arcade-icon-btn arcade-settings-btn"
            aria-label="Ajustes de juego"
            onClick={() => navigate('settings')}
            title="Ajustes de Juego"
          >
            <Settings2 size={18} />
          </button>

          <button
            className="arcade-avatar-chip arcade-profile-chip"
            aria-label="Elegir personaje"
            onClick={() => navigate('characters')}
            title={`Personaje: ${character.name}`}
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
            key={playing.sessionId}
            sessionId={playing.sessionId}
            sequenceIndex={playing.sequenceIndex}
            autoStart={playing.autoStart}
            campaign={playing.campaign}
            hasNextLevel={playing.campaign && playing.sequenceIndex + 1 < playing.sequence.length}
            track={playing.track}
            scenario={playing.scenario}
            scenarioAssets={playing.assets}
            character={gameCharacter}
            reduced={data.preferences.reducedMotion}
            initialCameraView={data.preferences.cameraView || 'side'}
            initialPowerId={(data.preferences.selectedPowerId as any) || 'flame_burst'}
            timeOfDayPref={(data.preferences.timeOfDay as any) || 'realtime'}
            musicLibrary={data.music}
            cumulativePowers={cumulativePowers}
            preferences={data.preferences}
            onClose={() => {
              startTicket.current++;
              const returnPage = playing.returnPage;
              setPlaying(null);
              setCumulativePowers([]);
              setPage(returnPage);
            }}
            onResult={saveRun}
            onNextLevel={(chosenPower, updatedCumulative) => {
              setCumulativePowers(updatedCumulative);
              preferences({ ...data.preferences, selectedPowerId: chosenPower });

              const nextId = playing.sequence[playing.sequenceIndex + 1];
              const nextTrack = tracks.find((track) => track.id === nextId);
              if (!nextTrack) { setToast('La siguiente pista ya no está disponible.'); return; }
              void start(nextTrack, undefined, undefined, playing.returnPage, playing.sequence, true);
              setToast(`¡Avanzando a ${nextTrack.name}! Poder activo: ${chosenPower}`);
            }}
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
                    <Sparkles size={14} /> MODO ARCADE 3D · PILIRUN
                  </div>
                  <h1 className="arcade-game-title">
                    PILI<span>RUN</span>
                  </h1>
                </div>

                <div className="arcade-status-container">
                  <div className="arcade-status-card">
                    <button
                      className="status-preview-item"
                      onClick={() => navigate('worlds')}
                      title="Cambiar mundo"
                    >
                      <span className="status-label">Mundo Activo</span>
                      <strong className="status-val">
                        <Map size={14} /> {selectedTrack.name}
                      </strong>
                      <span className="status-sub">
                        {WORLDS[selectedTrack.world]?.difficulty || 'Normal'}
                      </span>
                    </button>

                    <div className="status-divider" />

                    <button
                      className="status-preview-item"
                      onClick={() => navigate('characters')}
                      title="Cambiar corredor"
                    >
                      <span className="status-label">Corredor</span>
                      <strong className="status-val">
                        <Palette size={14} /> {character.name}
                      </strong>
                      <span className="status-sub">Nivel {character.stats?.level ?? 1}</span>
                    </button>

                    <div className="status-divider" />

                    <button
                      className="status-preview-item quick-customize-trigger"
                      onClick={() => setQuickCustomizeOpen(true)}
                      title="Edición rápida de personaje y entorno en 1 clic"
                    >
                      <span className="status-label">Ajuste Rápido</span>
                      <strong className="status-val text-amber-400">
                        <SlidersHorizontal size={14} /> 1 Clic
                      </strong>
                      <span className="status-sub">Personaje y Cielo</span>
                    </button>
                  </div>

                  {!isStandalone && (
                    <button
                      className="pwa-home-banner-chip"
                      onClick={() => void installApp()}
                      title="Instalar PWA para pantalla completa y experiencia tableta"
                    >
                      <TabletSmartphone size={15} />
                      <span>Instalar como App en esta Tableta</span>
                    </button>
                  )}
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
                    title="Empezar a correr"
                  >
                    {ready ? (
                      <Play size={26} fill="currentColor" />
                    ) : (
                      <LoaderCircle size={26} className="spin" />
                    )}
                    <span>{ready ? 'JUGAR AHORA' : 'PREPARANDO…'}</span>
                  </button>

                  {/* Instructions Bar */}
                  <div className="arcade-footer-bar">
                    <button
                      className="arcade-help-link"
                      onClick={() => setHelp(true)}
                      aria-label="Ver instrucciones y controles de juego"
                    >
                      <Gamepad2 size={14} />
                      <span>Instrucciones</span>
                    </button>

                    <div className="arcade-footer-hints desktop-only-hints">
                      <span>
                        <kbd>Espacio</kbd> / <kbd>↑</kbd> Saltar
                      </span>
                      <span>
                        <kbd>↓</kbd> Deslizar
                      </span>
                      <span>
                        <kbd>C</kbd> Cámara 3D
                      </span>
                      <span>
                        <kbd>F</kbd> Pantalla Completa
                      </span>
                      <span>
                        <kbd>P</kbd> Pausa
                      </span>
                    </div>

                    <div className="arcade-footer-hints mobile-only-hints">
                      <span>👆 Arriba: Saltar</span>
                      <span>👇 Abajo: Deslizar</span>
                      <span>🕹️ Lados: Moverte</span>
                    </div>
                  </div>
                </div>

                <div className="arcade-bottom-deck">
                  <div className="arcade-quick-dock" role="navigation" aria-label="Acceso rápido">
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('worlds')}
                      title="Explorar todos los mundos"
                    >
                      <div className="dock-icon-box">
                        <Map size={18} />
                      </div>
                      <span>Mundos</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('characters')}
                      title="Personalizar corredores"
                    >
                      <div className="dock-icon-box">
                        <Palette size={18} />
                      </div>
                      <span>Personajes</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('builder')}
                      title="Crear pistas de carrera"
                    >
                      <div className="dock-icon-box">
                        <Route size={18} />
                      </div>
                      <span>Taller</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('editor')}
                      title="Diseñar escenarios completos"
                    >
                      <div className="dock-icon-box">
                        <Layers3 size={18} />
                      </div>
                      <span>Escenarios</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('music')}
                      title="Música de carrera"
                    >
                      <div className="dock-icon-box">
                        <Music2 size={18} />
                      </div>
                      <span>Música</span>
                    </button>
                    <button
                      className="arcade-dock-item"
                      onClick={() => navigate('stats')}
                      title="Récords y estadísticas"
                    >
                      <div className="dock-icon-box">
                        <Trophy size={18} />
                      </div>
                      <span>Récords</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 1-Click Quick Character & Environment Customizer Modal */}
            {quickCustomizeOpen && (
              <div
                className="game-overlay quick-customize-overlay"
                onClick={() => setQuickCustomizeOpen(false)}
              >
                <div
                  className="result-card quick-customize-modal"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Panel Rápido de Personalización"
                >
                  <div className="quick-modal-header">
                    <span className="round-icon">
                      <SlidersHorizontal size={24} />
                    </span>
                    <div>
                      <h2>Ajuste Rápido de Partida</h2>
                      <p>Cambia personaje, tamaño y atmósfera del mundo al instante.</p>
                    </div>
                    <button
                      className="arcade-icon-btn close-modal-btn"
                      onClick={() => setQuickCustomizeOpen(false)}
                      aria-label="Cerrar ajuste rápido"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="quick-modal-body">
                    {/* Quick Character Picker */}
                    <div className="quick-section">
                      <label className="quick-section-title">
                        <Palette size={16} /> Corredor Activo
                      </label>
                      <div className="quick-characters-row">
                        {characters.map((char) => (
                          <button
                            key={char.id}
                            className={`quick-char-chip ${char.id === character.id ? 'active' : ''}`}
                            onClick={() => {
                              preferences({ ...data.preferences, characterId: char.id });
                            }}
                          >
                            <Avatar character={char} size={30} />
                            <span>{char.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Scale Slider */}
                    <div className="quick-section">
                      <div className="quick-slider-header">
                        <label className="quick-section-title">
                          <Sprout size={16} /> Tamaño de Personaje: {character.scale ?? 1.0}x
                        </label>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.2"
                        step="0.1"
                        value={character.scale ?? 1.0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          void saveCharacter({ ...character, scale: val });
                        }}
                      />
                    </div>

                    {/* Quick Environment / Time of Day */}
                    <div className="quick-section">
                      <label className="quick-section-title">
                        <Compass size={16} /> Atmósfera / Iluminación del Cielo
                      </label>
                      <div className="quick-times-grid">
                        {[
                          { id: 'realtime', label: 'Hora Real (Auto)' },
                          { id: 'morning', label: 'Mañana Soleada' },
                          { id: 'midday', label: 'Mediodía Brillante' },
                          { id: 'sunset', label: 'Atardecer Dorado' },
                          { id: 'dusk', label: 'Crepúsculo' },
                          { id: 'night', label: 'Noche Estrellada' },
                          { id: 'late_night', label: 'Noche Profunda' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            className={`quick-time-chip ${(data.preferences.timeOfDay || 'realtime') === t.id ? 'active' : ''}`}
                            onClick={() => {
                              preferences({
                                ...data.preferences,
                                timeOfDay: t.id as any,
                                environmentSync: t.id === 'realtime' ? 'realtime' : 'manual',
                              });
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick World Biome Picker */}
                    <div className="quick-section">
                      <label className="quick-section-title">
                        <Map size={16} /> Mundo de Aventura
                      </label>
                      <div className="quick-worlds-row">
                        {tracks.slice(0, 6).map((trk) => (
                          <button
                            key={trk.id}
                            className={`quick-world-chip ${trk.id === selectedTrack.id ? 'active' : ''}`}
                            onClick={() => {
                              preferences({ ...data.preferences, trackId: trk.id });
                            }}
                          >
                            <span>{trk.name}</span>
                            <small>{WORLDS[trk.world]?.name || trk.world}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="quick-modal-footer">
                    <button
                      className="primary"
                      onClick={() => setQuickCustomizeOpen(false)}
                    >
                      <Check size={18} /> Listo para Correr
                    </button>
                  </div>
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
                              onConfigureMusic={() => { setMusicAssignError(''); setMusicAssignTrack(track); }}
                              onConfigureBoss={() => {
                                setBossAssignError('');
                                setBossAssignTrack({
                                  ...track,
                                  boss: track.boss ?? createDefaultBoss(`Guardián de ${track.name}`),
                                });
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
                        musicLibrary={data.music}
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

                            <h3 style={{ fontSize: '0.95rem', marginTop: '16px', marginBottom: '8px' }}>
                              Sincronización de Tiempo y Escenario
                            </h3>
                            <label>
                              Modo de Iluminación y Cielo
                              <select
                                value={data.preferences.timeOfDay || 'realtime'}
                                onChange={(e) =>
                                  preferences({
                                    ...data.preferences,
                                    timeOfDay: e.target.value as any,
                                  })
                                }
                              >
                                <option value="realtime">
                                  Sincronizado en Tiempo Real (Automático con tu reloj)
                                </option>
                                <option value="dawn">Amanecer (05:00 - 07:00)</option>
                                <option value="morning">Mañana (07:00 - 11:30)</option>
                                <option value="midday">Mediodía (11:30 - 14:00)</option>
                                <option value="afternoon">Tarde (14:00 - 17:30)</option>
                                <option value="sunset">Puesta de Sol (17:30 - 19:00)</option>
                                <option value="dusk">Crepúsculo (19:00 - 20:30)</option>
                                <option value="night">Noche (20:30 - 02:00)</option>
                                <option value="late_night">Madrugada Profunda (02:00 - 05:00)</option>
                              </select>
                            </label>
                            <p className="subtle" style={{ marginTop: '4px' }}>
                              Zona horaria local:{' '}
                              <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong> ·
                              Hora detectada: <strong>{new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</strong>
                            </p>

                            <h3 style={{ fontSize: '0.95rem', marginTop: '16px', marginBottom: '8px' }}>
                              Cámara y Escala del Personaje
                            </h3>
                            <label>
                              Zoom de la Cámara · {Math.round((data.preferences.cameraZoom ?? 1.0) * 100)}%
                              <input
                                type="range"
                                min="0.6"
                                max="2.0"
                                step="0.1"
                                value={data.preferences.cameraZoom ?? 1.0}
                                onChange={(e) =>
                                  preferences({
                                    ...data.preferences,
                                    cameraZoom: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Tamaño / Escala del Personaje · {Math.round((data.preferences.characterScale ?? character.scale ?? 1.0) * 100)}%
                              <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.05"
                                value={data.preferences.characterScale ?? character.scale ?? 1.0}
                                onChange={(e) =>
                                  preferences({
                                    ...data.preferences,
                                    characterScale: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                          </div>

                          <div className="panel db-admin-panel">
                            <div className="section-heading-inline">
                              <Database className="section-icon" />
                              <div>
                                <h2>Administración de Base de Datos</h2>
                                <p className="subtle">
                                  Gestiona el motor SQLite local ({backend || 'Cargando'}), restaura datos por sección o restablece al estado de fábrica.
                                </p>
                              </div>
                            </div>

                            <div className="storage-info">
                              <span>Ubicación de almacenamiento</span>
                              <strong>
                                {storageDetails
                                  ? storageDetails.location
                                  : backend === 'OPFS'
                                    ? 'OPFS (/pilirun.sqlite3)'
                                    : 'IndexedDB (pilirun-sqlite)'}
                              </strong>
                            </div>

                            {storageDetails?.absolutePath && (
                              <div className="storage-info absolute-path-box">
                                <span>Ruta absoluta en disco ({storageDetails.storageType || 'Local'})</span>
                                <code className="absolute-path-code">
                                  {storageDetails.absolutePath}
                                </code>
                              </div>
                            )}

                            <div className="storage-info">
                              <span>Motor y persistencia</span>
                              <strong>
                                {storageDetails?.engine ?? 'SQLite3 WASM'} ·{' '}
                                {storageDetails?.persisted ? 'Protegido contra desalojo' : 'Estándar'}
                              </strong>
                            </div>

                            <div className="db-details-grid">
                              <div className="db-count-item">
                                <span className="db-count-label">Carreras</span>
                                <span className="db-count-val">{storageDetails?.counts.runs ?? data.runs.length}</span>
                              </div>
                              <div className="db-count-item">
                                <span className="db-count-label">Personajes</span>
                                <span className="db-count-val">{storageDetails?.counts.characters ?? data.characters.length}</span>
                              </div>
                              <div className="db-count-item">
                                <span className="db-count-label">Pistas</span>
                                <span className="db-count-val">{storageDetails?.counts.tracks ?? data.tracks.length}</span>
                              </div>
                              <div className="db-count-item">
                                <span className="db-count-label">Escenarios</span>
                                <span className="db-count-val">{storageDetails?.counts.scenarios ?? data.scenarios.length}</span>
                              </div>
                              <div className="db-count-item">
                                <span className="db-count-label">Música</span>
                                <span className="db-count-val">{storageDetails?.counts.music ?? data.music.length}</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                className="secondary"
                                onClick={() => void loadStorageDetails()}
                              >
                                <RefreshCw size={14} /> Actualizar métricas
                              </button>
                              <button
                                className="secondary"
                                onClick={() => {
                                  if (navigator.storage?.persist)
                                    void navigator.storage
                                      .persist()
                                      .then((granted) => {
                                        void loadStorageDetails();
                                        setToast(
                                          granted
                                            ? 'El navegador protegió tu guardado contra limpieza automática.'
                                            : 'El navegador administra el espacio disponible. Tus datos siguen guardados.',
                                        );
                                      })
                                      .catch(() =>
                                        setToast('No se pudo solicitar almacenamiento persistente.'),
                                      );
                                  else
                                    setToast(
                                      'Este navegador administra el almacenamiento automáticamente.',
                                    );
                                }}
                              >
                                Proteger mis guardados <ShieldCheck size={14} />
                              </button>
                            </div>

                            <h3 style={{ fontSize: '0.95rem', marginTop: '6px' }}>
                              Borrado selectivo por sección
                            </h3>
                            <div className="db-section-actions">
                              <div className="db-section-row">
                                <div>
                                  <div className="db-section-title">Historial de Carreras</div>
                                  <div className="db-section-desc">Puntajes, monedas y distancias acumuladas</div>
                                </div>
                                <button
                                  className="btn-danger-outline"
                                  onClick={() => setSectionToDelete('runs')}
                                >
                                  <Trash2 size={13} /> Borrar
                                </button>
                              </div>

                              <div className="db-section-row">
                                <div>
                                  <div className="db-section-title">Personajes Personalizados</div>
                                  <div className="db-section-desc">Sprites creados o importados por el usuario</div>
                                </div>
                                <button
                                  className="btn-danger-outline"
                                  onClick={() => setSectionToDelete('characters')}
                                >
                                  <Trash2 size={13} /> Borrar
                                </button>
                              </div>

                              <div className="db-section-row">
                                <div>
                                  <div className="db-section-title">Pistas Creadas</div>
                                  <div className="db-section-desc">Circuitos diseñados en el creador de pistas</div>
                                </div>
                                <button
                                  className="btn-danger-outline"
                                  onClick={() => setSectionToDelete('tracks')}
                                >
                                  <Trash2 size={13} /> Borrar
                                </button>
                              </div>

                              <div className="db-section-row">
                                <div>
                                  <div className="db-section-title">Escenarios 2.5D</div>
                                  <div className="db-section-desc">Capas, objetos y texturas personalizadas</div>
                                </div>
                                <button
                                  className="btn-danger-outline"
                                  onClick={() => setSectionToDelete('scenarios')}
                                >
                                  <Trash2 size={13} /> Borrar
                                </button>
                              </div>

                              <div className="db-section-row">
                                <div>
                                  <div className="db-section-title">Biblioteca de Música</div>
                                  <div className="db-section-desc">Pistas de audio y sintetizadores guardados</div>
                                </div>
                                <button
                                  className="btn-danger-outline"
                                  onClick={() => setSectionToDelete('music')}
                                >
                                  <Trash2 size={13} /> Borrar
                                </button>
                              </div>

                              <div className="db-section-row">
                                <div>
                                  <div className="db-section-title">Preferencias de Usuario</div>
                                  <div className="db-section-desc">Volumen, audio, velocidad y controles</div>
                                </div>
                                <button
                                  className="btn-danger-outline"
                                  onClick={() => setSectionToDelete('preferences')}
                                >
                                  <Trash2 size={13} /> Restablecer
                                </button>
                              </div>
                            </div>

                            <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px solid rgba(255,100,100,0.2)' }}>
                              <button
                                className="btn-danger-solid"
                                style={{ width: '100%' }}
                                onClick={() => setResetConfirmOpen(true)}
                              >
                                <AlertTriangle size={17} /> Restablecer base de datos de fábrica
                              </button>
                              <p className="subtle small-print" style={{ marginTop: '6px', textAlign: 'center' }}>
                                Si la base de datos se borra o corrompe, el sistema creará una base SQLite nueva automáticamente.
                              </p>
                            </div>
                          </div>

                          <div className="panel pwa-install-panel">
                            <div className="section-heading-inline">
                              <TabletSmartphone className="section-icon" />
                              <div>
                                <h2>Instalación y Modo Tableta</h2>
                                <p className="subtle">
                                  Disfruta de PiliRun como una aplicación nativa en tu tableta o pantalla táctil, con renderizado a pantalla completa y soporte sin conexión.
                                </p>
                              </div>
                            </div>

                            <div className="storage-info">
                              <span>Estado de la aplicación</span>
                              <strong>
                                {isStandalone ? (
                                  <span style={{ color: '#d8f36a', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <CheckCircle2 size={16} /> Instalada como App (Modo Autónomo)
                                  </span>
                                ) : (
                                  <span style={{ color: '#fcd34d' }}>
                                    Ejecutándose en Navegador
                                  </span>
                                )}
                              </strong>
                            </div>

                            <div className="storage-info">
                              <span>Compatibilidad táctil</span>
                              <strong>Optimizado para Tabletas Chrome y Android</strong>
                            </div>

                            {!isStandalone ? (
                              <div style={{ marginTop: '14px' }}>
                                <button
                                  className="primary"
                                  style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
                                  onClick={() => void installApp()}
                                >
                                  <Download size={18} /> Instalar PiliRun en este Dispositivo
                                </button>
                                <p className="subtle small-print" style={{ marginTop: '8px', textAlign: 'center' }}>
                                  Al instalarse, se añadirá un icono a la pantalla de inicio de tu tableta y se abrirá sin bordes de navegador.
                                </p>
                              </div>
                            ) : (
                              <div
                                style={{
                                  marginTop: '14px',
                                  padding: '12px 14px',
                                  background: 'rgba(216, 243, 106, 0.08)',
                                  border: '1px solid rgba(216, 243, 106, 0.25)',
                                  borderRadius: '10px',
                                  fontSize: '12px',
                                  color: '#e2ece6',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                }}
                              >
                                <CheckCircle2 size={20} style={{ color: 'var(--lime)', flexShrink: 0 }} />
                                <span>
                                  ¡Aplicación ya instalada! Estás corriendo en modo tableta dedicado con almacenamiento local SQLite y sin barras de navegación.
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="panel about-panel">
                            <picture className="rocatech-logo">
                              <source
                                srcSet="/assets/rocatech/roca-tech-logo.svg"
                                type="image/svg+xml"
                              />
                              <img
                                src="/assets/rocatech/LOGO-Transparente.png"
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

      {/* Confirmation Modal: Selective Section Deletion */}
      {sectionToDelete && (
        <div className="modal-backdrop" onClick={() => setSectionToDelete(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ff6b6b' }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>¿Borrar esta sección?</h3>
            </div>
            <p className="subtle" style={{ margin: '14px 0' }}>
              Esta acción eliminará de forma permanente los datos guardados en la sección{' '}
              <strong>
                {sectionToDelete === 'runs'
                  ? 'Carreras'
                  : sectionToDelete === 'characters'
                    ? 'Personajes'
                    : sectionToDelete === 'tracks'
                      ? 'Pistas'
                      : sectionToDelete === 'scenarios'
                        ? 'Escenarios'
                        : sectionToDelete === 'music'
                          ? 'Música'
                          : 'Preferencias'}
              </strong>{' '}
              sin afectar el resto del juego.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="secondary" onClick={() => setSectionToDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn-danger-solid"
                onClick={() => void clearSection(sectionToDelete)}
              >
                Confirmar y Borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Factory Reset */}
      {resetConfirmOpen && (
        <div className="modal-backdrop" onClick={() => setResetConfirmOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
              <AlertTriangle size={26} />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Restablecer base de datos</h3>
            </div>
            <p className="subtle" style={{ margin: '14px 0', lineHeight: 1.5 }}>
              ¿Estás seguro de que deseas restablecer toda la base de datos a su estado de fábrica?
              Se borrarán todas las carreras, personajes personalizados, pistas y escenarios. La base de datos SQLite se reconstruirá limpia inmediatamente.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="secondary" onClick={() => setResetConfirmOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn-danger-solid"
                onClick={() => void factoryReset()}
              >
                Restablecer Todo
              </button>
            </div>
          </div>
        </div>
      )}
      {bossAssignTrack?.boss && (
        <BossEditorModal
          track={bossAssignTrack}
          busy={bossAssignBusy}
          error={bossAssignError}
          onChange={(boss) => setBossAssignTrack((current) => current ? { ...current, boss } : current)}
          onClose={() => { if (!bossAssignBusy) setBossAssignTrack(null); }}
          onSave={() => {
            if (bossAssignBusy || !bossAssignTrack.boss) return;
            const validationError = validateBoss(bossAssignTrack.boss);
            if (validationError) { setBossAssignError(validationError); return; }
            setBossAssignBusy(true); setBossAssignError('');
            void (async () => {
              try {
                if (bossAssignTrack.scenarioId) {
                  const scenario = data.scenarios.find((item) => item.id === bossAssignTrack.scenarioId);
                  if (!scenario) throw new Error('El escenario ya no existe.');
                  const assets = await localStore.request<ScenarioAsset[]>({ action: 'scenario-assets-get', scenarioId: scenario.id });
                  await saveScenario({ ...scenario, boss: bossAssignTrack.boss }, assets);
                } else await saveTrack(bossAssignTrack);
                setToast('Configuración del jefe guardada.');
                setBossAssignTrack(null);
              } catch (saveError) {
                setBossAssignError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el jefe.');
              } finally { setBossAssignBusy(false); }
            })();
          }}
        />
      )}
      {/* Modal: Music Assignment for Level & Boss */}
      {musicAssignTrack && (
        <div className="modal-backdrop" onClick={() => { if (!musicAssignBusy) setMusicAssignTrack(null); }}>
          <div
            className="modal-card surface-dark"
            role="dialog" aria-modal="true" aria-labelledby="music-assignment-heading"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', background: '#12251d', color: '#fff', border: '1px solid rgba(216, 243, 106, 0.3)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Music2 size={24} style={{ color: 'var(--lime)' }} />
                <h3 id="music-assignment-heading" style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>
                  Música de {musicAssignTrack.name}
                </h3>
              </div>
              <button
                className="icon-button"
                aria-label="Cerrar asignación musical" disabled={musicAssignBusy}
                onClick={() => { if (!musicAssignBusy) setMusicAssignTrack(null); }}
                style={{ color: '#a4c4b5' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#a4c4b5', marginBottom: '20px' }}>
              Asigna pistas de tu biblioteca musical para el fondo del nivel y el combate contra el jefe.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#d1e2d7', marginBottom: '6px' }}>
                  Música del Nivel (Recorrido)
                </label>
                <select
                  aria-label="Música del Nivel (Recorrido)"
                  disabled={musicAssignBusy}
                  value={musicAssignTrack.levelMusicId || ''}
                  onChange={(e) => {
                    const trackId = e.target.value || undefined;
                    const updated = { ...musicAssignTrack, levelMusicId: trackId };
                    setMusicAssignTrack(updated);

                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#0a1812',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <option value="">Banda sonora predeterminada (Chiptune Arcade)</option>
                  {data.music.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category || 'general'} · {Math.floor(m.duration)}s)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#d1e2d7', marginBottom: '6px' }}>
                  Música de Combate contra el Jefe
                </label>
                <select
                  aria-label="Música de Combate contra el Jefe"
                  disabled={musicAssignBusy}
                  value={musicAssignTrack.bossMusicId || ''}
                  onChange={(e) => {
                    const trackId = e.target.value || undefined;
                    const updated = { ...musicAssignTrack, bossMusicId: trackId };
                    setMusicAssignTrack(updated);

                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#0a1812',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <option value="">The Last Harpsichord (predeterminada)</option>
                  {data.music.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category || 'general'} · {Math.floor(m.duration)}s)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {data.music.length === 0 && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(216, 243, 106, 0.08)',
                  border: '1px solid rgba(216, 243, 106, 0.2)',
                  fontSize: '12px',
                  color: '#e2ece6',
                }}
              >
                💡 No tienes canciones personalizadas aún. Ve a la sección <strong>Mi Música</strong> para subir archivos MP3, MP4, OGG o WAV.
              </div>
            )}

            <p role="status">{musicAssignBusy ? 'Guardando…' : musicAssignError}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                className="primary"
                onClick={() => {
                  if (musicAssignBusy) return;
                  setMusicAssignBusy(true); setMusicAssignError('');
                  void (async () => {
                    try {
                      if (musicAssignTrack.scenarioId) {
                        const scenario = data.scenarios.find((item) => item.id === musicAssignTrack.scenarioId);
                        if (!scenario) throw new Error('El escenario ya no existe.');
                        await saveScenario({ ...scenario, levelMusicId: musicAssignTrack.levelMusicId, bossMusicId: musicAssignTrack.bossMusicId }, []);
                      } else await saveTrack(musicAssignTrack);
                      setToast('Configuración musical del nivel guardada.'); setMusicAssignTrack(null);
                    } catch (error) { setMusicAssignError(error instanceof Error ? error.message : 'No se pudo guardar.'); }
                    finally { setMusicAssignBusy(false); }
                  })();
                }}
              >
                Guardar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: PWA Tablet Installation Guidance */}
      {installModalOpen && (
        <div className="modal-backdrop" onClick={() => setInstallModalOpen(false)}>
          <div
            className="modal-card surface-dark pwa-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-guide-heading"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', background: '#12251d', color: '#fff', border: '1px solid rgba(216, 243, 106, 0.4)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TabletSmartphone size={24} style={{ color: 'var(--lime)' }} />
                <h3 id="pwa-guide-heading" style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>
                  Instalar PiliRun en tu Tableta
                </h3>
              </div>
              <button
                className="icon-button"
                aria-label="Cerrar guía de instalación"
                onClick={() => setInstallModalOpen(false)}
                style={{ color: '#a4c4b5' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: '#cfe2d6', lineHeight: 1.55, marginBottom: '18px' }}>
              Instala el juego para disfrutarlo <strong>a pantalla completa</strong>, sin las barras de navegación de Chrome y con <strong>soporte 100% sin conexión</strong> en tu tableta.
            </p>

            <div className="pwa-guide-steps" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="pwa-guide-step-card">
                <span className="pwa-guide-step-num">1</span>
                <div>
                  <strong>En Google Chrome para Android / Tablet:</strong>
                  <p>Toca el menú de los <strong>tres puntos (⋮)</strong> en la esquina superior derecha del navegador.</p>
                </div>
              </div>

              <div className="pwa-guide-step-card">
                <span className="pwa-guide-step-num">2</span>
                <div>
                  <strong>Opción A — Menú directo o submenú Compartir:</strong>
                  <p>
                    Toca en <strong>«Compartir...»</strong> y allí selecciona <strong>«Agregar a la pantalla principal»</strong> o <strong>«Instalar aplicación»</strong> (en tablets Chrome agrupa la instalación dentro de Compartir).
                  </p>
                </div>
              </div>

              <div className="pwa-guide-step-card">
                <span className="pwa-guide-step-num">3</span>
                <div>
                  <strong>Opción B — Botón verde en pantalla:</strong>
                  <p>
                    Toca el botón <strong>«Instalar como App en esta Tableta»</strong> que aparece debajo del título en la pantalla principal para que Chrome active el instalador directamente.
                  </p>
                </div>
              </div>
            </div>

            {deferredPrompt && (
              <div style={{ marginTop: '20px' }}>
                <button
                  className="primary"
                  style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
                  onClick={() => {
                    void (async () => {
                      try {
                        await deferredPrompt.prompt();
                        const choice = await deferredPrompt.userChoice;
                        if (choice?.outcome === 'accepted') {
                          setToast('¡Instalando PiliRun en tu tableta!');
                          setDeferredPrompt(null);
                          setInstallModalOpen(false);
                        }
                      } catch {
                        // ignore
                      }
                    })();
                  }}
                >
                  <Download size={18} /> Abrir Diálogo de Instalación de Chrome
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: deferredPrompt ? '12px' : '22px' }}>
              <button className="secondary" onClick={() => setInstallModalOpen(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function WorldCard({
  track,
  index,
  selected,
  onClick,
  onConfigureMusic,
  onConfigureBoss,
}: {
  track: Track;
  index: number;
  selected: boolean;
  onClick: () => void;
  onConfigureMusic?: () => void;
  onConfigureBoss?: () => void;
}) {
  const levelInfo = OFFICIAL_LEVELS.find((lvl) => lvl.id === track.id);
  return (
    <article className={`world-card ${selected ? 'selected' : ''}`}>
      <button className="world-select" aria-label={`Elegir mundo ${track.name}`} aria-pressed={selected} onClick={onClick} />
      <div className="world-art">
        <Landscape world={track.world} />
        <span className="world-number">{String(index + 1).padStart(2, '0')}</span>
        {selected && (
          <span className="selected-tag">
            <Check size={11} /> ELEGIDO
          </span>
        )}
        <span className="world-distance">{track.length / 10} m</span>

        {onConfigureMusic && (
          <button
            type="button"
            className="world-music-badge-btn"
            title="Configurar música para este nivel y jefe"
            onClick={(e) => {
              e.stopPropagation();
              onConfigureMusic();
            }}
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '10px',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: track.levelMusicId || track.bossMusicId ? 'var(--lime)' : 'rgba(15, 32, 25, 0.85)',
              color: track.levelMusicId || track.bossMusicId ? '#0b241c' : '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '6px',
              padding: '3px 7px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Music2 size={12} />
            <span>{track.levelMusicId || track.bossMusicId ? 'MÚSICA ACTIVA' : 'MÚSICA'}</span>
          </button>
        )}
        {onConfigureBoss && (
          <button
            type="button"
            className="world-music-badge-btn"
            title="Editar personaje y dificultad del jefe"
            aria-label={`Editar jefe de ${track.name}`}
            onClick={(event) => { event.stopPropagation(); onConfigureBoss(); }}
            style={{
              position: 'absolute', bottom: '8px', right: '10px', zIndex: 3,
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(15, 32, 25, 0.9)', color: '#fff',
              border: '1px solid rgba(255,255,255,.3)', borderRadius: '6px',
              padding: '3px 7px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Swords size={12} /><span>EDITAR JEFE</span>
          </button>
        )}
      </div>
      <div className="world-info">
        <div>
          <h3>
            {track.name}
            {levelInfo && (
              <span className="world-level-tag">
                NIVEL {levelInfo.levelNumber}
              </span>
            )}
          </h3>
          <span>
            <i className={`difficulty-dot ${track.world}`} />
            {WORLDS[track.world].difficulty}
            <span className="world-separator">·</span>
            {track.custom
              ? 'Creado por ti'
              : levelInfo
                ? levelInfo.subtitle
                : ['Respira y explora', 'Sigue la luz', 'Brilla en la oscuridad'][index % 3]}
          </span>
        </div>
        <span className="world-arrow">
          <ArrowRight size={17} />
        </span>
      </div>
    </article>
  );
}

const BOSS_ELEMENTS: Array<{ value: BossConfig['element']; label: string }> = [
  { value: 'fire', label: 'Fuego' }, { value: 'water', label: 'Agua' },
  { value: 'nature', label: 'Naturaleza' }, { value: 'electric', label: 'Rayo' },
  { value: 'cosmic', label: 'Cósmico' }, { value: 'light', label: 'Luz' },
];
const BOSS_PROJECTILES: Array<{ value: BossConfig['projectileType']; label: string }> = [
  { value: 'fireball', label: 'Bola de fuego' }, { value: 'ice_spike', label: 'Espina de hielo' },
  { value: 'boulder', label: 'Roca' }, { value: 'lightning_orb', label: 'Orbe eléctrico' },
  { value: 'star_beam', label: 'Rayo estelar' },
];

function BossEditorModal({ track, busy, error, onChange, onClose, onSave }: {
  track: Track;
  busy: boolean;
  error: string;
  onChange: (boss: BossConfig) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const boss = track.boss!;
  const update = <K extends keyof BossConfig>(key: K, value: BossConfig[K]) =>
    onChange({ ...boss, [key]: value, difficulty: key === 'difficulty' ? value as BossDifficulty : 'custom' });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card surface-dark" role="dialog" aria-modal="true" aria-labelledby="boss-editor-heading"
        onClick={(event) => event.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <div><p className="eyebrow">PERSONAJE DEL JEFE</p><h3 id="boss-editor-heading">Editar jefe de {track.name}</h3></div>
          <button className="icon-button" aria-label="Cerrar editor del jefe" disabled={busy} onClick={onClose}><X /></button>
        </div>
        <label>Nombre del jefe<input aria-label="Nombre del jefe" value={boss.name} maxLength={64} disabled={busy}
          onChange={(event) => update('name', event.target.value)} /></label>
        <fieldset disabled={busy} style={{ marginTop: '14px' }}>
          <legend>Dificultad</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(['easy', 'normal', 'hard', 'legendary'] as const).map((difficulty) => (
              <button key={difficulty} type="button" className={boss.difficulty === difficulty ? 'primary' : 'secondary'}
                aria-pressed={boss.difficulty === difficulty}
                onClick={() => onChange(applyBossDifficulty(boss, difficulty))}>
                {{ easy: 'Fácil', normal: 'Normal', hard: 'Difícil', legendary: 'Legendario' }[difficulty]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="form-grid" style={{ marginTop: '14px' }}>
          <label>Elemento / poder<select aria-label="Poder del jefe" value={boss.element} disabled={busy}
            onChange={(event) => update('element', event.target.value as BossConfig['element'])}>
            {BOSS_ELEMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
          <label>Tipo de disparo<select aria-label="Tipo de disparo del jefe" value={boss.projectileType} disabled={busy}
            onChange={(event) => update('projectileType', event.target.value as BossConfig['projectileType'])}>
            {BOSS_PROJECTILES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
          <BossNumber label="Vida (HP)" value={boss.maxHealth} min={60} max={1000} step={10} disabled={busy}
            onChange={(value) => onChange({ ...boss, health: value, maxHealth: value, difficulty: 'custom' })} />
          <BossNumber label="Daño (corazones)" value={boss.damage} min={1} max={3} step={1} disabled={busy} onChange={(value) => update('damage', value)} />
          <BossNumber label="Tamaño" value={boss.size} min={0.5} max={3} step={0.1} disabled={busy} onChange={(value) => update('size', value)} />
          <BossNumber label="Velocidad de movimiento" value={boss.speed} min={45} max={320} step={5} disabled={busy} onChange={(value) => update('speed', value)} />
          <BossNumber label="Dispara cada (segundos)" value={boss.attackFrequency} min={1.6} max={6} step={0.1} disabled={busy} onChange={(value) => update('attackFrequency', value)} />
          <BossNumber label="Velocidad del proyectil" value={boss.projectileSpeed} min={180} max={800} step={10} disabled={busy} onChange={(value) => update('projectileSpeed', value)} />
          <label>Debilidad<select value={boss.weakness} disabled={busy} onChange={(event) => update('weakness', event.target.value as BossConfig['weakness'])}>
            {BOSS_ELEMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
          <label>Resistencia<select value={boss.resistance} disabled={busy} onChange={(event) => update('resistance', event.target.value as BossConfig['resistance'])}>
            {BOSS_ELEMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
        </div>
        <p role="status" className={error ? 'error-banner' : ''}>{busy ? 'Guardando…' : error}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="secondary" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={busy} onClick={onSave}>Guardar jefe</button>
        </div>
      </div>
    </div>
  );
}

function BossNumber({ label, value, min, max, step, disabled, onChange }: {
  label: string; value: number; min: number; max: number; step: number; disabled: boolean; onChange: (value: number) => void;
}) {
  return <label>{label}<input aria-label={label} type="number" value={value} min={min} max={max} step={step} disabled={disabled}
    onChange={(event) => onChange(Number(event.target.value))} /></label>;
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
