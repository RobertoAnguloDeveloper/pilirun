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
import type { CameraView, Character, Hud, RunResult, Track } from '@/lib/types';

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
      if (
        event.repeat ||
        (event.target instanceof HTMLElement &&
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName))
      )
        return;
      if (event.key === ' ' && event.target instanceof HTMLButtonElement) return;

      // Jump / Vertical Spring leap
      if ([' ', 'ArrowUp', 'w', 'W'].includes(event.key)) {
        event.preventDefault();
        game.jump();
      }
      // Slide / Fast Air Drop
      if (['ArrowDown', 's', 'S'].includes(event.key)) {
        event.preventDefault();
        game.slide();
      }
      // Camera perspective switch: First-person vs 3D side view
      if (['c', 'C', 'v', 'V'].includes(event.key)) {
        event.preventDefault();
        game.toggleCameraView();
      }
      // Fullscreen quick shortcut
      if (['f', 'F'].includes(event.key)) {
        event.preventDefault();
        void toggleFullscreen();
      }
      // Pause
      if (['Escape', 'p', 'P'].includes(event.key)) game.pause();
    };

    const hidden = () => {
      if (document.hidden && game.simulation.phase === 'PLAYING') game.pause();
    };

    document.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', hidden);
    canvas.current!.focus();

    return () => {
      game.destroy();
      document.removeEventListener('keydown', key);
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
              onClick={() => engine.current?.toggleCameraView()}
              aria-label="Alternar cámara 1ª persona / lateral"
              title="Cambiar perspectiva (Tecla C o V)"
            >
              <Camera size={18} />
              <span>{hud.cameraView === 'first_person' ? '3D 1ª Persona' : '3D Lateral'}</span>
            </button>
            <button
              className="arcade-control-btn"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (Modo Videojuego)'}
              title="Pantalla Completa (Tecla F)"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              <span>{isFullscreen ? 'Ventana' : 'Pantalla Completa'}</span>
            </button>
            <button className="icon-button" onClick={onClose} aria-label="Salir de la carrera">
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
              aria-label={hud.phase === 'PAUSED' ? 'Reanudar' : 'Pausar'}
              onClick={() => engine.current?.pause()}
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
              <div className="result-card">
                <span className="round-icon">
                  <Pause />
                </span>
                <h2>Un respiro en el camino.</h2>
                <p>Modo actual: {hud.cameraView === 'first_person' ? '1ª Persona (3D)' : 'Lateral 3D'}</p>
                <button className="primary" onClick={() => engine.current?.pause()}>
                  <Play size={18} /> Seguir corriendo
                </button>
                <button
                  className="secondary"
                  onClick={() => engine.current?.toggleCameraView()}
                >
                  <Camera size={18} /> Cambiar vista de cámara
                </button>
                <button className="text-button" onClick={onClose}>
                  Volver al campamento
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
