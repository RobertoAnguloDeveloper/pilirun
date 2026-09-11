'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Flag,
  Heart,
  Pause,
  Play,
  RotateCcw,
  X,
  Coins,
  Shield,
  Zap,
} from 'lucide-react';
import { GameEngine } from '@/game/engine';
import { audioEngine } from '@/lib/audio';
import type { Character, Hud, RunResult, Track } from '@/lib/types';
export function GameView({
  track,
  character,
  reduced,
  onClose,
  onResult,
}: {
  track: Track;
  character: Character;
  reduced: boolean;
  onClose: () => void;
  onResult: (r: RunResult) => Promise<void>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameEngine | null>(null),
    touch = useRef({ x: 0, y: 0 });
  const [hud, setHud] = useState<Hud>({
    distance: 0,
    coins: 0,
    time: 0,
    progress: 0,
    shield: 0,
    boost: 0,
    lives: 3,
    phase: 'PLAYING',
  });
  const [result, setResult] = useState<RunResult | null>(null),
    [round, setRound] = useState(0),
    [saved, setSaved] = useState('');
  const resultHandler = useRef(onResult);
  resultHandler.current = onResult;
  useEffect(() => {
    const game = new GameEngine(canvas.current!, track, character, reduced, setHud, (r) => {
      setResult(r);
      setSaved('Guardando carrera…');
      void resultHandler
        .current(r)
        .then(() => setSaved('Carrera guardada en este dispositivo'))
        .catch(() => setSaved('No se pudo guardar la carrera.'));
    });
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
      if ([' ', 'ArrowUp', 'w', 'W'].includes(event.key)) {
        event.preventDefault();
        game.jump();
      }
      if (['ArrowDown', 's', 'S'].includes(event.key)) {
        event.preventDefault();
        game.slide();
      }
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
  }, [track, character, reduced, round]);
  const retry = () => {
    setResult(null);
    setSaved('');
    setRound((n) => n + 1);
  };
  return (
    <section className="game-page" aria-label="Carrera en curso">
      <div className="section-heading">
        <div>
          <p className="eyebrow">EN LA PISTA</p>
          <h1>{track.name}</h1>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Salir de la carrera">
          <X />
        </button>
      </div>
      <div className="game-stage">
        <canvas
          ref={canvas}
          className="game-canvas"
          tabIndex={0}
          aria-label="Juego: espacio o flecha arriba para saltar; flecha abajo para deslizar; P para pausar"
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
        <div className="game-hud">
          <span>
            <Heart size={17} fill="currentColor" /> {hud.lives}
          </span>
          <span>
            <Coins size={17} /> {hud.coins}
          </span>
          <span>{hud.distance} m</span>
          <span>{hud.time} s</span>
          <button
            aria-label={hud.phase === 'PAUSED' ? 'Reanudar' : 'Pausar'}
            onClick={() => engine.current?.pause()}
          >
            {hud.phase === 'PAUSED' ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
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
        {(hud.shield > 0 || hud.boost > 0) && (
          <div className="buffs">
            {hud.shield > 0 && (
              <span>
                <Shield size={16} /> Escudo {Math.ceil(hud.shield)} s
              </span>
            )}
            {hud.boost > 0 && (
              <span>
                <Zap size={16} /> Impulso
              </span>
            )}
          </div>
        )}
        {hud.phase === 'PAUSED' && (
          <div className="game-overlay">
            <div className="result-card">
              <span className="round-icon">
                <Pause />
              </span>
              <h2>Un respiro en el camino.</h2>
              <p>Tu aventura te espera aquí.</p>
              <button className="primary" onClick={() => engine.current?.pause()}>
                <Play size={18} /> Seguir corriendo
              </button>
              <button className="text-button" onClick={onClose}>
                Volver al campamento
              </button>
            </div>
          </div>
        )}
        {result && (
          <div className="game-overlay">
            <div className="result-card" role="status">
              <span className="round-icon">
                <Flag />
              </span>
              <p className="eyebrow">{result.won ? '¡META ALCANZADA!' : 'CADA SALTO CUENTA'}</p>
              <h2>{result.won ? 'Una aventura para recordar.' : 'El camino sigue ahí.'}</h2>
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
      <div className="game-instructions">
        <p>
          <kbd>Espacio</kbd> Salta · dos veces, doble salto{' '}
          <span>
            {' '}
            <kbd>↓</kbd> Deslízate <kbd>P</kbd> Pausa
          </span>
        </p>
        <span>
          <Flag size={15} /> Checkpoint cada 300 m: +5 s
        </span>
      </div>
      <div className="touch-controls">
        <button onPointerDown={() => engine.current?.slide()}>
          <ArrowDown /> Deslizar
        </button>
        <button onPointerDown={() => engine.current?.jump()}>
          <ArrowUp /> Saltar
        </button>
      </div>
      <div className="hint-card">
        <Shield size={20} />
        <p>
          <strong>Encuentra tu ritmo.</strong> Supera tres obstáculos sin chocar para ganar un
          escudo. Tienes tres corazones y puedes saltar otra vez en el aire.
        </p>
      </div>
    </section>
  );
}
