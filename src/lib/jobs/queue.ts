/**
 * Postgres-backed background job queue (no Redis).
 *
 * Producers call `enqueueJob`. A worker (`runDueJobs`, invoked by Vercel Cron)
 * atomically claims due `pending` rows using `FOR UPDATE SKIP LOCKED`, runs the
 * registered handler for each job's `type`, and marks it `completed` or, on
 * failure, reschedules with exponential backoff until `max_attempts`.
 */
import { sql } from 'drizzle-orm';
import { jobQueue, type JobQueueRow } from '@/db/schema';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { captureException } from '@/lib/observability';
import { JOB_HANDLERS, type JobType } from '@/lib/jobs/handlers';

export type EnqueueJobOptions = {
  runAt?: Date;
  maxAttempts?: number;
};

/** Exponential backoff (capped) for a retry after `attempts` failures. */
export const backoffDelayMs = (attempts: number): number => {
  const base = 30_000; // 30s
  const max = 3_600_000; // 1h
  return Math.min(max, base * 2 ** Math.max(0, attempts - 1));
};

/** Insert a job to be processed by the next worker run. */
export const enqueueJob = async (
  type: JobType,
  payload: Record<string, unknown> = {},
  options: EnqueueJobOptions = {},
): Promise<number> => {
  const [row] = await db
    .insert(jobQueue)
    .values({
      type,
      payload,
      run_at: options.runAt ?? new Date(),
      max_attempts: options.maxAttempts ?? 5,
    })
    .returning({ id: jobQueue.id });
  return row.id;
};

type ClaimedJob = Pick<
  JobQueueRow,
  'id' | 'type' | 'payload' | 'attempts' | 'max_attempts'
>;

/** Atomically claim up to `limit` due jobs, marking them `processing`. */
const claimJobs = async (limit: number): Promise<ClaimedJob[]> => {
  const result = await db.execute(sql`
    UPDATE "JobQueue" AS j
    SET status = 'processing', locked_at = now(), attempts = j.attempts + 1,
        updated_at = now()
    WHERE j.id IN (
      SELECT id FROM "JobQueue"
      WHERE status = 'pending' AND run_at <= now()
      ORDER BY run_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING j.id, j.type, j.payload, j.attempts, j.max_attempts
  `);
  return ((result as unknown as { rows?: ClaimedJob[] }).rows ?? []).map(
    (r) => ({
      ...r,
      attempts: Number(r.attempts),
      max_attempts: Number(r.max_attempts),
    }),
  );
};

const markCompleted = async (id: number): Promise<void> => {
  await db.execute(sql`
    UPDATE "JobQueue"
    SET status = 'completed', locked_at = NULL, last_error = NULL, updated_at = now()
    WHERE id = ${id}
  `);
};

const markFailed = async (
  job: ClaimedJob,
  error: unknown,
): Promise<void> => {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = job.attempts >= job.max_attempts;
  const nextRun = new Date(Date.now() + backoffDelayMs(job.attempts));

  await db.execute(sql`
    UPDATE "JobQueue"
    SET status = ${exhausted ? 'failed' : 'pending'},
        locked_at = NULL,
        last_error = ${message},
        run_at = ${exhausted ? sql`run_at` : sql`${nextRun}`},
        updated_at = now()
    WHERE id = ${job.id}
  `);
};

export type RunDueJobsResult = {
  claimed: number;
  completed: number;
  failed: number;
};

/** Claim and run due jobs. Returns counts for observability. */
export const runDueJobs = async (limit = 20): Promise<RunDueJobsResult> => {
  const jobs = await claimJobs(limit);
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    const handler = JOB_HANDLERS[job.type as JobType];
    if (!handler) {
      await markFailed(job, new Error(`No handler for job type "${job.type}"`));
      failed += 1;
      continue;
    }

    try {
      await handler(job.payload ?? {});
      await markCompleted(job.id);
      completed += 1;
    } catch (error) {
      captureException(error, { job: job.type, jobId: job.id });
      await markFailed(job, error);
      failed += 1;
    }
  }

  if (jobs.length > 0) {
    logger.info('Job queue drained', {
      claimed: jobs.length,
      completed,
      failed,
    });
  }

  return { claimed: jobs.length, completed, failed };
};
