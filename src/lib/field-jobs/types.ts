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
  createdAt: string;
  updatedAt: string;
};

export type OutboxOperation = 'create' | 'update';

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
};
