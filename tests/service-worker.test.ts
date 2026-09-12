import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

it('retains successful precache entries when one asset is missing', async () => {
  const listeners: Record<
    string,
    (event: { waitUntil: (promise: Promise<void>) => void }) => void
  > = {};
  const stored = new Set<string>();
  const warn = vi.fn();
  const cache = {
    add: async (url: string) => {
      if (url === '/icon.svg') throw new Error('404');
      stored.add(url);
    },
    match: async () => ({ text: async () => '<script src="/_next/static/test.js"></script>' }),
  };
  runInNewContext(readFileSync('scripts/sw-template.js', 'utf8'), {
    self: {
      addEventListener: (name: string, handler: (typeof listeners)[string]) => {
        listeners[name] = handler;
      },
    },
    caches: { open: async () => cache },
    console: { warn },
  });
  let installation!: Promise<void>;
  listeners.install({
    waitUntil: (promise) => {
      installation = promise;
    },
  });
  await expect(installation).resolves.toBeUndefined();
  expect(stored.has('/')).toBe(true);
  expect(stored.has('/workers/storage.worker.js')).toBe(true);
  expect(stored.has('/_next/static/test.js')).toBe(true);
  expect(stored.has('/icon.svg')).toBe(false);
  expect(warn).toHaveBeenCalledOnce();
});
