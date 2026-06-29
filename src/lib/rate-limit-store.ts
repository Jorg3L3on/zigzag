/**
 * Postgres-backed fixed-window rate limit store (no Redis).
 *
 * A single atomic upsert per check keeps the counter correct across serverless
 * instances: the row's window resets when `reset_at` has passed, otherwise the
 * count is incremented. Returns whether the identifier is still within budget.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { RateLimitOptions } from '@/lib/rate-limiter';

type CountRow = { count: number | string };

export const checkRateLimitPg = async (
  identifier: string,
  options: RateLimitOptions,
): Promise<boolean> => {
  const windowMs = Math.max(1, Math.ceil(options.windowMs));
  const result = await db.execute(sql`
    INSERT INTO "RateLimit" (identifier, count, reset_at)
    VALUES (${identifier}, 1, now() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT (identifier) DO UPDATE SET
      count = CASE
        WHEN "RateLimit".reset_at < now() THEN 1
        ELSE "RateLimit".count + 1
      END,
      reset_at = CASE
        WHEN "RateLimit".reset_at < now()
          THEN now() + ${windowMs} * interval '1 millisecond'
        ELSE "RateLimit".reset_at
      END
    RETURNING count
  `);

  const rows = (result as unknown as { rows?: CountRow[] }).rows ?? [];
  const count = Number(rows[0]?.count ?? 0);
  return count <= options.limit;
};

export const resetRateLimitPg = async (identifier: string): Promise<void> => {
  await db.execute(sql`DELETE FROM "RateLimit" WHERE identifier = ${identifier}`);
};
