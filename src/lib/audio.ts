import type { MusicSource } from './music';
import type { Preferences } from './types';
class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private voice?: { source: AudioBufferSourceNode; gain: GainNode };
  private preferences: Pick<Preferences, 'volume' | 'muted' | 'sfxVolume' | 'sfxPitch'> = {
    volume: 0.9,
    muted: false,
    sfxVolume: 0.9,
    sfxPitch: 1,
  };
  private ticket = 0;
  private media?: { audio: HTMLAudioElement; node: MediaElementAudioSourceNode; gain: GainNode; url: string };
  private selected?: AudioBuffer | MusicSource;
  private offset = 0;
  private startedAt = 0;
  private loopStart = 0;
  private loopEnd = 0;
  private ambientBuffer?: AudioBuffer;
  private paused = false;
  private retiring = new Map<ReturnType<typeof setTimeout>, () => void>();
  private ensure(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = this.preferences.muted ? 0 : this.preferences.volume;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }
  get muted(): boolean {
    return this.preferences.muted;
  }
  async unlock() {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
  }
  configure(preferences: Pick<Preferences, 'volume' | 'muted' | 'sfxVolume' | 'sfxPitch'>) {
    this.preferences = preferences;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        preferences.muted ? 0 : preferences.volume,
        this.context.currentTime,
        0.03,
      );
  }
  async decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
    return this.ensure().decodeAudioData(bytes);
  }
  async play(source?: AudioBuffer | MusicSource, loopStart = 0, loopEnd = 0) {
    const ticket = ++this.ticket;
    await this.unlock();
    if (ticket !== this.ticket) return;
    const ctx = this.ensure();
    const oldMedia = this.media;
    const oldVoice = this.voice;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.connect(this.master!);
    if (source && 'blob' in source) {
      const url = URL.createObjectURL(source.blob);
      const audio = new Audio();
      audio.preload = 'auto'; audio.src = url;
      const node = ctx.createMediaElementSource(audio);
      node.connect(gain);
      audio.currentTime = source.track.loopStart;
      audio.loop = source.track.loopStart === 0 && source.track.loopEnd >= source.track.duration - 0.05;
      audio.ontimeupdate = () => {
        if (!audio.loop && audio.currentTime >= source.track.loopEnd) audio.currentTime = source.track.loopStart;
      };
      audio.onended = () => {
        if (this.media?.audio === audio && !this.paused) {
          audio.currentTime = source.track.loopStart;
          void audio.play().catch(() => {});
        }
      };
      try { await audio.play(); } catch (error) {
        audio.removeAttribute('src'); audio.load(); node.disconnect(); gain.disconnect(); URL.revokeObjectURL(url);
        throw error;
      }
      if (ticket !== this.ticket) {
        audio.pause(); audio.removeAttribute('src'); audio.load(); node.disconnect(); gain.disconnect(); URL.revokeObjectURL(url);
        return;
      }
      this.media = { audio, node, gain, url }; this.voice = undefined;
    } else {
      const voice = ctx.createBufferSource();
      voice.buffer = source ?? (this.ambientBuffer ??= this.ambient(ctx));
      voice.loop = true; voice.loopStart = loopStart;
      voice.loopEnd = loopEnd > loopStart ? loopEnd : voice.buffer.duration;
      voice.connect(gain); voice.start(0, loopStart);
      this.voice = { source: voice, gain }; this.media = undefined;
    }
    this.selected = source; this.offset = loopStart; this.loopStart = loopStart; this.loopEnd = loopEnd;
    this.startedAt = ctx.currentTime; this.paused = false;
    gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.7);
    const oldGain = oldMedia?.gain ?? oldVoice?.gain;
    if (oldGain) {
      oldGain.gain.cancelScheduledValues(ctx.currentTime);
      oldGain.gain.setValueAtTime(oldGain.gain.value, ctx.currentTime);
      oldGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
      const release = () => {
        if (oldMedia) this.releaseMedia(oldMedia);
        if (oldVoice) { try { oldVoice.source.stop(); } catch {} oldVoice.source.disconnect(); oldVoice.gain.disconnect(); }
      };
      const timer = setTimeout(() => { this.retiring.delete(timer); release(); }, 750);
      this.retiring.set(timer, release);
    }
  }
  private releaseMedia(media: NonNullable<AudioEngine['media']>) {
    media.audio.pause(); media.audio.ontimeupdate = null; media.audio.onended = null;
    media.audio.removeAttribute('src'); media.audio.load(); media.node.disconnect(); media.gain.disconnect();
    URL.revokeObjectURL(media.url);
  }
  pause() {
    this.clearRetiring();
    this.paused = true;
    if (this.media) this.media.audio.pause();
    if (this.voice && this.context) {
      const duration = this.voice.source.loopEnd - this.voice.source.loopStart;
      this.offset = this.voice.source.loopStart + ((this.offset - this.voice.source.loopStart + this.context.currentTime - this.startedAt) % duration);
      this.voice.source.stop(); this.voice.source.disconnect(); this.voice.gain.disconnect(); this.voice = undefined;
    }
  }
  async resume() {
    const ticket = this.ticket;
    await this.unlock();
    if (ticket !== this.ticket) return;
    this.paused = false;
    if (this.media) { await this.media.audio.play(); return; }
    const offset = this.offset;
    await this.play(this.selected, this.loopStart, this.loopEnd);
    if (this.voice && this.context) {
      const old = this.voice.source;
      const source = this.context.createBufferSource();
      source.buffer = old.buffer; source.loop = true; source.loopStart = old.loopStart; source.loopEnd = old.loopEnd;
      old.stop(); old.disconnect(); source.connect(this.voice.gain); source.start(0, offset);
      this.voice.source = source; this.offset = offset; this.startedAt = this.context.currentTime;
    }
  }
  stop() {
    this.ticket++;
    this.clearRetiring();
    if (this.media) this.releaseMedia(this.media);
    if (this.voice) { try { this.voice.source.stop(); } catch {} this.voice.source.disconnect(); this.voice.gain.disconnect(); }
    this.media = undefined; this.voice = undefined; this.paused = false; this.selected = undefined; this.offset = 0;
  }
  private clearRetiring() {
    for (const [timer, release] of this.retiring) { clearTimeout(timer); release(); }
    this.retiring.clear();
  }
  private ambient(ctx: AudioContext): AudioBuffer {
    // 16-second seamless looping classic platformer chiptune soundtrack (140 BPM)
    const bpm = 140;
    const beatSec = 60 / bpm; // ~0.4285s
    const totalBeats = 32; // 8 bars of 4/4
    const seconds = totalBeats * beatSec; // ~13.714s
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, Math.round(sampleRate * seconds), sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // Note frequencies (Hz)
    const N: Record<string, number> = {
      C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
      C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
      C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
    };

    // Classic platformer main bouncy melody (32 sixteenth-beat steps repeated across two 16-beat sections)
    const melodyA = [
      'E4', 'G4', 'C5', null, 'D5', null, 'E5', null,
      'D5', 'C5', 'G4', 'E4', 'F4', 'A4', 'G4', null,
      'E4', 'G4', 'C5', null, 'D5', 'E5', 'F5', 'E5',
      'D5', 'C5', 'A4', 'B4', 'C5', null, null, null,
    ];
    const melodyB = [
      'G4', 'C5', 'E5', 'G5', 'F5', 'E5', 'D5', 'C5',
      'A4', 'C5', 'F5', null, 'G5', 'F5', 'E5', 'D5',
      'E5', 'C5', 'G4', 'C5', 'D5', 'E5', 'D5', 'G4',
      'C5', 'D5', 'E5', 'D5', 'C5', null, null, null,
    ];
    const fullMelody = [...melodyA, ...melodyB]; // 64 steps (half-beats)

    // Bouncy platformer walking bassline (Roots and fifths)
    const bassline = [
      N.C3, N.G3, N.C3, N.G3, N.A3, N.E3, N.A3, N.E3,
      N.F3, N.C3, N.F3, N.C3, N.G3, N.D3, N.G3, N.D3,
      N.C3, N.G3, N.C3, N.G3, N.A3, N.E3, N.A3, N.E3,
      N.F3, N.C3, N.F3, N.C3, N.G3, N.G3, N.C3, N.C3,
    ];

    const len = left.length;
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const beatProgress = t / beatSec;
      const currentBeat = Math.floor(beatProgress);
      const beatFraction = beatProgress - currentBeat;

      // 1. Lead Chiptune Melody (Pulse / Square wave with fast decay)
      const step = Math.floor(beatProgress * 2) % fullMelody.length;
      const noteName = fullMelody[step];
      let lead = 0;
      if (noteName && N[noteName]) {
        const freq = N[noteName];
        const stepFrac = (beatProgress * 2) % 1;
        const env = Math.max(0, 1 - stepFrac * 1.4) * Math.min(1, stepFrac * 25);
        // Pulse wave (duty cycle 0.35)
        const phase = (t * freq) % 1;
        const pulse = phase < 0.35 ? 1 : -1;
        // Warm up with soft vibrato
        const vibrato = Math.sin(t * 8 * Math.PI * 2) * 0.02;
        lead = pulse * env * 0.16 * (1 + vibrato);
      }

      // 2. Bouncy Bassline (Triangle wave + sub-sine)
      const bassFreq = bassline[currentBeat % bassline.length];
      const bassFrac = beatFraction;
      const bassEnv = Math.exp(-bassFrac * 5.5);
      const bassPhase = (t * bassFreq) % 1;
      const tri = (Math.abs(bassPhase - 0.5) * 4 - 1);
      const sub = Math.sin(2 * Math.PI * (bassFreq * 0.5) * t);
      const bass = (tri * 0.7 + sub * 0.3) * bassEnv * 0.22;

      // 3. Chiptune Percussion (Kick on 1 & 3, Snare noise on 2 & 4, Hi-hat on every 8th)
      let perc = 0;
      const isDownbeat = currentBeat % 2 === 0;
      const isUpbeat = currentBeat % 2 === 1;

      // Kick drum
      if (isDownbeat && beatFraction < 0.2) {
        const kickPitch = Math.max(45, 160 * Math.exp(-beatFraction * 35));
        perc += Math.sin(2 * Math.PI * kickPitch * beatFraction) * Math.exp(-beatFraction * 20) * 0.28;
      }
      // Snare drum (noise burst + tone)
      if (isUpbeat && beatFraction < 0.18) {
        const noise = (Math.random() * 2 - 1) * Math.exp(-beatFraction * 28);
        const snap = Math.sin(2 * Math.PI * 220 * beatFraction) * Math.exp(-beatFraction * 30);
        perc += (noise * 0.6 + snap * 0.4) * 0.24;
      }
      // Crisp Hi-hat
      const eighthFrac = (beatProgress * 2) % 1;
      if (eighthFrac < 0.08) {
        const hatNoise = (Math.random() * 2 - 1) * Math.exp(-eighthFrac * 60);
        perc += hatNoise * 0.07;
      }

      // 4. Arpeggiated background harmony (Classic 8-bit shimmer)
      const arpNotes = [N.C4, N.E4, N.G4, N.C5];
      const arpStep = Math.floor(beatProgress * 4) % arpNotes.length;
      const arpFreq = arpNotes[arpStep];
      const arpFrac = (beatProgress * 4) % 1;
      const arp = (Math.sin(2 * Math.PI * arpFreq * t) > 0 ? 0.05 : -0.05) * Math.exp(-arpFrac * 6);

      // Mix channels with subtle stereo width
      left[i] = (lead * 0.85 + bass * 0.9 + perc + arp * 0.7);
      right[i] = (lead * 0.75 + bass * 0.9 + perc + arp * 0.9);
    }

    return buffer;
  }

  effect(kind: 'jump' | 'coin' | 'hit' | 'power' | 'win' | 'destroy-shield' | 'ricochet') {
    if (!this.context || this.preferences.muted || this.preferences.sfxVolume <= 0) return;
    const ctx = this.context,
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    const notes = { jump: 420, coin: 1000, hit: 110, power: 700, win: 880, 'destroy-shield': 520, ricochet: 1320 };
    oscillator.type = kind === 'destroy-shield' ? 'sawtooth' : kind === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(notes[kind] * this.preferences.sfxPitch, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      notes[kind] * this.preferences.sfxPitch * (kind === 'hit' ? 0.5 : kind === 'destroy-shield' ? 0.35 : 1.5),
      ctx.currentTime + (kind === 'destroy-shield' ? 0.18 : 0.12),
    );
    gain.gain.setValueAtTime(Math.max(0.001, (kind === 'destroy-shield' ? 0.18 : 0.12) * this.preferences.sfxVolume), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (kind === 'destroy-shield' ? 0.25 : 0.2));
    oscillator.connect(gain);
    gain.connect(this.master!);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.26);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}
// A single graph lives across menu/editor switches. Audio starts only after a user gesture.
export const audioEngine = new AudioEngine();
