/**
 * Audit outbox worker: replays durably-captured audit events into `AuditEvent`.
 *
 * Rows land in `AuditOutbox` only when a direct audit write failed (see
 * `recordAuditEvent`). This worker claims pending rows with `FOR UPDATE SKIP
 * LOCKED`, inserts them into `AuditEvent`, and marks them processed. Run from
 * the jobs cron so the unified audit log stays complete.
 */
import { sql } from 'drizzle-orm';
import { auditEvent } from '@/db/schema';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

type OutboxRow = { id: number; event: Record<string, unknown> };

const toBigIntOrNull = (value: unknown): bigint | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  try {
    return BigInt(value as string);
  } catch {
    return null;
  }
};

export type ProcessAuditOutboxResult = {
  claimed: number;
  processed: number;
  failed: number;
};

export const processAuditOutbox = async (
  limit = 100,
): Promise<ProcessAuditOutboxResult> => {
  const claimedResult = await db.execute(sql`
    UPDATE "AuditOutbox" AS o
    SET status = 'processing', attempts = o.attempts + 1
    WHERE o.id IN (
      SELECT id FROM "AuditOutbox"
      WHERE status = 'pending'
      ORDER BY id ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING o.id, o.event
  `);

  const rows = (claimedResult as unknown as { rows?: OutboxRow[] }).rows ?? [];
  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    const e = row.event ?? {};
    try {
      await db.insert(auditEvent).values({
        occurred_at: e.occurred_at
          ? new Date(e.occurred_at as string)
          : new Date(),
        actor_user_id: toBigIntOrNull(e.actor_user_id),
        actor_company_id: (e.actor_company_id as number | null) ?? null,
        target_company_id: (e.target_company_id as number | null) ?? null,
        resource_type: String(e.resource_type ?? 'unknown'),
        resource_id: (e.resource_id as string | null) ?? null,
        action: String(e.action ?? 'unknown'),
        result: String(e.result ?? 'unknown'),
        source: String(e.source ?? 'system'),
        payload: (e.payload as Record<string, unknown> | null) ?? null,
        request_meta: (e.request_meta as Record<string, unknown> | null) ?? null,
      });

      await db.execute(sql`
        UPDATE "AuditOutbox"
        SET status = 'processed', processed_at = now(), last_error = NULL
        WHERE id = ${row.id}
      `);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.execute(sql`
        UPDATE "AuditOutbox"
        SET status = 'pending', last_error = ${message}
        WHERE id = ${row.id}
      `);
      failed += 1;
    }
  }

  if (rows.length > 0) {
    logger.info('Audit outbox processed', {
      claimed: rows.length,
      processed,
      failed,
    });
  }

  return { claimed: rows.length, processed, failed };
};
