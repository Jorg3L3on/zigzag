/**
 * Realtime fan-out over Postgres LISTEN/NOTIFY (no Redis, no Pusher/Ably).
 *
 * Producers call `emitRealtimeEvent` after a change; it issues `pg_notify` on a
 * single channel with a small JSON payload. The SSE endpoint
 * (`/api/realtime`) subscribes with `LISTEN` and streams events to the browser,
 * filtered by the viewer's company.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/** Single Postgres NOTIFY channel for all app realtime events. */
export const REALTIME_CHANNEL = 'zigzag_realtime';

export type RealtimeEventType =
  | 'notification'
  | 'export_ready'
  | 'audit'
  | 'connected'
  | 'ping';

export type RealtimeEvent = {
  type: RealtimeEventType;
  /** Company the event belongs to; null means broadcast to all (system view). */
  companyId: number | null;
  resourceType?: string;
  resourceId?: string | null;
  at?: string;
};

/**
 * Best-effort realtime emit. Never throws into the caller's path: a failed
 * notify must not break the mutation that produced the event.
 */
export const emitRealtimeEvent = async (
  event: Omit<RealtimeEvent, 'at'>,
): Promise<void> => {
  try {
    const payload = JSON.stringify({ ...event, at: new Date().toISOString() });
    await db.execute(sql`SELECT pg_notify(${REALTIME_CHANNEL}, ${payload})`);
  } catch (error) {
    logger.warn('Realtime emit failed', { type: event.type, error });
  }
};
