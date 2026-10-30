'use client';

/** v2 (ZIG-I35-2): adds the composer catalog; older snapshots read as missing. */
export const OFFLINE_SNAPSHOT_SCHEMA_VERSION = 2;

const DATABASE_NAME = 'zigzag-offline-snapshots';
const DATABASE_VERSION = 1;
const STORE_NAME = 'resourceSnapshots';

export type OfflineSnapshotResource =
  | 'tickets'
  | 'clients'
  /** Catalog services with their default materials, for the offline composer. */
  | 'composer-services'
  /** id, name and phone of the company's clients, for the offline composer. */
  | 'composer-clients';

export type OfflineSnapshot<T> = {
  key: string;
  resource: OfflineSnapshotResource;
  companyKey: string;
  schemaVersion: typeof OFFLINE_SNAPSHOT_SCHEMA_VERSION;
  updatedAt: string;
  data: T;
};

const getCompanySnapshotKey = (companyId: number | null | undefined): string =>
  `company:${companyId ?? 'none'}`;

export const getOfflineSnapshotKey = (
  resource: OfflineSnapshotResource,
  companyId: number | null | undefined,
): string =>
  `${resource}:v${OFFLINE_SNAPSHOT_SCHEMA_VERSION}:${getCompanySnapshotKey(
    companyId,
  )}`;

const canUseIndexedDb = (): boolean =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openSnapshotDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Unable to open IndexedDB'));
  });

const closeDb = (database: IDBDatabase) => {
  database.close();
};

export async function writeOfflineSnapshot<T>(
  resource: OfflineSnapshotResource,
  companyId: number | null | undefined,
  data: T,
): Promise<OfflineSnapshot<T>> {
  const database = await openSnapshotDb();
  const snapshot: OfflineSnapshot<T> = {
    key: getOfflineSnapshotKey(resource, companyId),
    resource,
    companyKey: getCompanySnapshotKey(companyId),
    schemaVersion: OFFLINE_SNAPSHOT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    data,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(snapshot);

    request.onerror = () => {
      closeDb(database);
      reject(request.error ?? new Error('Unable to write snapshot'));
    };
    transaction.oncomplete = () => {
      closeDb(database);
      resolve(snapshot);
    };
    transaction.onerror = () => {
      closeDb(database);
      reject(transaction.error ?? new Error('Unable to write snapshot'));
    };
  });
}

/** A snapshot written by another schema version is treated as missing. */
export const isCurrentOfflineSnapshot = <T>(
  snapshot: { schemaVersion?: unknown } | null | undefined,
): snapshot is OfflineSnapshot<T> =>
  snapshot != null && snapshot.schemaVersion === OFFLINE_SNAPSHOT_SCHEMA_VERSION;

export async function readOfflineSnapshot<T>(
  resource: OfflineSnapshotResource,
  companyId: number | null | undefined,
): Promise<OfflineSnapshot<T> | null> {
  const database = await openSnapshotDb();
  const key = getOfflineSnapshotKey(resource, companyId);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      closeDb(database);
      const snapshot = request.result as OfflineSnapshot<T> | undefined;
      resolve(isCurrentOfflineSnapshot(snapshot) ? snapshot : null);
    };
    request.onerror = () => {
      closeDb(database);
      reject(request.error ?? new Error('Unable to read snapshot'));
    };
  });
}

/** Logout (ZIG-I35-2): the snapshots hold tenant data, so a shared phone keeps none. */
export const deleteOfflineSnapshotDatabase = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      resolve();
      return;
    }
    const request = window.indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    // Another tab holds it open: the delete finishes once that tab closes it.
    request.onblocked = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error('Unable to delete offline snapshots'));
  });

export function formatOfflineSnapshotTime(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return 'una copia anterior';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatOfflineSnapshotBanner(updatedAt: string): string {
  return `Sin conexión — datos de ${formatOfflineSnapshotTime(updatedAt)}`;
}
