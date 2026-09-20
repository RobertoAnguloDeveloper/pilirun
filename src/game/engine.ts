import { localStore } from '../lib/storage';
import type { AudioTrack } from '../lib/types';
import type { Character, Hud, RunResult, Scenario, ScenarioAsset, Track } from '../lib/types';
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
  private isBossMusicPlaying = false;
  private levelMusicBuffer?: AudioTrack;
  private bossMusicBuffer?: AudioTrack;
  private musicTicket = 0;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    track: Track,
    character: Character,
    private reduced: boolean,
    private onHud: (hud: Hud) => void,
    private onEnd: (result: RunResult) => void,
    initialCameraView?: import('../lib/types').CameraView,
    scenario?: Scenario,
    scenarioAssets: ScenarioAsset[] = [],
    selectedPower?: import('../lib/combat').PowerId,
    envTimeOfDay?: import('../lib/environment').TimeOfDay,
    characterScale?: number,
    cameraZoom?: number,
    unlockedPowers?: import('../lib/combat').PowerId[],
    levelMusicBuffer?: AudioTrack,
    bossMusicBuffer?: AudioTrack,
    private onAudioError: (message: string) => void = () => {},
  ) {
    this.levelMusicBuffer = levelMusicBuffer;
    this.bossMusicBuffer = bossMusicBuffer;
    const initialScale = characterScale ?? character.scale ?? 1;
    this.simulation = new Simulation(
      track,
      character.stats,
      selectedPower,
      envTimeOfDay,
      initialScale,
      cameraZoom ?? 1,
      unlockedPowers,
    );
    if (initialCameraView) this.simulation.setCameraView(initialCameraView);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Tu navegador no permite Canvas 2D.');
    this.renderer = new Renderer(ctx, character, scenario, scenarioAssets);
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
    if (this.simulation.phase !== 'MENU') return;
    this.simulation.start();
    this.last = 0;
    this.frame = requestAnimationFrame(this.tick);
    this.onHud(this.simulation.hud());
    audioEngine.stop();
    void this.playMusic(this.levelMusicBuffer);
  }
  private async playMusic(track?: AudioTrack) {
    const ticket = ++this.musicTicket;
    try {
      const blob = track ? await localStore.request<Blob>({ action: 'music-get', id: track.id }) : undefined;
      if (this.disposed || ticket !== this.musicTicket) return;
      await audioEngine.play(track && blob ? { track, blob } : undefined);
      if (!this.disposed && ticket === this.musicTicket && this.simulation.phase === 'PAUSED') audioEngine.pause();
    } catch {
      if (this.disposed || ticket !== this.musicTicket) return;
      this.onAudioError(`No se pudo reproducir ${track?.name ?? 'la música'}. Se usará la música de respaldo.`);
      if (track && track.id !== this.levelMusicBuffer?.id) void this.playMusic(this.levelMusicBuffer);
      else {
        try { await audioEngine.play(); if (this.simulation.phase === 'PAUSED') audioEngine.pause(); } catch { /* Browser audio policy must not stop the game. */ }
      }
    }
  }
  setCameraZoom(zoom: number) {
    this.simulation.setCameraZoom(zoom);
    this.onHud(this.simulation.hud());
    this.draw();
  }
  setCharacterScale(scale: number) {
    this.simulation.setCharacterScale(scale);
    this.onHud(this.simulation.hud());
    this.draw();
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
      audioEngine.pause();
    } else if (this.simulation.phase === 'PLAYING') {
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
      void audioEngine.resume().catch(() => this.onAudioError('No se pudo reanudar la música.'));
    }
  }
  setMoveAxis(axis: -1 | 0 | 1) { this.simulation.setMoveAxis(axis); }
  jump() {
    this.simulation.jump();
  }
  slide() {
    this.simulation.duck();
  }
  castPower() {
    this.simulation.castPower();
    this.onHud(this.simulation.hud());
  }
  startChargePower() {
    this.simulation.startChargingPower();
    this.onHud(this.simulation.hud());
  }
  releaseChargePower() {
    this.simulation.releaseChargedPower();
    this.onHud(this.simulation.hud());
  }
  respawnAtCheckpoint(): boolean {
    const success = this.simulation.respawnAtCheckpoint();
    if (success) {
      this.done = false;
      this.last = 0;
      this.onHud(this.simulation.hud());
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(this.tick);
      this.draw();
    }
    return success;
  }
  private draw() {
    if (this.width <= 0 || this.height <= 0) return;
    this.renderer.render(this.simulation, this.width, this.height, this.reduced);
  }
  private tick = (now: number) => {
    if (this.simulation.phase !== 'PLAYING') return;
    if (this.last) this.accumulator += Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    while (this.accumulator >= STEP && this.simulation.phase === 'PLAYING') {
      this.simulation.update(STEP);
      this.accumulator -= STEP;
    }
    for (const event of this.simulation.events.splice(0)) audioEngine.effect(event);
    this.draw();
    const hud = this.simulation.hud();
    if (hud.isBossFight && !this.isBossMusicPlaying) {
      this.isBossMusicPlaying = true;
      if (this.bossMusicBuffer) {
        void this.playMusic(this.bossMusicBuffer);
      }
    }
    if (!hud.isBossFight && this.isBossMusicPlaying) {
      this.isBossMusicPlaying = false;
      if (this.bossMusicBuffer) void this.playMusic(this.levelMusicBuffer);
    }
    if (now - this.lastHud > 100 || hud.phase === 'GAME_OVER') {
      this.lastHud = now;
      this.onHud(hud);
    }
    if (hud.phase === 'GAME_OVER') {
      this.accumulator = 0;
      if (!this.done) {
        this.done = true;
        this.onEnd(this.simulation.result());
      }
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };
  destroy() {
    this.disposed = true;
    this.musicTicket++;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.renderer.destroy();
    audioEngine.stop();
  }
}
