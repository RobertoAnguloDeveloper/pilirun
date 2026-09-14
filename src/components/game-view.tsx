'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Coins,
  Compass,
  Expand,
  Flag,
  Heart,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Sun,
  Moon,
  Swords,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  ChevronRight,
} from 'lucide-react';
import { resolveBossMusic, resolveLevelMusic } from '@/lib/music';
import { GameEngine } from '@/game/engine';
import { audioEngine } from '@/lib/audio';
import {
  DEFAULT_PREFERENCES,
  type CameraView,
  type Character,
  type Hud,
  type RunResult,
  type Scenario,
  type ScenarioAsset,
  type Track,
  type MusicTrack,
} from '@/lib/types';
import {
  POWERS,
  EFFECTIVENESS_LABELS,
  getPowerEffectiveness,
  type PowerId,
  type Power,
} from '@/lib/combat';
import {
  TIME_PERIODS,
  getCurrentDeviceTimeOfDay,
  type TimeOfDay,
} from '@/lib/environment';

const EMPTY_SCENARIO_ASSETS: ScenarioAsset[] = [];
const EMPTY_MUSIC: MusicTrack[] = [];
const EMPTY_POWERS: PowerId[] = [];

export function GameView({
  track,
  scenario,
  scenarioAssets = EMPTY_SCENARIO_ASSETS,
  character,
  reduced,
  initialCameraView = 'side',
  initialPowerId = 'flame_burst',
  timeOfDayPref = 'realtime',
  musicLibrary = EMPTY_MUSIC,
  cumulativePowers = EMPTY_POWERS,
  preferences,
  onClose,
  onResult,
  onNextLevel,
  sessionId = track.id,
  sequenceIndex = 0,
  autoStart = false,
  hasNextLevel = false,
  campaign = false,
}: {
  track: Track;
  scenario?: Scenario;
  scenarioAssets?: ScenarioAsset[];
  character: Character;
  reduced: boolean;
  initialCameraView?: CameraView;
  initialPowerId?: PowerId;
  timeOfDayPref?: 'realtime' | TimeOfDay;
  musicLibrary?: MusicTrack[];
  cumulativePowers?: PowerId[];
  preferences?: import('@/lib/types').Preferences;
  onClose: () => void;
  onResult: (r: RunResult) => Promise<void>;
  sessionId?: string;
  sequenceIndex?: number;
  autoStart?: boolean;
  hasNextLevel?: boolean;
  campaign?: boolean;
  onNextLevel?: (selectedPower: PowerId, cumulative: PowerId[]) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameEngine | null>(null),
    containerRef = useRef<HTMLDivElement>(null),
    touch = useRef({
      x: 0,
      y: 0,
      time: 0,
      pointerId: -1,
      swipingHorizontal: false,
      chargeStarted: false,
      chargeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    });

  const movementInputs = useRef(new Map<string, -1 | 1>());
  const moveInput = (id: string, direction?: -1 | 1) => {
    if (direction === undefined) movementInputs.current.delete(id);
    else movementInputs.current.set(id, direction);
    const sum = [...movementInputs.current.values()].reduce<number>((total, value) => total + value, 0);
    engine.current?.setMoveAxis(Math.sign(sum) as -1 | 0 | 1);
  };
  const clearMovement = () => { movementInputs.current.clear(); engine.current?.setMoveAxis(0); };

  // Pre-World Power Selection state
  const [selectedPower, setSelectedPower] = useState<PowerId>(initialPowerId);
  const [hasConfirmedPower, setHasConfirmedPower] = useState(autoStart);
  const [currentZoom, setCurrentZoom] = useState<number>(1.0);
  const [currentScale, setCurrentScale] = useState<number>(character.scale ?? 1.0);
  const [powerToast, setPowerToast] = useState<string>('');
  const [audioMessage, setAudioMessage] = useState('');
  const lastCollectedCount = useRef(0);
  const powerToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-progression modal state (shown only on victory)
  const [showAutoNextModal, setShowAutoNextModal] = useState<boolean>(false);
  const [completedResult, setCompletedResult] = useState<RunResult | null>(null);
  const [countdown, setCountdown] = useState(3);
  const transitioned = useRef(false);
  const continueLevel = () => {
    if (transitioned.current || !hasNextLevel || !completedResult) return;
    transitioned.current = true;
    setShowAutoNextModal(false);
    const collected = Array.from(new Set([...cumulativePowers, ...(completedResult.collectedPowers ?? [])])) as PowerId[];
    nextLevelHandler.current?.(selectedPower, collected);
  };
  useEffect(() => {
    if (!showAutoNextModal || !hasNextLevel) return;
    const deadline = performance.now() + 3000;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) continueLevel();
    }, 100);
    return () => clearInterval(timer);
  }, [showAutoNextModal, hasNextLevel, completedResult]);

  // Compute active TimeOfDay (Real-Time vs Predefined)
  const resolvedTimeOfDay: TimeOfDay = useMemo(() => {
    if (timeOfDayPref === 'realtime') {
      return getCurrentDeviceTimeOfDay().timeOfDay;
    }
    return timeOfDayPref || 'morning';
  }, [timeOfDayPref]);

  const [hud, setHud] = useState<Hud>({
    distance: 0,
    coins: 0,
    time: 0,
    progress: 0,
    shield: 0,
    boost: 0,
    lives: 3,
    energy: 100,
    maxEnergy: 100,
    height: 0,
    velocity: 0,
    speed: 290,
    hurt: 0,
    shake: 0,
    cameraView: initialCameraView,
    phase: 'PLAYING',
  });

  const [result, setResult] = useState<RunResult | null>(null),
    [round, setRound] = useState(0),
    [saved, setSaved] = useState(''),
    [isFullscreen, setIsFullscreen] = useState(false);

  const completedSession = useRef<{ track: Track; round: number } | null>(null);
  const nextLevelHandler = useRef(onNextLevel);
  nextLevelHandler.current = onNextLevel;
  const resultHandler = useRef(onResult);
  resultHandler.current = onResult;

  // Toggle true browser fullscreen for standalone arcade feeling
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
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
      // Fallback for browsers with strict permissions
      setIsFullscreen((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    if (!hasConfirmedPower) return; // Wait until player selects power on pre-world screen
    if (completedSession.current?.track === track && completedSession.current.round === round) return;

    let isDisposed = false;
    let gameInstance: GameEngine | null = null;
    lastCollectedCount.current = 0;

    const setupEngine = async () => {
      const levelMusicBuffer = resolveLevelMusic(track, musicLibrary, preferences, sequenceIndex);
      const bossMusicBuffer = resolveBossMusic(track, musicLibrary);
      if (track.levelMusicId && !levelMusicBuffer) setAudioMessage('La música asignada al nivel ya no está disponible. Se usará la música de respaldo.');
      if (track.bossMusicId && bossMusicBuffer?.id !== track.bossMusicId) setAudioMessage('La música asignada al jefe ya no está disponible. Se usará The Last Harpsichord.');

      if (isDisposed) return;

      const game = new GameEngine(
        canvas.current!,
        track,
        character,
        reduced,
        (h) => {
          setHud(h);
          if (h.phase !== 'PLAYING') clearMovement();
          // Check for new power collections
          if (h.collectedPowers && h.collectedPowers.length > lastCollectedCount.current) {
            lastCollectedCount.current = h.collectedPowers.length;
            const latest = h.collectedPowers[h.collectedPowers.length - 1] as PowerId;
            const pObj = POWERS[latest];
            if (pObj) {
              setPowerToast(`¡Poder recogido: ${pObj.name}! ${pObj.icon}`);
              clearTimeout(powerToastTimer.current);
              powerToastTimer.current = setTimeout(() => setPowerToast(''), 3200);
            }
          }
        },
        (r) => {
          completedSession.current = { track, round };
          setResult(r);
          setSaved('Guardando carrera…');
          void resultHandler
            .current(r)
            .then(() => { if (!isDisposed) setSaved('Carrera guardada'); })
            .catch(() => { if (!isDisposed) setSaved('Error al guardar'); });

          if (r.won && hasNextLevel && nextLevelHandler.current) {
            setCompletedResult(r);
            setCountdown(3);
            transitioned.current = false;
            setSelectedPower(game.simulation.activePowerId);
            setShowAutoNextModal(true);
          }
        },
        initialCameraView,
        scenario,
        scenarioAssets,
        selectedPower,
        resolvedTimeOfDay,
        currentScale,
        currentZoom,
        cumulativePowers,
        levelMusicBuffer,
        bossMusicBuffer,
        setAudioMessage,
      );

      gameInstance = game;
      engine.current = game;
      game.start();
    };

    void setupEngine();

    const key = (event: KeyboardEvent) => {
      // Don't intercept typing in input fields
      if (
        event.target instanceof HTMLElement &&
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
      ) {
        return;
      }

      if (['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
        moveInput(event.code, ['KeyA', 'ArrowLeft'].includes(event.code) ? -1 : 1);
        return;
      }
      const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';

      // Always blur any button or activeElement if Space is pressed so it NEVER activates a button's onClick
      if (isSpace) {
        if (
          document.activeElement instanceof HTMLElement &&
          document.activeElement !== canvas.current
        ) {
          document.activeElement.blur();
        }
        if (canvas.current && document.activeElement !== canvas.current) {
          canvas.current.focus();
        }
      }

      if (event.repeat && !isSpace) return;

      // Jump / Vertical Spring leap (Space, ArrowUp, W)
      if (isSpace || ['ArrowUp', 'w', 'W'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        engine.current?.jump();
      }
      // Slide / Fast Air Drop (ArrowDown, S)
      else if (
        ['ArrowDown', 's', 'S'].includes(event.key) ||
        event.code === 'ArrowDown' ||
        event.code === 'KeyS'
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        engine.current?.slide();
      }
      // Power Attack (E, J, X, or KeyQ) - Mega Man Buster charging
      else if (
        ['e', 'E', 'j', 'J', 'x', 'X', 'q', 'Q'].includes(event.key) ||
        event.code === 'KeyE' ||
        event.code === 'KeyJ' ||
        event.code === 'KeyX' ||
        event.code === 'KeyQ'
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) {
          engine.current?.startChargePower();
        }
      }
      // Camera perspective switch: First-person vs 3D side view
      else if (
        ['c', 'C', 'v', 'V'].includes(event.key) ||
        event.code === 'KeyC' ||
        event.code === 'KeyV'
      ) {
        event.preventDefault();
        event.stopPropagation();
        engine.current?.toggleCameraView();
      }
      // Camera Zoom Shortcuts: '+' or '=' to zoom in, '-' or '_' to zoom out
      else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        event.stopPropagation();
        setCurrentZoom((z) => {
          const next = Math.min(2.0, Number((z + 0.1).toFixed(1)));
          engine.current?.setCameraZoom(next);
          return next;
        });
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        event.stopPropagation();
        setCurrentZoom((z) => {
          const next = Math.max(0.6, Number((z - 0.1).toFixed(1)));
          engine.current?.setCameraZoom(next);
          return next;
        });
      }
      // Fullscreen quick shortcut (ONLY on F)
      else if (['f', 'F'].includes(event.key) || event.code === 'KeyF') {
        event.preventDefault();
        event.stopPropagation();
        void toggleFullscreen();
      }
      // Pause
      else if (['Escape', 'p', 'P'].includes(event.key) || event.code === 'KeyP') {
        event.preventDefault();
        event.stopPropagation();
        clearMovement();
        engine.current?.pause();
      }
    };

    const keyup = (event: KeyboardEvent) => {
      if (movementInputs.current.has(event.code)) moveInput(event.code);
      if (
        ['e', 'E', 'j', 'J', 'x', 'X', 'q', 'Q'].includes(event.key) ||
        ['KeyE', 'KeyJ', 'KeyX', 'KeyQ'].includes(event.code)
      ) {
        engine.current?.releaseChargePower();
      }
    };
    const hidden = () => {
      if (document.hidden) clearMovement();
      if (document.hidden && engine.current?.simulation.phase === 'PLAYING') engine.current.pause();
    };

    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', keyup, true);
    window.addEventListener('blur', clearMovement);
    document.addEventListener('visibilitychange', hidden);

    return () => {
      isDisposed = true;
      clearTimeout(powerToastTimer.current);
      if (gameInstance) gameInstance.destroy();
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('blur', clearMovement);
      movementInputs.current.clear();
      document.removeEventListener('visibilitychange', hidden);
    };
  // A run owns a snapshot of its inputs. Only an explicit session/retry starts an engine.
  }, [sessionId, round, hasConfirmedPower]);
  const retry = () => {
    transitioned.current = false;
    setShowAutoNextModal(false);
    setCompletedResult(null);
    setResult(null);
    setSaved('');
    setRound((n) => n + 1);
  };

  const isLowHealth = hud.lives <= 1;

  return (
    <div
      ref={containerRef}
      className={`standalone-arcade-wrapper ${isFullscreen ? 'arcade-fullscreen-active' : ''}`}
    >
      <section className="game-page" aria-label="Carrera en curso">
        {/* Game Title Bar (hidden or integrated in fullscreen) */}
        <div className="section-heading game-title-heading">
          <div>
            <p className="eyebrow">
              MODO SPEEDRUN ·{' '}
              {hud.cameraView === 'first_person' ? '1ª PERSONA (3D)' : 'VISTA LATERAL 3D'}
            </p>
            <h1>{track.name}</h1>
          </div>
          <div className="game-top-controls">
            <button
              className="arcade-control-btn"
              tabIndex={-1}
              onPointerDown={(e) => e.currentTarget.blur()}
              onClick={(e) => {
                e.currentTarget.blur();
                canvas.current?.focus();
                engine.current?.toggleCameraView();
              }}
              aria-label="Alternar cámara 1ª persona / lateral"
              title="Cambiar perspectiva (Tecla C o V)"
            >
              <Camera size={18} />
              <span>{hud.cameraView === 'first_person' ? '3D 1ª Persona' : '3D Lateral'}</span>
            </button>
            <button
              className="arcade-control-btn"
              tabIndex={-1}
              onPointerDown={(e) => e.currentTarget.blur()}
              onClick={(e) => {
                e.currentTarget.blur();
                canvas.current?.focus();
                void toggleFullscreen();
              }}
              aria-label={
                isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (Modo Videojuego)'
              }
              title="Pantalla Completa (Tecla F)"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              <span>{isFullscreen ? 'Ventana' : 'Pantalla Completa'}</span>
            </button>
            <button
              className="icon-button"
              tabIndex={-1}
              onPointerDown={(e) => e.currentTarget.blur()}
              onClick={(e) => {
                e.currentTarget.blur();
                onClose();
              }}
              aria-label="Salir de la carrera"
            >
              <X />
            </button>
          </div>
        </div>

        <div className={`game-stage ${hud.hurt > 0 ? 'screen-hit' : ''}`}>
          <canvas
            ref={canvas}
            className="game-canvas"
            tabIndex={0}
            aria-label="Juego: espacio o flecha arriba para saltar; flecha abajo para deslizar; C para cámara; P para pausar"
            onPointerDown={(e) => {
              clearTimeout(touch.current.chargeTimer);
              touch.current = {
                x: e.clientX,
                y: e.clientY,
                time: Date.now(),
                pointerId: e.pointerId,
                swipingHorizontal: false,
                chargeStarted: false,
                chargeTimer: undefined,
              };
              e.currentTarget.setPointerCapture(e.pointerId);

              // Long press / hold shooting area triggers Buster charging
              touch.current.chargeTimer = setTimeout(() => {
                if (!touch.current.swipingHorizontal) {
                  touch.current.chargeStarted = true;
                  engine.current?.startChargePower();
                }
              }, 200);
            }}
            onPointerMove={(e) => {
              if (touch.current.pointerId !== e.pointerId) return;
              const dx = e.clientX - touch.current.x;
              const dy = e.clientY - touch.current.y;

              // When fighting a boss on tablet, prioritize swipe left/right
              if (hud.isBossFight) {
                if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) {
                  if (!touch.current.swipingHorizontal) {
                    touch.current.swipingHorizontal = true;
                    clearTimeout(touch.current.chargeTimer);
                    if (touch.current.chargeStarted) {
                      touch.current.chargeStarted = false;
                      engine.current?.releaseChargePower();
                    }
                  }
                  const dir = dx < 0 ? -1 : 1;
                  moveInput(`swipe:${e.pointerId}`, dir);
                }
              }
            }}
            onPointerUp={(e) => {
              void audioEngine.unlock();
              clearTimeout(touch.current.chargeTimer);
              const dy = e.clientY - touch.current.y;
              const dx = e.clientX - touch.current.x;
              const dt = Date.now() - touch.current.time;

              // Clear boss swipe horizontal movement if active
              if (touch.current.swipingHorizontal) {
                moveInput(`swipe:${e.pointerId}`);
                touch.current.swipingHorizontal = false;
                return;
              }

              // If charging was active, release charged attack
              if (touch.current.chargeStarted) {
                touch.current.chargeStarted = false;
                engine.current?.releaseChargePower();
                return;
              }

              // Swipe Down -> Slide
              if (dy > 30 && Math.abs(dy) > Math.abs(dx)) {
                engine.current?.slide();
              }
              // Swipe Up -> Jump
              else if (dy < -30 && Math.abs(dy) > Math.abs(dx)) {
                engine.current?.jump();
              }
              // Quick Tap without major drag -> Attack / Cast Power
              else if (dt < 250 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
                engine.current?.castPower();
              }
              // Standard tap or other gesture -> Jump fallback
              else {
                engine.current?.jump();
              }
            }}
            onPointerCancel={(e) => {
              clearTimeout(touch.current.chargeTimer);
              if (touch.current.swipingHorizontal) {
                moveInput(`swipe:${e.pointerId}`);
                touch.current.swipingHorizontal = false;
              }
              if (touch.current.chargeStarted) {
                touch.current.chargeStarted = false;
                engine.current?.releaseChargePower();
              }
            }}
          />

          {/* Top Video Game Arcade HUD */}
          <div className="game-hud">
            <div className="hud-hearts" aria-label={`Salud: ${hud.lives} corazones`}>
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`heart-icon ${i <= hud.lives ? 'alive' : 'lost'} ${
                    i === hud.lives && hud.hurt > 0 ? 'damaged' : ''
                  }`}
                >
                  <Heart size={20} fill={i <= hud.lives ? 'currentColor' : 'none'} />
                </span>
              ))}
            </div>

            {/* Energy / Stamina Bar */}
            <div className="hud-energy-bar" title="Energía del corredor">
              <Zap size={15} className="energy-icon" />
              <div className="energy-track">
                <div
                  className="energy-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, (hud.energy / hud.maxEnergy) * 100))}%`,
                  }}
                />
              </div>
              <span className="energy-label">{hud.energy}%</span>
            </div>

            <span className="hud-metric">
              <Coins size={17} /> {hud.coins}
            </span>
            <span className="hud-metric">{hud.distance} m</span>
            <span className="hud-metric">{hud.time} s</span>

            {/* Speedometer for Speedrunners */}
            <span className="hud-speed" title="Velocidad actual">
              <Sparkles size={14} /> {hud.speed} km/h
            </span>

            <button
              className="hud-pause-btn"
              tabIndex={-1}
              onPointerDown={(e) => e.currentTarget.blur()}
              aria-label={hud.phase === 'PAUSED' ? 'Reanudar' : 'Pausar'}
              onClick={(e) => {
                e.currentTarget.blur();
                canvas.current?.focus();
                engine.current?.pause();
              }}
            >
              {hud.phase === 'PAUSED' ? <Play size={18} /> : <Pause size={18} />}
            </button>
          </div>

          {/* Race Progress Bar */}
          <div
            className="race-progress"
            role="progressbar"
            aria-label="Progreso de la carrera"
            aria-valuenow={Math.round(hud.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i style={{ width: `${hud.progress * 100}%` }} />
          </div>

          {/* Active Buffs (Shield, Boost) */}
          {(hud.shield > 0 || hud.boost > 0) && (
            <div className="buffs">
              {hud.shield > 0 && (
                <span>
                  <Shield size={16} /> Escudo {Math.ceil(hud.shield)} s
                </span>
              )}
              {hud.boost > 0 && (
                <span>
                  <Zap size={16} /> Impulso {Math.ceil(hud.boost)} s
                </span>
              )}
            </div>
          )}

          {/* Low health alert vignette */}
          {isLowHealth && hud.phase === 'PLAYING' && (
            <div className="low-health-warning" aria-hidden="true" />
          )}

          {/* Pause Screen Overlay */}
          {hud.phase === 'PAUSED' && (
            <div className="game-overlay">
              <div className="result-card pause-modal-card">
                <span className="round-icon">
                  <Pause />
                </span>
                <h2>Juego en Pausa</h2>
                <p>Configura tu partida y ajustes sin salir del juego.</p>

                <div className="pause-actions-grid">
                  <button
                    className="primary"
                    tabIndex={-1}
                    onPointerDown={(e) => e.currentTarget.blur()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      canvas.current?.focus();
                      engine.current?.pause();
                    }}
                  >
                    <Play size={18} fill="currentColor" /> Reanudar [P]
                  </button>
                  <button
                    className="secondary"
                    tabIndex={-1}
                    onPointerDown={(e) => e.currentTarget.blur()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      canvas.current?.focus();
                      engine.current?.toggleCameraView();
                    }}
                  >
                    <Camera size={18} /> Perspectiva:{' '}
                    {hud.cameraView === 'first_person' ? '1ª Persona (3D)' : 'Lateral (3D)'} [C]
                  </button>
                  <button
                    className="secondary"
                    tabIndex={-1}
                    onPointerDown={(e) => e.currentTarget.blur()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      canvas.current?.focus();
                      void toggleFullscreen();
                    }}
                  >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    {isFullscreen ? 'Salir de Pantalla Completa' : 'Modo Pantalla Completa [F]'}
                  </button>
                  <button
                    className="secondary"
                    tabIndex={-1}
                    onPointerDown={(e) => e.currentTarget.blur()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      retry();
                    }}
                  >
                    <RotateCcw size={18} /> Reiniciar Carrera [R]
                  </button>
                </div>

                <div className="pause-settings-box">
                  <div className="pause-setting-row">
                    <span>Sonido y Efectos</span>
                    <button
                      className="arcade-chip-btn"
                      onClick={() => {
                        const next = !audioEngine.muted;
                        audioEngine.configure({ ...DEFAULT_PREFERENCES, muted: next });
                      }}
                    >
                      {audioEngine.muted ? 'Silenciado' : 'Activo'}
                    </button>
                  </div>
                </div>

                <button className="text-button" onClick={onClose}>
                  Salir al Menú Principal [ESC]
                </button>
              </div>
            </div>
          )}

          {audioMessage && <p role="status" className="game-audio-message">{audioMessage}</p>}
          {/* In-game power collection toast */}
          {powerToast && (
            <div className="power-collected-toast" role="alert">
              <Sparkles size={20} className="text-amber-300 animate-spin" />
              <span>{powerToast}</span>
            </div>
          )}

          {showAutoNextModal && completedResult && (
            <div className="game-overlay auto-progression-overlay">
              <div className="result-card power-select-modal auto-next-card" role="dialog" aria-modal="true" aria-labelledby="next-level-heading">
                <h2 id="next-level-heading">¡Nivel completado!</h2>
                <p role="status">Siguiente nivel en {countdown}…</p>
                <p>Tus poderes se conservan. Comenzarás con {POWERS[selectedPower].name}.</p>
                <button className="primary" onClick={continueLevel}>Continuar ahora</button>
                <button className="secondary" onClick={() => { transitioned.current = true; setShowAutoNextModal(false); }}>Cancelar</button>
                <small>{saved}</small>
              </div>
            </div>
          )}

          {/* Game Over / Victory Overlay (only shown if not auto-progressing) */}
          {result && !showAutoNextModal && (
            <div className="game-overlay">
              <div className="result-card" role="status">
                <span className="round-icon">
                  <Flag />
                </span>
                <p className="eyebrow">{result.won ? '¡META ALCANZADA!' : 'CADA SALTO CUENTA'}</p>
                <h2>{result.won ? campaign && !hasNextLevel ? '¡Aventura completada!' : 'Una aventura legendaria.' : 'El camino sigue ahí.'}</h2>
                <div className="result-stats">
                  <div>
                    <strong>{result.score.toLocaleString('es')}</strong>
                    <small>puntos</small>
                  </div>
                  <div>
                    <strong>{result.coins}</strong>
                    <small>monedas</small>
                  </div>
                  <div>
                    <strong>{result.distance}</strong>
                    <small>metros</small>
                  </div>
                </div>
                <button className="primary" onClick={retry}>
                  <RotateCcw size={18} /> Otra aventura
                </button>
                <button className="text-button" onClick={onClose}>
                  Volver al campamento
                </button>
                <small>{saved}</small>
              </div>
            </div>
          )}

          <div className="game-floating-controls" aria-label="Controles de vista">
            <button
              aria-label="Acercar cámara"
              title="Acercar cámara (Tecla +)"
              onClick={() => {
                setCurrentZoom((z) => {
                  const next = Math.min(2.0, Number((z + 0.1).toFixed(1)));
                  engine.current?.setCameraZoom(next);
                  return next;
                });
              }}
            >
              <ZoomIn size={18} />
              <span>{Math.round(currentZoom * 100)}%</span>
            </button>
            <button
              aria-label="Alejar cámara"
              title="Alejar cámara (Tecla -)"
              onClick={() => {
                setCurrentZoom((z) => {
                  const next = Math.max(0.6, Number((z - 0.1).toFixed(1)));
                  engine.current?.setCameraZoom(next);
                  return next;
                });
              }}
            >
              <ZoomOut size={18} />
            </button>
            <button
              aria-label="Alternar cámara 1ª persona / lateral"
              onClick={() => engine.current?.toggleCameraView()}
            >
              <Camera size={18} />
              <span>{hud.cameraView === 'first_person' ? 'Lateral' : '1ª persona'}</span>
            </button>
            <button
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button aria-label="Salir de la carrera" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Pre-World Power Selector Modal (Kid-Friendly 6+) */}
          {!hasConfirmedPower && (
            <div className="game-overlay pre-world-power-overlay">
              <div className="result-card power-select-modal">
                <div className="power-modal-header">
                  <span className="round-icon">
                    <Swords size={28} />
                  </span>
                  <h2>¡Elige tu Poder Mágico!</h2>
                  <p>
                    Selecciona el poder que usarás en <strong>{track.name}</strong>.
                    {track.boss && (
                      <span className="boss-intel-badge">
                        Jefe del Mundo: <strong>{track.boss.name}</strong> ({track.boss.element})
                      </span>
                    )}
                  </p>
                </div>

                <div className="power-cards-grid">
                  {(Object.values(POWERS) as Power[]).map((power) => {
                    const eff = track.boss ? getPowerEffectiveness(power.element, track.boss) : 'normal';
                    const effLabel = EFFECTIVENESS_LABELS[eff];
                    const isSelected = selectedPower === power.id;

                    return (
                      <button
                        key={power.id}
                        type="button"
                        className={`power-select-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedPower(power.id)}
                      >
                        <div className="power-icon-circle" style={{ backgroundColor: power.color }}>
                          <span>{power.icon}</span>
                        </div>
                        <div className="power-card-info">
                          <strong>{power.name}</strong>
                          <small>{power.description}</small>
                        </div>
                        <div
                          className="power-eff-badge"
                          style={{ color: effLabel.color, borderColor: effLabel.color }}
                        >
                          {effLabel.badge}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="power-modal-footer">
                  <div className="time-of-day-info">
                    {TIME_PERIODS[resolvedTimeOfDay].sunMoonType === 'sun' ? (
                      <Sun size={18} className="text-amber-400" />
                    ) : (
                      <Moon size={18} className="text-indigo-300" />
                    )}
                    <span>{TIME_PERIODS[resolvedTimeOfDay].name} · {TIME_PERIODS[resolvedTimeOfDay].bonusDescription}</span>
                  </div>

                  <button
                    className="primary power-start-btn"
                    onClick={() => setHasConfirmedPower(true)}
                  >
                    <Play size={20} fill="currentColor" /> ¡Comenzar Carrera!
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="touch-controls">
            {hud.isBossFight && ([-1, 1] as const).map((direction) => <button key={direction}
              aria-label={direction < 0 ? 'Retroceder' : 'Avanzar'} disabled={hud.phase !== 'PLAYING'}
              onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); moveInput(`touch:${event.pointerId}`, direction); }}
              onPointerUp={(event) => moveInput(`touch:${event.pointerId}`)}
              onPointerCancel={(event) => moveInput(`touch:${event.pointerId}`)}
              onLostPointerCapture={(event) => moveInput(`touch:${event.pointerId}`)}>{direction < 0 ? '← Retroceder' : 'Avanzar →'}</button>)}
            <button onPointerDown={() => engine.current?.slide()}>
              <ArrowDown /> Deslizar
            </button>
            <button
              className={`attack-touch-btn ${hud.isChargingPower ? 'charging-active' : ''}`}
              style={{
                backgroundColor: hud.isChargingPower && (hud.powerChargeRatio ?? 0) > 0.6
                  ? '#ef4444'
                  : hud.isChargingPower && (hud.powerChargeRatio ?? 0) > 0.25
                    ? '#f97316'
                    : POWERS[selectedPower].color
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                engine.current?.startChargePower();
              }}
              onPointerUp={() => {
                engine.current?.releaseChargePower();
              }}
              onPointerCancel={() => {
                engine.current?.releaseChargePower();
              }}
              onLostPointerCapture={() => {
                engine.current?.releaseChargePower();
              }}
              title="Mantén presionado para cargar el disparo mágico (estilo Mega Buster)"
            >
              <span>{POWERS[selectedPower].icon}</span> {hud.isChargingPower ? `¡Cargando ${Math.round((hud.powerChargeRatio ?? 0) * 100)}%!` : 'Atacar'}
            </button>
            <button
              className="secondary-touch-btn"
              onClick={() => engine.current?.toggleCameraView()}
            >
              <Camera size={18} /> Cámara
            </button>
            <button onPointerDown={() => engine.current?.jump()}>
              <ArrowUp /> Saltar
            </button>
          </div>
        </div>

        {/* Video Game Controls & Hotkeys HUD */}
        <div className="game-instructions">
          <p>
            <kbd>A / D · ← / →</kbd> Moverse contra el jefe (o desliza la pantalla en tablets) · <kbd>Espacio</kbd> Saltar · <kbd>↓</kbd> Deslizarse · <kbd>E</kbd> / <kbd>J</kbd> (mantener para Cargar Poder Buster) ·{' '}
            <kbd>C</kbd> / <kbd>V</kbd> Cámara 1ª Persona · <kbd>F</kbd> Pantalla Completa · <kbd>P</kbd> Pausa
          </p>
          <span>
            <Flag size={15} /> {TIME_PERIODS[resolvedTimeOfDay].name}: {TIME_PERIODS[resolvedTimeOfDay].bonusDescription}
          </span>
        </div>

        {/* Speedrun Tip Card */}
        <div className="hint-card">
          <Shield size={20} />
          <p>
            <strong>Físicas y verticalidad:</strong> Usa los resortes dorados en la pista para
            alcanzar los aros celestes de velocidad en el aire. Si colisionas con un obstáculo
            perderás vida y energía, pero los obstáculos superados seguirán existiendo en el mundo.
          </p>
        </div>
      </section>
    </div>
  );
}
