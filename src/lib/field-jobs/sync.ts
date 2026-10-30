/**
 * Flush field-job outbox to Ticket Server Actions (anotarCapture / updateTicket,
 * and the composer creates for documents saved offline, ZIG-I35-3).
 */

import type {
  ComposerDocumentPayload,
  FieldJobPayload,
  LocalJob,
  OutboxEntry,
} from '@/lib/field-jobs/types';
import { draftLineToServiceLineInput } from '@/lib/ticket-composer-draft';
import type { ServiceLineInput } from '@/lib/ticket-service-line-schema';
import {
  fieldJobStore,
  type FieldJobStore,
} from '@/lib/field-jobs/store';

export type SyncFlushResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ localJobId: string; message: string }>;
  /** Left pending for the next flush (no signal, server down); not failures. */
  deferred: number;
  /** Composer documents that got their folio in this flush, for the toast. */
  documents: Array<{
    localJobId: string;
    kind: ComposerDocumentPayload['kind'];
    id: string;
    folio: string | null;
  }>;
};

type ComposerCreateResult = Promise<{
  success: boolean;
  data?: { id: string; folio?: string };
  error?: string;
  errorType?: string;
}>;

type ComposerCreateInput = {
  company_id: number;
  client_id: number;
  ticket_date: Date;
  work_notes: string;
  lines: ServiceLineInput[];
  client_total?: number;
  client_request_id: string;
};

export type FieldJobSyncDeps = {
  anotarCapture: (input: {
    client_id?: number;
    client_name: string;
    client_tel: string;
    work_notes: string;
    total: number;
    paid: number;
    company_id: number;
    ticket_date: Date;
  }) => Promise<{
    success: boolean;
    data?: { id: string | number | bigint };
    error?: string;
  }>;
  updateTicket: (
    id: number,
    data: Record<string, unknown>,
  ) => Promise<{ success: boolean; error?: string }>;
  createTicketWithLines?: (
    input: ComposerCreateInput & { finish?: ComposerDocumentPayload['finish'] },
  ) => ComposerCreateResult;
  createPresupuestoWithLines?: (
    input: ComposerCreateInput & { expires_at: Date | null },
  ) => ComposerCreateResult;
};

/** A failure the next flush may get past (no signal, server down): stays pending. */
class TransientSyncError extends Error {}

/** What the user reads under Revisar when the server refused the document. */
const composerRejectionMessage = (result: { error?: string; errorType?: string }): string => {
  if (result.errorType === 'auth') {
    return 'El cliente o un servicio ya no está disponible. Ábrelo, revísalo y guarda de nuevo.';
  }
  if (result.errorType === 'validation') {
    return result.error || 'Hay datos que el servidor no aceptó. Ábrelo y revísalo.';
  }
  return result.error || 'No se pudo guardar. Ábrelo y revísalo.';
};

const workNotesFromPayload = (payload: FieldJobPayload): string =>
  (payload.work_notes ?? payload.notes ?? payload.document ?? '').trim();

