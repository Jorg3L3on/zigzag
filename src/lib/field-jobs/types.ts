import type { TicketComposerDraftLine } from '@/lib/ticket-composer-draft';

export const FIELD_JOB_DB_NAME = 'zigzag-field';
export const FIELD_JOB_DB_VERSION = 1;

export const LOCAL_JOBS_STORE = 'localJobs';
export const OUTBOX_STORE = 'outbox';

/** Client-visible sync state for a locally captured field job. */
export type SyncStatus = 'pending' | 'uploading' | 'synced' | 'error';

export type FieldJobServiceLine = {
  service_id: number;
  quantity: number;
  price: number;
};

/** How Guardar y terminar was answered offline; same shape as the finish action. */
export type ComposerFinishChoice = 'pendiente' | 'pagado' | { parcial: number };

/** One composer line as the draft keeps it (catalog or inline, with materials). */
export type ComposerDocumentLine = TicketComposerDraftLine;

/**
 * A full ticket or presupuesto saved from the composer with no signal
 * (ZIG-I35-3). It syncs through the create actions with `client_request_id`,
 * so a replay never makes a second document; the folio comes from the server.
 */
export type ComposerDocumentPayload = {
  kind: 'ticket' | 'presupuesto';
  client_request_id: string;
  client_id: number;
  client_label: string;
  /** ISO strings. */
  ticket_date: string;
  expires_at?: string | null;
  work_notes: string;
  lines: ComposerDocumentLine[];
  /** Tickets only: finish on sync with this payment, in the same transaction. */
  finish?: ComposerFinishChoice;
};

/** Draft ticket payload captured offline in the field. */
export type FieldJobPayload = {
  client_id?: number;
  client_name?: string;
  client_tel?: string;
  email?: string;
  document?: string;
  /** Field narrative; preferred over document for Anotar sync. */
  work_notes?: string;
  ticket_date?: string;
  services?: FieldJobServiceLine[];
  notes?: string;
  total?: number;
  paid?: number;
  finished?: boolean;
  /** Set for documents saved from the composer (ZIG-I35); absent for Anotar jobs. */
  composer?: ComposerDocumentPayload;
};

/** Locally persisted field job awaiting server sync. */
export type LocalJob = {
  localJobId: string;
  companyId: number;
  payload: FieldJobPayload;
  syncStatus: SyncStatus;
  syncError?: string | null;
  /** Set after a successful create/update sync. */
  remoteTicketId?: string | null;
  /** Company folio the server gave a composer document (ZIG-I35). */
  remoteFolio?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutboxOperation = 'create' | 'update' | 'create_document';

/** Queued mutation to replay when connectivity returns. */
export type OutboxEntry = {
  outboxId: string;
  localJobId: string;
  companyId: number;
  operation: OutboxOperation;
  payload: FieldJobPayload;
  createdAt: string;
  updatedAt: string;
};

export type PutLocalJobInput = {
  localJobId?: string;
  companyId: number;
  payload: FieldJobPayload;
  syncStatus?: SyncStatus;
  syncError?: string | null;
  remoteTicketId?: string | null;
  remoteFolio?: string | null;
};
