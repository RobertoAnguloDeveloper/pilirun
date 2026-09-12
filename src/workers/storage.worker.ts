import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import {
  DEFAULT_PREFERENCES,
  type Backend,
  type Scenario,
  type StorageRequest,
} from '../lib/types';
import { MAX_SCENARIO_ASSETS, scenarioAssetIds, validateScenario } from '../lib/scenario';

// All SQLite work, including BLOB copies and fallback snapshots, stays off the UI thread.
let db: Database;
let sqlite: Sqlite3Static;
let backend: Backend;
let fallback: IDBDatabase | undefined;
let initialized: Promise<void> | undefined;
const schema = `
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS records (
 collection TEXT NOT NULL CHECK(collection IN ('characters','tracks','runs','preferences','scenarios','scenario-drafts')),
 id TEXT NOT NULL, json TEXT NOT NULL CHECK(json_valid(json)),
 updated_at INTEGER NOT NULL, PRIMARY KEY(collection,id)
);
CREATE TABLE IF NOT EXISTS music (
 id TEXT PRIMARY KEY, json TEXT NOT NULL CHECK(json_valid(json)), bytes BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS scenario_assets (
 scenario_id TEXT NOT NULL,
 asset_id TEXT NOT NULL,
 json TEXT NOT NULL CHECK(json_valid(json)),
 bytes BLOB NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(scenario_id,asset_id)
);
PRAGMA user_version=2;`;

function migrateSchema() {
  const version = Number(db.selectValue('PRAGMA user_version') ?? 0);
  if (version >= 2) {
    db.exec(schema);
    return;
  }
  db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL CHECK(collection IN ('characters','tracks','runs','preferences')),
      id TEXT NOT NULL, json TEXT NOT NULL CHECK(json_valid(json)),
      updated_at INTEGER NOT NULL, PRIMARY KEY(collection,id)
    );
    CREATE TABLE records_v2 (
      collection TEXT NOT NULL CHECK(collection IN ('characters','tracks','runs','preferences','scenarios','scenario-drafts')),
      id TEXT NOT NULL, json TEXT NOT NULL CHECK(json_valid(json)),
      updated_at INTEGER NOT NULL, PRIMARY KEY(collection,id)
    );
    INSERT INTO records_v2 SELECT collection,id,json,updated_at FROM records;
    DROP TABLE records;
    ALTER TABLE records_v2 RENAME TO records;
    CREATE TABLE IF NOT EXISTS music (
      id TEXT PRIMARY KEY, json TEXT NOT NULL CHECK(json_valid(json)), bytes BLOB NOT NULL
    );
    CREATE TABLE scenario_assets (
      scenario_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      json TEXT NOT NULL CHECK(json_valid(json)),
      bytes BLOB NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(scenario_id,asset_id)
    );
    PRAGMA user_version=2;
    COMMIT;
  `);
}

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
  migrateSchema();
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
      scenarios: collection('scenarios'),
      draftScenario: collection('scenario-drafts')[0],
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
  if (request.action === 'scenario-assets-get') {
    return db
      .selectObjects(
        'SELECT json,bytes FROM scenario_assets WHERE scenario_id=? ORDER BY asset_id',
        [request.scenarioId],
      )
      .map((row) => ({
        ...(JSON.parse(String(row.json)) as object),
        bytes: (row.bytes as Uint8Array).slice().buffer,
      }));
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
    } else if (request.action === 'scenario-asset-put') {
      if (request.asset.bytes.byteLength > 1_250_000)
        throw new Error('La imagen optimizada supera el límite permitido.');
      const count = Number(
        db.selectValue('SELECT COUNT(*) FROM scenario_assets WHERE scenario_id=? AND asset_id<>?', [
          request.asset.scenarioId,
          request.asset.id,
        ]),
      );
      if (count >= MAX_SCENARIO_ASSETS)
        throw new Error(`El escenario admite hasta ${MAX_SCENARIO_ASSETS} imágenes.`);
      const { bytes, ...meta } = request.asset;
      db.exec({
        sql: 'INSERT INTO scenario_assets VALUES(?,?,?,?,?) ON CONFLICT(scenario_id,asset_id) DO UPDATE SET json=excluded.json,bytes=excluded.bytes,updated_at=excluded.updated_at',
        bind: [meta.scenarioId, meta.id, JSON.stringify(meta), new Uint8Array(bytes), Date.now()],
      });
    } else if (request.action === 'scenario-draft-save') {
      const error = validateScenario(request.scenario);
      if (error) throw new Error(error);
      db.exec({
        sql: 'INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at',
        bind: ['scenario-drafts', 'active', JSON.stringify(request.scenario), Date.now()],
      });
    } else if (request.action === 'scenario-draft-clear') {
      db.exec("DELETE FROM records WHERE collection='scenario-drafts' AND id='active'");
      if (request.scenarioId) {
        const published = db.selectValue(
          "SELECT 1 FROM records WHERE collection='scenarios' AND id=?",
          [request.scenarioId],
        );
        if (!published)
          db.exec({
            sql: 'DELETE FROM scenario_assets WHERE scenario_id=?',
            bind: [request.scenarioId],
          });
      }
    } else if (request.action === 'scenario-save') {
      const error = validateScenario(request.scenario, request.assets);
      if (error) throw new Error(error);
      for (const asset of request.assets ?? []) {
        if (asset.bytes.byteLength > 1_250_000)
          throw new Error('Una imagen optimizada supera el límite permitido.');
        const { bytes, ...meta } = asset;
        db.exec({
          sql: 'INSERT INTO scenario_assets VALUES(?,?,?,?,?) ON CONFLICT(scenario_id,asset_id) DO UPDATE SET json=excluded.json,bytes=excluded.bytes,updated_at=excluded.updated_at',
          bind: [
            request.scenario.id,
            meta.id,
            JSON.stringify(meta),
            new Uint8Array(bytes),
            Date.now(),
          ],
        });
      }
      const keep = scenarioAssetIds(request.scenario);
      if (keep.length) {
        const placeholders = keep.map(() => '?').join(',');
        db.exec({
          sql: `DELETE FROM scenario_assets WHERE scenario_id=? AND asset_id NOT IN (${placeholders})`,
          bind: [request.scenario.id, ...keep],
        });
      } else {
        db.exec({
          sql: 'DELETE FROM scenario_assets WHERE scenario_id=?',
          bind: [request.scenario.id],
        });
      }
      db.exec({
        sql: 'INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET json=excluded.json,updated_at=excluded.updated_at',
        bind: ['scenarios', request.scenario.id, JSON.stringify(request.scenario), Date.now()],
      });
      db.exec("DELETE FROM records WHERE collection='scenario-drafts' AND id='active'");
    } else if (request.action === 'scenario-delete') {
      db.exec({
        sql: "DELETE FROM records WHERE collection='scenarios' AND id=?",
        bind: [request.id],
      });
      db.exec({ sql: 'DELETE FROM scenario_assets WHERE scenario_id=?', bind: [request.id] });
      const draftJson = db.selectValue(
        "SELECT json FROM records WHERE collection='scenario-drafts' AND id='active'",
      );
      if (draftJson && (JSON.parse(String(draftJson)) as Scenario).id === request.id)
        db.exec("DELETE FROM records WHERE collection='scenario-drafts' AND id='active'");
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
