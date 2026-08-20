/**
 * Flush field-job outbox to Ticket Server Actions (anotarCapture / updateTicket).
 */

import type {
  FieldJobPayload,
  LocalJob,
  OutboxEntry,
} from '@/lib/field-jobs/types';
import {
  fieldJobStore,
  type FieldJobStore,
} from '@/lib/field-jobs/store';

export type SyncFlushResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ localJobId: string; message: string }>;
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
};

const workNotesFromPayload = (payload: FieldJobPayload): string =>
  (payload.work_notes ?? payload.notes ?? payload.document ?? '').trim();

const toTicketDate = (value: string | undefined): Date => {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const defaultDeps = async (): Promise<FieldJobSyncDeps> => {
  const [{ anotarCapture }, { updateTicket }] = await Promise.all([
    import('@/actions/anotar'),
    import('@/actions/tickets'),
  ]);
  return { anotarCapture, updateTicket };
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

export const flushFieldJobOutbox = async (
  store: FieldJobStore = fieldJobStore,
  options?: { companyId?: number | null; deps?: FieldJobSyncDeps },
): Promise<SyncFlushResult> => {
  const deps = options?.deps ?? (await defaultDeps());
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
  };

  for (const entry of scoped) {
    result.processed += 1;
    const job = await store.getLocalJob(entry.localJobId);
    if (!job) {
      await store.deleteOutboxEntry(entry.outboxId);
      result.succeeded += 1;
      continue;
    }

    await store.updateSyncStatus(job.localJobId, 'uploading', null);

    try {
      if (entry.operation === 'create' && !job.remoteTicketId) {
        await syncCreate(store, job, entry, deps);
      } else {
        await syncUpdate(store, job, entry, deps);
      }
      result.succeeded += 1;
    } catch (error) {
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
