import {
  FIELD_JOB_DB_NAME,
  FIELD_JOB_DB_VERSION,
  LOCAL_JOBS_STORE,
  OUTBOX_STORE,
} from '@/lib/field-jobs/types';

export const canUseIndexedDb = (): boolean =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

export const openFieldJobDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = window.indexedDB.open(
      FIELD_JOB_DB_NAME,
      FIELD_JOB_DB_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCAL_JOBS_STORE)) {
        const localJobs = database.createObjectStore(LOCAL_JOBS_STORE, {
          keyPath: 'localJobId',
        });
        localJobs.createIndex('companyId', 'companyId', { unique: false });
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = database.createObjectStore(OUTBOX_STORE, {
          keyPath: 'outboxId',
        });
        outbox.createIndex('localJobId', 'localJobId', { unique: false });
        outbox.createIndex('companyId', 'companyId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Unable to open IndexedDB'));
  });

export const closeFieldJobDb = (database: IDBDatabase): void => {
  database.close();
};

export const idbRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'));
  });

export const idbTransaction = (
  database: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
