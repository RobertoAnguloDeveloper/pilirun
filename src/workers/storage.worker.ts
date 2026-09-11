import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { DEFAULT_PREFERENCES, type Backend, type StorageRequest } from '../lib/types';

// All SQLite work, including BLOB copies and fallback snapshots, stays off the UI thread.
let db: Database;
let sqlite: Sqlite3Static;
let backend: Backend;
let fallback: IDBDatabase | undefined;
let initialized: Promise<void> | undefined;
const schema = `
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS records (
 collection TEXT NOT NULL CHECK(collection IN ('characters','tracks','runs','preferences')),
 id TEXT NOT NULL, json TEXT NOT NULL CHECK(json_valid(json)),
 updated_at INTEGER NOT NULL, PRIMARY KEY(collection,id)
);
CREATE TABLE IF NOT EXISTS music (
 id TEXT PRIMARY KEY, json TEXT NOT NULL CHECK(json_valid(json)), bytes BLOB NOT NULL
);
PRAGMA user_version=1;`;

async function openFallback(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pilirun-sqlite', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('snapshots');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function snapshot(): Promise<void> {
  if (!fallback) return;
  const bytes = sqlite.capi.sqlite3_js_db_export(db.pointer!);
  await new Promise<void>((resolve, reject) => {
    const tx = fallback!.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put(bytes, 'database');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('No se pudo guardar en este dispositivo.'));
  });
}
async function init(): Promise<void> {
  sqlite = await sqlite3InitModule();
  // Prefer a previously used fallback to avoid making existing saves disappear after a browser upgrade.
  fallback = await openFallback();
  const bytes = await new Promise<Uint8Array | undefined>((resolve, reject) => {
    const req = fallback!.transaction('snapshots').objectStore('snapshots').get('database');
    req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
    req.onerror = () => reject(req.error);
  });
  if (!bytes && sqlite.oo1.OpfsDb) {
    // An OPFS lock or disk error must surface, never silently switch to an empty database.
    db = new sqlite.oo1.OpfsDb('/pilirun.sqlite3', 'c');
    backend = 'OPFS';
    fallback.close();
    fallback = undefined;
  } else {
    backend = 'IndexedDB';
    db = new sqlite.oo1.DB('/pilirun-memory.sqlite3', 'c');
    if (bytes) {
      const ptr = sqlite.wasm.allocFromTypedArray(bytes);
      const rc = sqlite.capi.sqlite3_deserialize(
        db.pointer!,
        'main',
        ptr,
        bytes.length,
        bytes.length,
        sqlite.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite.capi.SQLITE_DESERIALIZE_RESIZEABLE,
      );
      if (rc) {
        sqlite.wasm.dealloc(ptr);
        throw new Error('No se pudo restaurar el guardado local.');
      }
    }
  }
  db.exec(schema);
}
function readAll() {
  const rows = db.selectObjects('SELECT collection, json FROM records');
  const collection = (name: string) =>
    rows
      .filter((row) => row.collection === name)
      .map((row) => JSON.parse(String(row.json)) as unknown);
  return {
    backend,
    data: {
      characters: collection('characters'),
      tracks: collection('tracks'),
      runs: collection('runs'),
      preferences: { ...DEFAULT_PREFERENCES, ...((collection('preferences')[0] as object) ?? {}) },
      music: db
        .selectObjects('SELECT json FROM music')
        .map((row) => JSON.parse(String(row.json)) as unknown),
    },
  };
}
async function handle(request: StorageRequest): Promise<unknown> {
  await (initialized ??= init());
  if (request.action === 'init') return readAll();
  if (request.action === 'music-get') {
    const row = db.selectObject('SELECT bytes FROM music WHERE id=?', [request.id]);
    if (!row) throw new Error('La pista de audio ya no existe.');
    return row.bytes;
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    if (request.action === 'save') {
      db.exec({
        sql: 'INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at',
        bind: [request.collection, request.id, JSON.stringify(request.value), Date.now()],
      });
    } else if (request.action === 'delete') {
      db.exec(
        request.collection === 'music'
          ? { sql: 'DELETE FROM music WHERE id=?', bind: [request.id] }
          : {
              sql: 'DELETE FROM records WHERE collection=? AND id=?',
              bind: [request.collection, request.id],
            },
      );
    } else if (request.action === 'music-put') {
      if (request.bytes.byteLength > 20 * 1024 * 1024)
        throw new Error('El archivo supera el límite de 20 MB.');
      const total = Number(
        db.selectValue('SELECT COALESCE(SUM(length(bytes)),0) FROM music WHERE id<>?', [
          request.track.id,
        ]),
      );
      if (total + request.bytes.byteLength > 60 * 1024 * 1024)
        throw new Error('Tu biblioteca llegó a 60 MB. Elimina una pista antes de añadir otra.');
      db.exec({
        sql: 'INSERT INTO music VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json,bytes=excluded.bytes',
        bind: [request.track.id, JSON.stringify(request.track), new Uint8Array(request.bytes)],
      });
    }
    // Export inside the transaction. If IndexedDB fails, roll back the in-memory mutation too.
    await snapshot();
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<StorageRequest & { requestId: number }>) => {
  const request = event.data;
  queue = queue.then(async () => {
    try {
      self.postMessage({ requestId: request.requestId, result: await handle(request) });
    } catch (error) {
      self.postMessage({
        requestId: request.requestId,
        error: error instanceof Error ? error.message : 'Error de guardado local.',
      });
    }
  });
};
