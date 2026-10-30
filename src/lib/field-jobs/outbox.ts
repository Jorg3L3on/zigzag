import {
  createFieldJobId,
  FieldJobStore,
  mergeFieldJobPayload,
} from '@/lib/field-jobs/store';
import type {
  ComposerDocumentPayload,
  FieldJobPayload,
  LocalJob,
  OutboxEntry,
  OutboxOperation,
} from '@/lib/field-jobs/types';
import { addMoney, lineTotalWithMaterials } from '@/lib/money';

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

export type EnqueueComposerDocumentInput = {
  companyId: number;
  document: ComposerDocumentPayload;
  /** Client name and phone for Hoy and the lists while it is pending. */
  clientName: string;
  clientTel?: string | null;
};

export const composerDocumentTotal = (document: ComposerDocumentPayload): number =>
  addMoney(...document.lines.map(lineTotalWithMaterials));

const composerDocumentPaid = (document: ComposerDocumentPayload, total: number): number => {
  const finish = document.finish;
  if (finish === undefined || finish === 'pendiente') return 0;
  if (finish === 'pagado') return total;
  return Math.min(total, finish.parcial);
};

/** What Hoy and the lists show for a composer document before it syncs. */
export const composerDocumentSummary = (document: ComposerDocumentPayload): string =>
  document.lines.map((line) => line.service_name).join(', ');

/**
 * Save a full composer document offline (ZIG-I35-3). The local job id is the
 * client_request_id, so saving it again (Revisar → Guardar) coalesces into the
 * same outbox entry and the sync replays with the same key.
 */
export const enqueueComposerDocument = async (
  store: FieldJobStore,
  input: EnqueueComposerDocumentInput,
): Promise<{ job: LocalJob; outboxEntry: OutboxEntry }> => {
  const now = new Date().toISOString();
  const { document } = input;
  const total = composerDocumentTotal(document);
  const payload: FieldJobPayload = {
    client_id: document.client_id,
    client_name: input.clientName,
    client_tel: input.clientTel ?? undefined,
    ticket_date: document.ticket_date,
    work_notes: composerDocumentSummary(document),
    total,
    paid: composerDocumentPaid(document, total),
    finished: document.kind === 'ticket' && document.finish !== undefined,
    composer: document,
  };
  const localJobId = document.client_request_id;
  const existing = await store.getLocalJob(localJobId);
  if (existing?.remoteTicketId) {
    throw new Error('Este documento ya se sincronizó');
  }
  const job = await store.putLocalJob({
    localJobId,
    companyId: input.companyId,
    payload,
    syncStatus: 'pending',
    syncError: null,
    remoteTicketId: null,
    remoteFolio: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  const pending = await store.findOutboxEntryForLocalJob(localJobId, 'create_document');
  const outboxEntry: OutboxEntry = pending
    ? { ...pending, payload, updatedAt: now }
    : {
        outboxId: createFieldJobId(),
        localJobId,
        companyId: input.companyId,
        operation: 'create_document',
        payload,
        createdAt: now,
        updatedAt: now,
      };
  await store.putOutboxEntry(outboxEntry);
  return { job, outboxEntry };
};

/** Reintentar: put a document that failed back in line, unchanged. */
export const requeueLocalJob = async (
  store: FieldJobStore,
  localJobId: string,
): Promise<LocalJob | null> => store.updateSyncStatus(localJobId, 'pending', null);

/** Descartar a document that never synced: removes the local job and its outbox rows. */
export const discardLocalJob = async (
  store: FieldJobStore,
  localJobId: string,
): Promise<void> => {
  for (;;) {
    const entry = await store.findOutboxEntryForLocalJob(localJobId);
    if (!entry) break;
    await store.deleteOutboxEntry(entry.outboxId);
  }
  await store.deleteLocalJob(localJobId);
};
