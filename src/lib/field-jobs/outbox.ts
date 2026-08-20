import {
  createFieldJobId,
  FieldJobStore,
  mergeFieldJobPayload,
} from '@/lib/field-jobs/store';
import type {
  FieldJobPayload,
  LocalJob,
  OutboxEntry,
  OutboxOperation,
} from '@/lib/field-jobs/types';

export type EnqueueCreateInput = {
  companyId: number;
  payload: FieldJobPayload;
  localJobId?: string;
};

export type EnqueueUpdateInput = {
  localJobId: string;
  companyId: number;
  payload: FieldJobPayload;
};

/**
 * When multiple offline edits target the same local job, keep a single outbox
 * row: merge into an existing create, or replace an existing update.
 */
export const coalesceOutboxEntry = (
  existing: OutboxEntry | null,
  next: {
    localJobId: string;
    companyId: number;
    operation: OutboxOperation;
    payload: FieldJobPayload;
    now: string;
  },
): OutboxEntry => {
  if (!existing) {
    return {
      outboxId: createFieldJobId(),
      localJobId: next.localJobId,
      companyId: next.companyId,
      operation: next.operation,
      payload: next.payload,
      createdAt: next.now,
      updatedAt: next.now,
    };
  }

  return {
    ...existing,
    payload: mergeFieldJobPayload(existing.payload, next.payload),
    updatedAt: next.now,
  };
};

export const enqueueFieldJobCreate = async (
  store: FieldJobStore,
  input: EnqueueCreateInput,
): Promise<{ job: LocalJob; outboxEntry: OutboxEntry }> => {
  const now = new Date().toISOString();
  const job = await store.saveLocalJob({
    localJobId: input.localJobId,
    companyId: input.companyId,
    payload: input.payload,
    syncStatus: 'pending',
    syncError: null,
  });

  const existingCreate = await store.findOutboxEntryForLocalJob(
    job.localJobId,
    'create',
  );
  const outboxEntry = coalesceOutboxEntry(existingCreate, {
    localJobId: job.localJobId,
    companyId: input.companyId,
    operation: 'create',
    payload: job.payload,
    now,
  });

  await store.putOutboxEntry(outboxEntry);
  return { job, outboxEntry };
};

export const enqueueFieldJobUpdate = async (
  store: FieldJobStore,
  input: EnqueueUpdateInput,
): Promise<{ job: LocalJob; outboxEntry: OutboxEntry }> => {
  const now = new Date().toISOString();
  const job = await store.saveLocalJob({
    localJobId: input.localJobId,
    companyId: input.companyId,
    payload: input.payload,
    syncStatus: 'pending',
    syncError: null,
  });

  const pendingCreate = await store.findOutboxEntryForLocalJob(
    job.localJobId,
    'create',
  );
  if (pendingCreate && !job.remoteTicketId) {
    const outboxEntry = coalesceOutboxEntry(pendingCreate, {
      localJobId: job.localJobId,
      companyId: input.companyId,
      operation: 'create',
      payload: job.payload,
      now,
    });
    await store.putOutboxEntry(outboxEntry);
    return { job, outboxEntry };
  }

  if (pendingCreate && job.remoteTicketId) {
    await store.deleteOutboxEntry(pendingCreate.outboxId);
  }

  const pendingUpdate = await store.findOutboxEntryForLocalJob(
    job.localJobId,
    'update',
  );
  const outboxEntry = coalesceOutboxEntry(pendingUpdate, {
    localJobId: job.localJobId,
    companyId: input.companyId,
    operation: 'update',
    payload: job.payload,
    now,
  });

  await store.putOutboxEntry(outboxEntry);
  return { job, outboxEntry };
};

export const listPendingOutboxEntries = async (
  store: FieldJobStore,
): Promise<OutboxEntry[]> => store.listOutboxEntries();
