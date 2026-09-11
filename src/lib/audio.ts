import type { Preferences } from './types';
class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private voice?: { source: AudioBufferSourceNode; gain: GainNode };
  private preferences: Pick<Preferences, 'volume' | 'muted' | 'sfxVolume' | 'sfxPitch'> = {
    volume: 0.45,
    muted: false,
    sfxVolume: 0.7,
    sfxPitch: 1,
  };
  private ticket = 0;
  private ensure(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = this.preferences.muted ? 0 : this.preferences.volume;
      this.master.connect(this.context.destination);
    }
    return this.context;
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
  async play(buffer?: AudioBuffer, loopStart = 0, loopEnd = 0) {
    const ticket = ++this.ticket;
    await this.unlock();
    if (ticket !== this.ticket) return;
    const ctx = this.ensure();
    const source = ctx.createBufferSource();
    source.buffer = buffer ?? this.ambient(ctx);
    source.loop = true;
    source.loopStart = loopStart;
    source.loopEnd = loopEnd > loopStart ? loopEnd : source.buffer.duration;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.48, ctx.currentTime + 0.7);
    source.connect(gain);
    gain.connect(this.master!);
    source.start();
    if (this.voice) {
      const old = this.voice;
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
      old.source.stop(ctx.currentTime + 0.75);
      old.source.onended = () => {
        old.source.disconnect();
        old.gain.disconnect();
      };
    }
    this.voice = { source, gain };
  }
  stop() {
    this.ticket++;
    if (!this.voice || !this.context) return;
    const old = this.voice;
    old.gain.gain.cancelScheduledValues(this.context.currentTime);
    old.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
    old.source.stop(this.context.currentTime + 0.4);
    old.source.onended = () => {
      old.source.disconnect();
      old.gain.disconnect();
    };
    this.voice = undefined;
  }
  private ambient(ctx: AudioContext): AudioBuffer {
    const seconds = 8;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    const notes = [261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66];
    for (let n = 0; n < channel.length; n++) {
      const t = n / ctx.sampleRate,
        beat = t % 1;
      const envelope = Math.min(1, beat * 30) * Math.exp(-beat * 5);
      channel[n] =
        Math.sin(2 * Math.PI * notes[Math.floor(t)] * beat) * envelope * 0.18 +
        Math.sin(2 * Math.PI * 130 * t) * 0.035 * Math.sin((Math.PI * t) / seconds) ** 2;
    }
    return buffer;
  }
  effect(kind: 'jump' | 'coin' | 'hit' | 'power' | 'win') {
    if (!this.context || this.preferences.muted || this.preferences.sfxVolume <= 0) return;
    const ctx = this.context,
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    const notes = { jump: 420, coin: 1000, hit: 110, power: 700, win: 880 };
    oscillator.type = kind === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(notes[kind] * this.preferences.sfxPitch, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      notes[kind] * this.preferences.sfxPitch * (kind === 'hit' ? 0.5 : 1.5),
      ctx.currentTime + 0.12,
    );
    gain.gain.setValueAtTime(Math.max(0.001, 0.12 * this.preferences.sfxVolume), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(this.master!);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.21);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}
// A single graph lives across menu/editor switches. Audio starts only after a user gesture.
export const audioEngine = new AudioEngine();
