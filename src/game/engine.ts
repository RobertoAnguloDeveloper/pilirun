import type { Character, Hud, RunResult, Track } from '../lib/types';
import { audioEngine } from '../lib/audio';
import { Simulation, STEP } from './simulation';
import { Renderer } from './renderer';
export class GameEngine {
  simulation: Simulation;
  private renderer: Renderer;
  private frame = 0;
  private last = 0;
  private accumulator = 0;
  private lastHud = 0;
  private width = 960;
  private height = 430;
  private observer: ResizeObserver;
  private done = false;
  constructor(
    private canvas: HTMLCanvasElement,
    track: Track,
    character: Character,
    private reduced: boolean,
    private onHud: (hud: Hud) => void,
    private onEnd: (result: RunResult) => void,
    initialCameraView?: import('../lib/types').CameraView,
  ) {
    this.simulation = new Simulation(track);
    if (initialCameraView) this.simulation.setCameraView(initialCameraView);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Tu navegador no permite Canvas 2D.');
    this.renderer = new Renderer(ctx, character);
    this.observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect(),
        dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = rect.width;
      this.height = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.draw();
    });
    this.observer.observe(canvas);
  }
  start() {
    this.simulation.start();
    this.last = 0;
    this.frame = requestAnimationFrame(this.tick);
    this.onHud(this.simulation.hud());
    void audioEngine.play();
  }
  toggleCameraView() {
    this.simulation.toggleCameraView();
    this.onHud(this.simulation.hud());
    this.draw();
  }
  setCameraView(view: import('../lib/types').CameraView) {
    this.simulation.setCameraView(view);
    this.onHud(this.simulation.hud());
    this.draw();
  }
  pause() {
    this.simulation.togglePause();
    this.onHud(this.simulation.hud());
    if (this.simulation.phase === 'PAUSED') {
      cancelAnimationFrame(this.frame);
      audioEngine.stop();
    } else if (this.simulation.phase === 'PLAYING') {
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
      void audioEngine.play();
    }
  }
  jump() {
    this.simulation.jump();
  }
  slide() {
    this.simulation.duck();
  }
  private draw() {
    this.renderer.render(this.simulation, this.width, this.height, this.reduced);
  }
  private tick = (now: number) => {
    if (this.simulation.phase !== 'PLAYING') return;
    if (this.last) this.accumulator += Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    while (this.accumulator >= STEP) {
      this.simulation.update(STEP);
      this.accumulator -= STEP;
    }
    for (const event of this.simulation.events.splice(0)) audioEngine.effect(event);
    this.draw();
    const hud = this.simulation.hud();
    if (now - this.lastHud > 100 || hud.phase === 'GAME_OVER') {
      this.lastHud = now;
      this.onHud(hud);
    }
    if (hud.phase === 'GAME_OVER') {
      if (!this.done) {
        this.done = true;
        this.onEnd(this.simulation.result());
      }
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  destroy() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    audioEngine.stop();
  }
}