const toTicketDate = (value: string | undefined): Date => {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const defaultDeps = async (): Promise<FieldJobSyncDeps> => {
  const [{ anotarCapture }, { updateTicket, createTicketWithLines }, { createPresupuestoWithLines }] =
    await Promise.all([
      import('@/actions/anotar'),
      import('@/actions/tickets'),
      import('@/actions/presupuestos'),
    ]);
  return { anotarCapture, updateTicket, createTicketWithLines, createPresupuestoWithLines };
};

const syncComposerDocument = async (
  store: FieldJobStore,
  job: LocalJob,
  entry: OutboxEntry,
  deps: FieldJobSyncDeps,
): Promise<SyncFlushResult['documents'][number]> => {
  const document = entry.payload.composer;
  if (!document) {
    throw new Error('Falta el documento guardado');
  }
  const base: ComposerCreateInput = {
    company_id: entry.companyId,
    client_id: document.client_id,
    ticket_date: new Date(document.ticket_date),
    work_notes: document.work_notes,
    lines: document.lines.map(draftLineToServiceLineInput),
    client_total: entry.payload.total,
    client_request_id: document.client_request_id,
  };
  const { createPresupuestoWithLines, createTicketWithLines } = deps;
  if (!createPresupuestoWithLines || !createTicketWithLines) {
    throw new TransientSyncError('Sincronización no disponible');
  }

  let result: Awaited<ComposerCreateResult>;
  try {
    result =
      document.kind === 'presupuesto'
        ? await createPresupuestoWithLines({
            ...base,
            expires_at: document.expires_at ? new Date(document.expires_at) : null,
          })
        : await createTicketWithLines({
            ...base,
            ...(document.finish !== undefined ? { finish: document.finish } : {}),
          });
  } catch {
    // The request never got an answer: the key makes the next try safe.
    throw new TransientSyncError('Sin conexión');
  }
  if (!result.success || !result.data) {
    if (result.errorType === 'network' || result.errorType === 'server') {
      throw new TransientSyncError(result.error || 'El servidor no respondió');
    }
    throw new Error(composerRejectionMessage(result));
  }

  const folio = result.data.folio ?? null;
  await store.putLocalJob({
    ...job,
    remoteTicketId: String(result.data.id),
    remoteFolio: folio,
    syncStatus: 'synced',
    syncError: null,
    updatedAt: new Date().toISOString(),
  });
  await store.deleteOutboxEntry(entry.outboxId);
  return { localJobId: job.localJobId, kind: document.kind, id: String(result.data.id), folio };
};

const syncCreate = async (
  store: FieldJobStore,
  job: LocalJob,
  entry: OutboxEntry,
  deps: FieldJobSyncDeps,
): Promise<void> => {
  const payload = entry.payload;
  const clientName = payload.client_name?.trim();
  const clientTel = payload.client_tel?.trim();
  if (!clientName || !clientTel) {
    throw new Error('Falta nombre o teléfono del cliente');
  }

  const total = Math.max(0, Number(payload.total ?? 0));
  const paid = Math.max(0, Number(payload.paid ?? 0));

  const result = await deps.anotarCapture({
    client_id: payload.client_id,
    client_name: clientName,
    client_tel: clientTel,
    work_notes: workNotesFromPayload(payload),
    total,
    paid,
    company_id: entry.companyId,
    ticket_date: toTicketDate(payload.ticket_date),
  });

  if (!result.success || !result.data) {
    throw new Error(result.error || 'No se pudo subir el trabajo');
  }

  const ticketId = String(result.data.id);
  await store.putLocalJob({
    ...job,
    remoteTicketId: ticketId,
    syncStatus: 'synced',
    syncError: null,
    updatedAt: new Date().toISOString(),
  });
  await store.deleteOutboxEntry(entry.outboxId);
};

const syncUpdate = async (
  store: FieldJobStore,
  job: LocalJob,
  entry: OutboxEntry,
  deps: FieldJobSyncDeps,
): Promise<void> => {
  if (!job.remoteTicketId) {
    throw new Error('El trabajo aún no tiene ticket en el servidor');
  }

  const payload = entry.payload;
  const result = await deps.updateTicket(Number(job.remoteTicketId), {
    client_id: payload.client_id,
    client_name: payload.client_name,
    client_tel: payload.client_tel,
    email: payload.email,
    document: workNotesFromPayload(payload) || payload.document,
    ticket_date: payload.ticket_date
      ? toTicketDate(payload.ticket_date)
      : undefined,
    company_id: entry.companyId,
    services: payload.services,
  });

  if (!result.success) {
    throw new Error(result.error || 'No se pudo actualizar el trabajo');
  }

  await store.putLocalJob({
    ...job,
    syncStatus: 'synced',
    syncError: null,
    updatedAt: new Date().toISOString(),
  });
  await store.deleteOutboxEntry(entry.outboxId);
};

/** A synced composer document stays a day (a pending link still resolves), then goes. */
const SYNCED_COMPOSER_JOB_TTL_MS = 24 * 60 * 60 * 1000;

export const pruneSyncedComposerJobs = async (
  store: FieldJobStore,
  companyId: number,
  now = Date.now(),
): Promise<void> => {
  const jobs = await store.listLocalJobsByCompany(companyId);
  for (const job of jobs) {
    if (
      job.payload.composer &&
      job.syncStatus === 'synced' &&
      now - Date.parse(job.updatedAt) > SYNCED_COMPOSER_JOB_TTL_MS
    ) {
      await store.deleteLocalJob(job.localJobId);
    }
  }
};

export const flushFieldJobOutbox = async (
  store: FieldJobStore = fieldJobStore,
  options?: { companyId?: number | null; deps?: FieldJobSyncDeps },
): Promise<SyncFlushResult> => {
  const deps = options?.deps ?? (await defaultDeps());
  if (options?.companyId != null) {
    await pruneSyncedComposerJobs(store, options.companyId);
  }
  const entries = await store.listOutboxEntries();
  const scoped = entries
    .filter((entry) =>
      options?.companyId == null ? true : entry.companyId === options.companyId,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const result: SyncFlushResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    deferred: 0,
    documents: [],
  };

  for (const entry of scoped) {
    const job = await store.getLocalJob(entry.localJobId);
    // Revisar waits for the user (open, fix, Reintentar); it never retries on its own.
    if (job && entry.operation === 'create_document' && job.syncStatus === 'error') {
      continue;
    }
    result.processed += 1;
    if (!job) {
      await store.deleteOutboxEntry(entry.outboxId);
      result.succeeded += 1;
      continue;
    }

    await store.updateSyncStatus(job.localJobId, 'uploading', null);

    try {
      if (entry.operation === 'create_document') {
        result.documents.push(await syncComposerDocument(store, job, entry, deps));
      } else if (entry.operation === 'create' && !job.remoteTicketId) {
        await syncCreate(store, job, entry, deps);
      } else {
        await syncUpdate(store, job, entry, deps);
      }
      result.succeeded += 1;
    } catch (error) {
      if (error instanceof TransientSyncError) {
        // Still pending: the next online / visibility flush tries again.
        await store.updateSyncStatus(job.localJobId, 'pending', null);
        result.deferred += 1;
        continue;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Error al subir. Revisa tu conexión e intenta de nuevo.';
      await store.updateSyncStatus(job.localJobId, 'error', message);
      result.failed += 1;
      result.errors.push({ localJobId: job.localJobId, message });
    }
  }

  return result;
};
