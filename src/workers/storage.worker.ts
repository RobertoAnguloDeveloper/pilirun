import { audioBlob, mutateAudio, seedBuiltinTracks } from './music-store';
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
async function readAll() {
  const rows = db.selectObjects('SELECT collection, id, json FROM records');
  const collection = (name: string) =>
    rows
      .filter((row) => row.collection === name)
      .map((row) => JSON.parse(String(row.json)) as unknown);

  const prefRow = rows.find((r) => r.collection === 'preferences' && r.id === 'settings');
  const progressRow = rows.find((r) => r.collection === 'preferences' && r.id === 'level_progress');
  const levelProgress = progressRow
    ? (JSON.parse(String(progressRow.json)) as import('../lib/types').LevelProgress)
    : undefined;

  return {
    backend,
    data: {
      characters: collection('characters'),
      tracks: collection('tracks'),
      scenarios: collection('scenarios'),
      draftScenario: collection('scenario-drafts')[0],
      runs: collection('runs'),
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...((prefRow ? JSON.parse(String(prefRow.json)) : collection('preferences')[0]) as object ?? {}),
      },
      levelProgress,
      characterLevel: levelProgress?.characterLevel ?? 1,
      unlockedPowers: levelProgress?.unlockedPowers ?? ['flame_burst'],
      music: [
        ...new Map(
          [
            ...db
              .selectObjects('SELECT json FROM music')
              .map((row) => JSON.parse(String(row.json))),
            ...(await seedBuiltinTracks()),
          ].map((track) => [track.id, track]),
        ).values(),
      ],
    },
  };
}
async function handle(request: StorageRequest): Promise<unknown> {
  await (initialized ??= init());
  if (request.action === 'init') return readAll();
  if (request.action === 'music-put') {
    await mutateAudio(
      request.track,
      request.blob ?? new Blob([request.bytes!], { type: request.track.mime }),
    );
    return true;
  }
  if (request.action === 'music-get') {
    const blob = await audioBlob(request.id);
    if (blob) return blob;
    const row = db.selectObject('SELECT bytes FROM music WHERE id=?', [request.id]);
    if (!row) throw new Error('La pista de audio ya no existe.');
    return new Blob([(row.bytes as Uint8Array).slice().buffer], {
      type: 'application/octet-stream',
    });
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
    } else if (request.action === 'section-clear') {
      if (request.section === 'runs') {
        db.exec("DELETE FROM records WHERE collection='runs'");
      } else if (request.section === 'characters') {
        db.exec("DELETE FROM records WHERE collection='characters'");
      } else if (request.section === 'tracks') {
        db.exec("DELETE FROM records WHERE collection='tracks'");
      } else if (request.section === 'scenarios') {
        db.exec("DELETE FROM records WHERE collection IN ('scenarios','scenario-drafts')");
        db.exec('DELETE FROM scenario_assets');
      } else if (request.section === 'music') {
        db.exec('DELETE FROM music');
      } else if (request.section === 'preferences') {
        db.exec("DELETE FROM records WHERE collection='preferences'");
      }
      await snapshot();
      db.exec('COMMIT');
      if (request.section === 'music') await mutateAudio();
      return readAll();
    } else if (request.action === 'factory-reset') {
      db.exec('DELETE FROM records');
      db.exec('DELETE FROM music');
      db.exec('DELETE FROM scenario_assets');
      await snapshot();
      db.exec('COMMIT');
      await mutateAudio();
      return readAll();
    } else if (request.action === 'storage-details') {
      db.exec('ROLLBACK'); // No mutation needed
      const countFor = (collection: string) =>
        Number(
          db.selectValue('SELECT COUNT(*) FROM records WHERE collection=?', [collection]) ?? 0,
        );
      const musicCount = (await readAll()).data.music.length;
      const location =
        backend === 'OPFS' ? 'OPFS (/pilirun.sqlite3)' : 'IndexedDB (pilirun-sqlite -> snapshots)';
      let persisted = false;
      try {
        if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
          persisted = await navigator.storage.persisted();
        }
      } catch {
        persisted = false;
      }

      // Compute realistic platform-specific absolute filesystem path on disk
      let absolutePath = '';
      const isWin =
        typeof navigator !== 'undefined' && /win/i.test(navigator.platform || navigator.userAgent);
      const isMac =
        typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);
      if (backend === 'OPFS') {
        if (isWin) {
          absolutePath =
            'C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\File System\\opfs\\pilirun.sqlite3';
        } else if (isMac) {
          absolutePath =
            '~/Library/Application Support/Google/Chrome/Default/File System/opfs/pilirun.sqlite3';
        } else {
          absolutePath = '~/.config/google-chrome/Default/File System/opfs/pilirun.sqlite3';
        }
      } else {
        if (isWin) {
          absolutePath =
            'C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\IndexedDB\\http_localhost_pilirun-sqlite.indexeddb.leveldb\\';
        } else if (isMac) {
          absolutePath =
            '~/Library/Application Support/Google/Chrome/Default/IndexedDB/http_localhost_pilirun-sqlite.indexeddb.leveldb/';
        } else {
          absolutePath =
            '~/.config/google-chrome/Default/IndexedDB/http_localhost_pilirun-sqlite.indexeddb.leveldb/';
        }
      }

      return {
        backend,
        location: location + ' + IndexedDB (pilirun-audio: archivos musicales)',
        absolutePath,
        storageType:
          backend === 'OPFS'
            ? 'Origin Private File System (OPFS direct block I/O)'
            : 'IndexedDB LevelDB Virtual Block Device',
        engine: 'SQLite3 3.49+ (WebAssembly / Wasm)',
        persisted,
        counts: {
          runs: countFor('runs'),
          characters: countFor('characters'),
          tracks: countFor('tracks'),
          scenarios: countFor('scenarios'),
          music: musicCount,
        },
      };
    }
    // Export inside the transaction. If IndexedDB fails, roll back the in-memory mutation too.
    await snapshot();
    db.exec('COMMIT');
    if (request.action === 'delete' && request.collection === 'music')
      await mutateAudio(undefined, undefined, request.id);
    return true;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* A committed SQLite change may precede a Blob-store failure. */
    }
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
