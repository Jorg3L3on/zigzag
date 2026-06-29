/**
 * Registry mapping job `type` to its handler. Add new background jobs here.
 * Kept separate from the queue runner to avoid import cycles and to make the
 * set of supported jobs easy to see and test.
 */
import { runCompanyExportJob } from '@/lib/jobs/company-export-job';

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

export const JOB_HANDLERS = {
  company_export: runCompanyExportJob,
} satisfies Record<string, JobHandler>;

export type JobType = keyof typeof JOB_HANDLERS;

export const isJobType = (value: string): value is JobType =>
  Object.prototype.hasOwnProperty.call(JOB_HANDLERS, value);
