import type { AudioTrack, Preferences, Track } from './types';
import { DEFAULT_BOSS_MUSIC_ID } from './builtin-music';
export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export interface MusicSource { track: AudioTrack; blob: Blob }
export function resolveLevelMusic(track: Track, library: AudioTrack[], preferences?: Preferences, sequence = 0, random = Math.random()): AudioTrack | undefined {
  if (track.levelMusicId) return library.find((audio) => audio.id === track.levelMusicId);
  const pool = library.filter((audio) => !preferences?.jukeboxCategory || preferences.jukeboxCategory === 'all' || audio.category === preferences.jukeboxCategory);
  if (!pool.length || !preferences?.jukeboxMode || preferences.jukeboxMode === 'assigned') return undefined;
  return pool[preferences.jukeboxMode === 'shuffle' ? Math.min(pool.length - 1, Math.floor(random * pool.length)) : sequence % pool.length];
}
export function resolveBossMusic(track: Track, library: AudioTrack[]): AudioTrack | undefined {
  const assigned = track.bossMusicId
    ? library.find((audio) => audio.id === track.bossMusicId)
    : undefined;
  return assigned ?? library.find((audio) => audio.id === DEFAULT_BOSS_MUSIC_ID);
}
export function mergeTracks(builtins: Track[], saved: Track[], scenarios: Track[]): Track[] {
  const merged = new Map(builtins.map((track) => [track.id, track]));
  for (const track of [...saved, ...scenarios]) merged.set(track.id, track);
  return [...merged.values()];
}
export function validateAudio(track: AudioTrack, blob: Blob) {
  if (!blob.size || blob.size > MAX_AUDIO_BYTES) throw new Error('El archivo debe tener contenido y no superar 100 MB.');
  if (!Number.isFinite(track.duration) || track.duration <= 0 || !Number.isFinite(track.loopStart) || !Number.isFinite(track.loopEnd) || track.loopStart < 0 || track.loopEnd > track.duration || track.loopEnd - track.loopStart < 0.25)
    throw new Error('El bucle debe durar al menos 0,25 s y quedar dentro del audio.');
}
export async function readAudioDuration(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  try {
    return await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('No se pudo leer la duración del audio.')), 20000);
      const finish = (error?: Error) => {
        clearTimeout(timeout); audio.onloadedmetadata = null; audio.ondurationchange = null; audio.onerror = null;
        if (error) reject(error); else resolve(audio.duration);
      };
      const loaded = () => { if (Number.isFinite(audio.duration) && audio.duration > 0) finish(); };
      audio.onloadedmetadata = loaded; audio.ondurationchange = loaded;
      audio.onerror = () => finish(new Error('Formato de audio no compatible o archivo dañado.'));
      audio.preload = 'metadata'; audio.src = url;
    });
  } finally { audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); }
}
