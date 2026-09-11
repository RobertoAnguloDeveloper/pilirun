'use client';
import { useEffect, useRef, useState } from 'react';
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
  X,
  Zap,
} from 'lucide-react';
import { GameEngine } from '@/game/engine';
import { audioEngine } from '@/lib/audio';
import { DEFAULT_PREFERENCES, type CameraView, type Character, type Hud, type RunResult, type Track } from '@/lib/types';

export function GameView({
  track,
  character,
  reduced,
  initialCameraView = 'side',
  onClose,
  onResult,
}: {
  track: Track;
  character: Character;
  reduced: boolean;
  initialCameraView?: CameraView;
  onClose: () => void;
  onResult: (r: RunResult) => Promise<void>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameEngine | null>(null),
    containerRef = useRef<HTMLDivElement>(null),
    touch = useRef({ x: 0, y: 0 });

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
    const game = new GameEngine(
      canvas.current!,
      track,
      character,
      reduced,
      setHud,
      (r) => {
        setResult(r);
        setSaved('Guardando carrera…');
        void resultHandler
          .current(r)
          .then(() => setSaved('Carrera guardada en este dispositivo'))
          .catch(() => setSaved('No se pudo guardar la carrera.'));
      },
      initialCameraView,
    );

    engine.current = game;
    game.start();

    const key = (event: KeyboardEvent) => {
      // Don't intercept typing in input fields
      if (
        event.target instanceof HTMLElement &&
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)
      ) {
        return;
      }

      const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';

      // Always blur any button or activeElement if Space is pressed so it NEVER activates a button's onClick
      if (isSpace) {
        if (document.activeElement instanceof HTMLElement && document.activeElement !== canvas.current) {
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
        game.jump();
      }
      // Slide / Fast Air Drop (ArrowDown, S)
      else if (['ArrowDown', 's', 'S'].includes(event.key) || event.code === 'ArrowDown' || event.code === 'KeyS') {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        game.slide();
      }
      // Camera perspective switch: First-person vs 3D side view
      else if (['c', 'C', 'v', 'V'].includes(event.key) || event.code === 'KeyC' || event.code === 'KeyV') {
        event.preventDefault();
        event.stopPropagation();
        game.toggleCameraView();
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
        game.pause();
      }
    };

    const hidden = () => {
      if (document.hidden && game.simulation.phase === 'PLAYING') game.pause();
    };

    window.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', hidden);

    // Auto-focus canvas so keyboard events route seamlessly
    requestAnimationFrame(() => {
      canvas.current?.focus();
    });

    return () => {
      game.destroy();
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [track, character, reduced, round, initialCameraView]);

  const retry = () => {
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
            <p className="eyebrow">MODO SPEEDRUN · {hud.cameraView === 'first_person' ? '1ª PERSONA (3D)' : 'VISTA LATERAL 3D'}</p>
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
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (Modo Videojuego)'}
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
              touch.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              void audioEngine.unlock();
              if (e.clientY - touch.current.y > 25) engine.current?.slide();
              else engine.current?.jump();
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
                    <Camera size={18} /> Perspectiva: {hud.cameraView === 'first_person' ? '1ª Persona (3D)' : 'Lateral (3D)'} [C]
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

          {/* Game Over / Victory Overlay */}
          {result && (
            <div className="game-overlay">
              <div className="result-card" role="status">
                <span className="round-icon">
                  <Flag />
                </span>
                <p className="eyebrow">{result.won ? '¡META ALCANZADA!' : 'CADA SALTO CUENTA'}</p>
                <h2>{result.won ? 'Una aventura legendaria.' : 'El camino sigue ahí.'}</h2>
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
        </div>

        {/* Video Game Controls & Hotkeys HUD */}
        <div className="game-instructions">
          <p>
            <kbd>Espacio</kbd> Saltar / Doble salto ·{' '}
            <kbd>↓</kbd> Deslizarse / Caída rápida en el aire ·{' '}
            <kbd>C</kbd> / <kbd>V</kbd> Cámara 1ª Persona ·{' '}
            <kbd>F</kbd> Pantalla Completa ·{' '}
            <kbd>P</kbd> Pausa
          </p>
          <span>
            <Flag size={15} /> Checkpoint cada 300 m: +5 s y recarga de energía
          </span>
        </div>

        {/* Touch / Mobile Controls */}
        <div className="touch-controls">
          <button onPointerDown={() => engine.current?.slide()}>
            <ArrowDown /> Deslizar
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

        {/* Speedrun Tip Card */}
        <div className="hint-card">
          <Shield size={20} />
          <p>
            <strong>Físicas y verticalidad:</strong> Usa los resortes dorados en la pista para alcanzar
            los aros celestes de velocidad en el aire. Si colisionas con un obstáculo perderás vida y energía,
            pero los obstáculos superados seguirán existiendo en el mundo.
          </p>
        </div>
      </section>
    </div>
  );
}
