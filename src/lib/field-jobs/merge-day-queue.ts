/**
 * Merge server technician-day tickets with pending local field jobs.
 */

import type { LocalJob } from '@/lib/field-jobs/types';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';
import type { TechnicianDayTicket } from '@/lib/technician-day-queue';

export type MergedTechnicianDayTicket = TechnicianDayTicket & {
  localJobId?: string;
  syncStatus?: LocalJob['syncStatus'];
  syncError?: string | null;
  pendingSync?: boolean;
  /** Saved from the composer with no signal (ZIG-I35): opens back in the composer. */
  composerKind?: 'ticket' | 'presupuesto';
};

const isPendingLocalJob = (job: LocalJob): boolean =>
  job.syncStatus === 'pending' ||
  job.syncStatus === 'uploading' ||
  job.syncStatus === 'error' ||
  !job.remoteTicketId;

export const localJobToTechnicianDayTicket = (
  job: LocalJob,
): MergedTechnicianDayTicket => {
  const total = job.payload.total ?? 0;
  const paid = job.payload.paid ?? 0;
  const ticketDate =
    job.payload.ticket_date ?? job.createdAt ?? new Date().toISOString();
  const notes =
    job.payload.work_notes ?? job.payload.notes ?? job.payload.document ?? null;

  return {
    id: job.remoteTicketId ?? job.localJobId,
    clientName: job.payload.client_name ?? null,
    clientTel: job.payload.client_tel ?? null,
    ticketDate,
    total,
    paid,
    finished: Boolean(job.payload.finished),
    balanceDue: getTicketBalanceDue(total, paid),
    paymentStatus: getTicketPaymentStatus(total, paid),
    isOverdue: false,
    servicesSummary: notes,
    localJobId: job.localJobId,
    syncStatus: job.syncStatus,
    syncError: job.syncError,
    pendingSync: isPendingLocalJob(job),
    ...(job.payload.composer ? { composerKind: job.payload.composer.kind } : {}),
  };
};

/**
 * Prefer server rows when a local job already has remoteTicketId and is synced.
 * Surface pending local jobs (including unsynced creates) on Hoy.
 */
export const mergeTechnicianDayWithLocalJobs = (
  serverItems: TechnicianDayTicket[],
  localJobs: LocalJob[],
): MergedTechnicianDayTicket[] => {
  // Presupuestos saved offline wait on the presupuestos list, not on the day.
  const pending = localJobs.filter(
    (job) => isPendingLocalJob(job) && job.payload.composer?.kind !== 'presupuesto',
  );
  const remoteIds = new Set(
    pending
      .map((job) => job.remoteTicketId)
      .filter((id): id is string => Boolean(id)),
  );

  const mergedServer: MergedTechnicianDayTicket[] = serverItems
    .filter((item) => !remoteIds.has(item.id))
    .map((item) => ({ ...item, pendingSync: false }));

  // Include finished pending creates (Anotar always saves finished: true).
  const localCards = pending.map(localJobToTechnicianDayTicket);

  return [...localCards, ...mergedServer];
};

export const countPendingFieldUploads = (localJobs: LocalJob[]): number =>
  localJobs.filter(isPendingLocalJob).length;
