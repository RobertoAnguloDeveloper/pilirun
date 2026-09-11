import type { Backend, SavedData, StorageRequest } from './types';
class LocalStore {
  private worker?: Worker;
  private nextId = 0;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();
  private ready?: Promise<void>;
  private failure?: Error;
  private connect(): Promise<void> {
    return (this.ready ??= new Promise<void>((resolve, reject) => {
      const start = () => {
        this.worker = new Worker('/workers/storage.worker.js', { type: 'module' });
        this.worker.onmessage = (
          event: MessageEvent<{ requestId: number; result?: unknown; error?: string }>,
        ) => {
          const { requestId, result, error } = event.data;
          const callback = this.pending.get(requestId);
          if (!callback) return;
          this.pending.delete(requestId);
          if (error) callback.reject(new Error(error));
          else callback.resolve(result);
        };
        this.worker.onerror = () => {
          this.failure = new Error('No se pudo iniciar el almacenamiento. Recarga la página.');
          for (const p of this.pending.values()) p.reject(this.failure);
          this.pending.clear();
        };
        resolve();
      };
      if (navigator.locks) {
        void navigator.locks
          .request('pilirun-database-owner', { ifAvailable: true }, async (lock) => {
            if (!lock) {
              reject(
                new Error(
                  'PiliRun está abierto en otra pestaña. Ciérrala y recarga para acceder a tus creaciones.',
                ),
              );
              return;
            }
            start();
            // Browser releases this lock and the worker on document destruction.
            await new Promise<void>(() => {});
          })
          .catch(reject);
      } else start();
    }));
  }
  async request<T>(request: StorageRequest): Promise<T> {
    await this.connect();
    if (this.failure) throw this.failure;
    return new Promise<T>((resolve, reject) => {
      const requestId = ++this.nextId;
      this.pending.set(requestId, { resolve: (result) => resolve(result as T), reject });
      this.worker!.postMessage({ ...request, requestId });
    });
  }
  init() {
    return this.request<{ backend: Backend; data: SavedData }>({ action: 'init' });
  }
}
export const localStore = new LocalStore();
