import { closeFieldJobDb, openFieldJobDb } from '@/lib/field-jobs/idb';
import {
  LOCAL_JOBS_STORE,
  OUTBOX_STORE,
  type LocalJob,
  type OutboxEntry,
  type OutboxOperation,
  type PutLocalJobInput,
  type SyncStatus,
} from '@/lib/field-jobs/types';

export type FieldJobStoreAdapter = {
  getLocalJob: (localJobId: string) => Promise<LocalJob | null>;
  putLocalJob: (job: LocalJob) => Promise<LocalJob>;
  deleteLocalJob: (localJobId: string) => Promise<void>;
  listLocalJobsByCompany: (companyId: number) => Promise<LocalJob[]>;
  getOutboxEntry: (outboxId: string) => Promise<OutboxEntry | null>;
  putOutboxEntry: (entry: OutboxEntry) => Promise<OutboxEntry>;
  deleteOutboxEntry: (outboxId: string) => Promise<void>;
  listOutboxEntries: () => Promise<OutboxEntry[]>;
  findOutboxEntryForLocalJob: (
    localJobId: string,
    operation?: OutboxOperation,
  ) => Promise<OutboxEntry | null>;
};

const createFieldJobId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `field-job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const mergeFieldJobPayload = (
  base: LocalJob['payload'],
  patch: LocalJob['payload'],
): LocalJob['payload'] => ({
  ...base,
  ...patch,
  services: patch.services ?? base.services,
});

export class FieldJobStore implements FieldJobStoreAdapter {
  constructor(private readonly adapter: FieldJobStoreAdapter) {}

  getLocalJob(localJobId: string): Promise<LocalJob | null> {
    return this.adapter.getLocalJob(localJobId);
  }

  putLocalJob(job: LocalJob): Promise<LocalJob> {
    return this.adapter.putLocalJob(job);
  }

  deleteLocalJob(localJobId: string): Promise<void> {
    return this.adapter.deleteLocalJob(localJobId);
  }

  listLocalJobsByCompany(companyId: number): Promise<LocalJob[]> {
    return this.adapter.listLocalJobsByCompany(companyId);
  }

  getOutboxEntry(outboxId: string): Promise<OutboxEntry | null> {
    return this.adapter.getOutboxEntry(outboxId);
  }

  putOutboxEntry(entry: OutboxEntry): Promise<OutboxEntry> {
    return this.adapter.putOutboxEntry(entry);
  }

  deleteOutboxEntry(outboxId: string): Promise<void> {
    return this.adapter.deleteOutboxEntry(outboxId);
  }

  listOutboxEntries(): Promise<OutboxEntry[]> {
    return this.adapter.listOutboxEntries();
  }

  findOutboxEntryForLocalJob(
    localJobId: string,
    operation?: OutboxOperation,
  ): Promise<OutboxEntry | null> {
    return this.adapter.findOutboxEntryForLocalJob(localJobId, operation);
  }

  async saveLocalJob(input: PutLocalJobInput): Promise<LocalJob> {
    const now = new Date().toISOString();
    const existing = input.localJobId
      ? await this.getLocalJob(input.localJobId)
      : null;

    const job: LocalJob = {
      localJobId: input.localJobId ?? createFieldJobId(),
      companyId: input.companyId,
      payload: existing
        ? mergeFieldJobPayload(existing.payload, input.payload)
        : input.payload,
      syncStatus: input.syncStatus ?? existing?.syncStatus ?? 'pending',
      syncError: input.syncError ?? existing?.syncError ?? null,
      remoteTicketId: input.remoteTicketId ?? existing?.remoteTicketId ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    return this.putLocalJob(job);
  }

  async updateSyncStatus(
    localJobId: string,
    syncStatus: SyncStatus,
    syncError?: string | null,
  ): Promise<LocalJob | null> {
    const existing = await this.getLocalJob(localJobId);
    if (!existing) {
      return null;
    }

    return this.putLocalJob({
      ...existing,
      syncStatus,
      syncError: syncError ?? null,
      updatedAt: new Date().toISOString(),
    });
  }
}

const withObjectStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> => {
  const database = await openFieldJobDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    Promise.resolve(run(store))
      .then((result) => {
        if (result instanceof IDBRequest) {
          result.onsuccess = () => resolve(result.result as T);
          result.onerror = () => {
            closeFieldJobDb(database);
            reject(result.error ?? new Error('IndexedDB request failed'));
          };
          return;
        }
        resolve(result);
      })
      .catch((error) => {
        closeFieldJobDb(database);
        reject(error);
      });

    transaction.oncomplete = () => closeFieldJobDb(database);
    transaction.onerror = () => {
      closeFieldJobDb(database);
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    };
    transaction.onabort = () => {
      closeFieldJobDb(database);
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    };
  });
};

export const createIndexedDbFieldJobStoreAdapter = (): FieldJobStoreAdapter => ({
  async getLocalJob(localJobId) {
    const job = await withObjectStore<LocalJob | undefined>(
      LOCAL_JOBS_STORE,
      'readonly',
      (store) => store.get(localJobId),
    );
    return job ?? null;
  },

  async putLocalJob(job) {
    await withObjectStore(LOCAL_JOBS_STORE, 'readwrite', (store) => store.put(job));
    return job;
  },

  async deleteLocalJob(localJobId) {
    await withObjectStore(LOCAL_JOBS_STORE, 'readwrite', (store) =>
      store.delete(localJobId),
    );
  },

  async listLocalJobsByCompany(companyId) {
    const jobs = await withObjectStore<LocalJob[]>(
      LOCAL_JOBS_STORE,
      'readonly',
      (store) => store.index('companyId').getAll(companyId),
    );
    return jobs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  },

  async getOutboxEntry(outboxId) {
    const entry = await withObjectStore<OutboxEntry | undefined>(
      OUTBOX_STORE,
      'readonly',
      (store) => store.get(outboxId),
    );
    return entry ?? null;
  },

  async putOutboxEntry(entry) {
    await withObjectStore(OUTBOX_STORE, 'readwrite', (store) => store.put(entry));
    return entry;
  },

  async deleteOutboxEntry(outboxId) {
    await withObjectStore(OUTBOX_STORE, 'readwrite', (store) => store.delete(outboxId));
  },

  async listOutboxEntries() {
    const entries = await withObjectStore<OutboxEntry[]>(
      OUTBOX_STORE,
      'readonly',
      (store) => store.getAll(),
    );
    return entries.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  },

  async findOutboxEntryForLocalJob(localJobId, operation) {
    const entries = await withObjectStore<OutboxEntry[]>(
      OUTBOX_STORE,
      'readonly',
      (store) => store.index('localJobId').getAll(localJobId),
    );
    if (operation) {
      return entries.find((entry) => entry.operation === operation) ?? null;
    }
    return entries[0] ?? null;
  },
});

export const createMemoryFieldJobStoreAdapter = (): FieldJobStoreAdapter => {
  const localJobs = new Map<string, LocalJob>();
  const outboxEntries = new Map<string, OutboxEntry>();

  return {
    async getLocalJob(localJobId) {
      return localJobs.get(localJobId) ?? null;
    },

    async putLocalJob(job) {
      localJobs.set(job.localJobId, job);
      return job;
    },

    async deleteLocalJob(localJobId) {
      localJobs.delete(localJobId);
    },

    async listLocalJobsByCompany(companyId) {
      return [...localJobs.values()]
        .filter((job) => job.companyId === companyId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async getOutboxEntry(outboxId) {
      return outboxEntries.get(outboxId) ?? null;
    },

    async putOutboxEntry(entry) {
      outboxEntries.set(entry.outboxId, entry);
      return entry;
    },

    async deleteOutboxEntry(outboxId) {
      outboxEntries.delete(outboxId);
    },

    async listOutboxEntries() {
      return [...outboxEntries.values()].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
    },

    async findOutboxEntryForLocalJob(localJobId, operation) {
      const matches = [...outboxEntries.values()].filter(
        (entry) => entry.localJobId === localJobId,
      );
      if (operation) {
        return matches.find((entry) => entry.operation === operation) ?? null;
      }
      return matches[0] ?? null;
    },
  };
};

export const createFieldJobStore = (
  adapter: FieldJobStoreAdapter = createIndexedDbFieldJobStoreAdapter(),
): FieldJobStore => new FieldJobStore(adapter);

/** Browser singleton for dashboard field flows. */
export const fieldJobStore = createFieldJobStore();

export { createFieldJobId };
