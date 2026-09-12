import type { AudioTrack } from '../lib/types';
import { validateAudio } from '../lib/music';
let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('pilirun-audio', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('tracks', { keyPath: 'id' });
      request.result.createObjectStore('metadata', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
  });
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
  return new Promise((resolve, reject) => {
    const request = db.transaction('tracks').objectStore('tracks').get(id);
    request.onsuccess = () => resolve(request.result?.blob);
    request.onerror = () => reject(request.error);
  });
}
export async function mutateAudio(track?: AudioTrack, blob?: Blob, deleteId?: string) {
  if (track && blob) validateAudio(track, blob);
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['tracks', 'metadata'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar el audio en este dispositivo.'));
    try {
    if (track && blob) {
      tx.objectStore('tracks').put({ id: track.id, blob });
      tx.objectStore('metadata').put({ ...track, size: blob.size });
    } else for (const name of ['tracks', 'metadata']) {
      if (deleteId) tx.objectStore(name).delete(deleteId); else tx.objectStore(name).clear();
    }
    } catch (error) {
      try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
      reject(error);
    }
  }).catch((error: unknown) => {
    throw new Error(error instanceof DOMException && error.name === 'QuotaExceededError'
      ? 'No queda espacio en el navegador. Elimina archivos o libera almacenamiento.'
      : 'No se pudo guardar el audio en este dispositivo.');
  });
}
