import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';

test('audio transactions preserve atomicity on quota failure and support deletion and reset', async ({ page }) => {
  const bundle = await build({ stdin: { contents: `export * from './src/workers/music-store';`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', globalName: 'AudioStore' });
  await page.goto('/');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const api = (window as unknown as { AudioStore: typeof import('../../src/workers/music-store') }).AudioStore;
    const track = { id: 'atomic', name: 'Atomic', mime: 'audio/wav', size: 4, loopStart: 0, loopEnd: 600, duration: 600 };
    await api.mutateAudio(track, new Blob(['full']));
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === 'metadata') throw new DOMException('quota fixture', 'QuotaExceededError');
      return put.apply(this, args);
    };
    let error = '';
    try { await api.mutateAudio({ ...track, name: 'Changed' }, new Blob(['replacement'])); }
    catch (e) { error = (e as Error).message; }
    finally { IDBObjectStore.prototype.put = put; }
    const preserved = { name: (await api.audioRecords()).find(t => t.id === track.id)?.name, bytes: await (await api.audioBlob(track.id))?.text() };
    await api.mutateAudio(undefined, undefined, track.id);
    const deleted = !(await api.audioBlob(track.id)) && !(await api.audioRecords()).some(t => t.id === track.id);
    await api.mutateAudio(track, new Blob(['full']));
    await api.mutateAudio();
    return { error, preserved, deleted, reset: (await api.audioRecords()).length === 0 && !(await api.audioBlob(track.id)) };
  });
  expect(result).toEqual({ error: 'No queda espacio en el navegador. Elimina archivos o libera almacenamiento.', preserved: { name: 'Atomic', bytes: 'full' }, deleted: true, reset: true });
});

test('legacy SQLite audio remains playable and deletable after a schema upgrade', async ({ page }, info) => {
  const filename = info.outputPath('legacy.sqlite');
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE records(collection TEXT, id TEXT, json TEXT, updated_at INTEGER, PRIMARY KEY(collection,id)); CREATE TABLE music(id TEXT PRIMARY KEY, json TEXT, bytes BLOB); PRAGMA user_version=1;`);
  const bytes = Buffer.alloc(44 + 16000);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(16000, 40);
  db.prepare('INSERT INTO music VALUES(?,?,?)').run('legacy', JSON.stringify({ id: 'legacy', name: 'Legacy WAV', mime: 'audio/wav', size: bytes.length, duration: 1, loopStart: 0, loopEnd: 1 }), bytes);
  db.close();
  await page.route('**/', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.goto('/');
  await page.evaluate(async (snapshot) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pilirun-sqlite', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').put(Uint8Array.from(atob(snapshot), c => c.charCodeAt(0)), 'database');
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    }); db.close();
  }, (await readFile(filename)).toString('base64'));
  await page.unrouteAll();
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.reload();
  await expect(page.getByRole('button', { name: /JUGAR AHORA|Vamos a correr/i })).toBeEnabled({ timeout: 30000 });
  await page.getByRole('button', { name: 'Mi música', exact: true }).click();
  await page.getByRole('button', { name: 'Reproducir Legacy WAV', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar Legacy WAV', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar Legacy WAV', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reproducir Legacy WAV', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Mi música', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reproducir Legacy WAV', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
