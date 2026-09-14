import type { AudioTrack } from '../lib/types';
import { BUILTIN_MUSIC } from '../lib/builtin-music';
import { validateAudio } from '../lib/music';

let database: Promise<IDBDatabase> | undefined;

function builtinMetadata(builtinTrack: (typeof BUILTIN_MUSIC)[number]): AudioTrack {
  const { builtin: _builtin, file: _file, ...track } = builtinTrack;
  return track;
}

function open() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('pilirun-audio', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('tracks', { keyPath: 'id' });
      request.result.createObjectStore('metadata', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}
export async function audioRecords(): Promise<AudioTrack[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('metadata').objectStore('metadata').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function audioBlob(id: string): Promise<Blob | undefined> {
  const db = await open();
  const stored: Blob | undefined = await new Promise((resolve, reject) => {
    const request = db.transaction('tracks').objectStore('tracks').get(id);
    request.onsuccess = () => resolve(request.result?.blob);
    request.onerror = () => reject(request.error);
  });
  if (stored) return stored;
  // Lazy-fetch builtin track from the public assets on first play
  const builtin = BUILTIN_MUSIC.find((t) => t.id === id);
  if (!builtin) return undefined;
  try {
    const resp = await fetch(`/assets/bmg/${builtin.file}.mp3`);
    if (!resp.ok) return undefined;
    const blob = await resp.blob();
    // HTTP precache keeps every track offline; IndexedDB receives only tracks
    // the player actually uses, avoiding a second eager copy of the full library.
    void storeBlob(builtinMetadata(builtin), blob).catch(() => {});
    return blob;
  } catch {
    return undefined;
  }
}
async function storeBlob(track: AudioTrack, blob: Blob): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['tracks', 'metadata'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
    tx.objectStore('tracks').put({ id: track.id, blob });
    tx.objectStore('metadata').put({ ...track, size: blob.size });
  });
}
/**
 * Seeds the built-in catalogue on initialization without duplicating every audio
 * blob. A blob moves from the service-worker-backed cache to IndexedDB only
 * after that track is played for the first time.
 */
export async function seedBuiltinTracks(): Promise<AudioTrack[]> {
  const stored = await audioRecords();
  const storedIds = new Set(stored.map((track) => track.id));
  const missing = BUILTIN_MUSIC.map(builtinMetadata).filter((track) => !storedIds.has(track.id));
  if (!missing.length) return stored;

  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('metadata', 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
    const metadata = tx.objectStore('metadata');
    for (const track of missing) metadata.put(track);
  });
  return [...missing, ...stored];
}
export async function mutateAudio(track?: AudioTrack, blob?: Blob, deleteId?: string) {
  if (track && blob) validateAudio(track, blob);
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['tracks', 'metadata'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () =>
      reject(tx.error ?? new Error('No se pudo guardar el audio en este dispositivo.'));
    try {
      if (track && blob) {
        tx.objectStore('tracks').put({ id: track.id, blob });
        tx.objectStore('metadata').put({ ...track, size: blob.size });
      } else
        for (const name of ['tracks', 'metadata']) {
          if (deleteId) tx.objectStore(name).delete(deleteId);
          else tx.objectStore(name).clear();
        }
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* The transaction may already have aborted. */
      }
      reject(error);
    }
  }).catch((error: unknown) => {
    throw new Error(
      error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'No queda espacio en el navegador. Elimina archivos o libera almacenamiento.'
        : 'No se pudo guardar el audio en este dispositivo.',
    );
  });
}
