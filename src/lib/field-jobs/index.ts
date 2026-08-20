export type {
  FieldJobPayload,
  FieldJobServiceLine,
  LocalJob,
  OutboxEntry,
  OutboxOperation,
  PutLocalJobInput,
  SyncStatus,
} from '@/lib/field-jobs/types';

export {
  FIELD_JOB_DB_NAME,
  FIELD_JOB_DB_VERSION,
  LOCAL_JOBS_STORE,
  OUTBOX_STORE,
} from '@/lib/field-jobs/types';

export {
  createFieldJobId,
  createFieldJobStore,
  createIndexedDbFieldJobStoreAdapter,
  createMemoryFieldJobStoreAdapter,
  fieldJobStore,
  FieldJobStore,
  mergeFieldJobPayload,
  type FieldJobStoreAdapter,
} from '@/lib/field-jobs/store';

export {
  coalesceOutboxEntry,
  enqueueFieldJobCreate,
  enqueueFieldJobUpdate,
  listPendingOutboxEntries,
  type EnqueueCreateInput,
  type EnqueueUpdateInput,
} from '@/lib/field-jobs/outbox';

export {
  flushFieldJobOutbox,
  type SyncFlushResult,
} from '@/lib/field-jobs/sync';

export {
  countPendingFieldUploads,
  localJobToTechnicianDayTicket,
  mergeTechnicianDayWithLocalJobs,
  type MergedTechnicianDayTicket,
} from '@/lib/field-jobs/merge-day-queue';

export {
  canUseIndexedDb,
  closeFieldJobDb,
  deleteFieldJobDatabase,
  openFieldJobDb,
} from '@/lib/field-jobs/idb';

export { clearFieldJobsOnLogout } from '@/lib/field-jobs/clear-on-logout';
