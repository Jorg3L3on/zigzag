/**
 * Retry-safe composer creates (ZIG-I35-1). The composer sends one
 * `client_request_id` per draft, online or from the offline outbox; the key is
 * stored in the `created` audit payload written in the same transaction as the
 * document, so a replay (lost response, outbox retry) returns that document and
 * its folio instead of creating a second one. Same pattern as the MCP
 * idempotency keys (src/lib/mcp/domain/writes.ts), with a longer window because
 * an offline document can sync days later.
 */
import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { ticket, ticketAuditEvent } from '@/db/schema';
import { db } from '@/lib/db';
import { acquireAdvisoryLock, ADVISORY_LOCK_NAMESPACE } from '@/lib/db-locks';
import type { DocumentTx } from '@/lib/documents/create-document';
import { formatDocumentFolio } from '@/lib/folio';

/** How far back a replay is recognised. */
export const CLIENT_REQUEST_WINDOW_DAYS = 30;

export type ClientRequestScope = {
  companyId: number;
  userId: string;
  key: string;
};

/** Fold company + user + key into the 32-bit advisory lock key space. */
export const clientRequestLockKey = ({ companyId, userId, key }: ClientRequestScope): number =>
  crypto
    .createHash('sha256')
    .update(`composer:${companyId}:${userId}:${key}`)
    .digest()
    .readInt32BE(0);

/** The document this user already created in this company with this key, if any. */
export const findClientRequestDocument = async (
  tx: Pick<typeof db, 'select'>,
  { companyId, userId, key }: ClientRequestScope,
): Promise<bigint | null> => {
  const [row] = await tx
    .select({ ticket_id: ticketAuditEvent.ticket_id })
    .from(ticketAuditEvent)
    .where(
      and(
        eq(ticketAuditEvent.company_id, companyId),
        eq(ticketAuditEvent.actor_user_id, BigInt(userId)),
        eq(ticketAuditEvent.event_type, 'created'),
        sql`${ticketAuditEvent.created_at} > now() - make_interval(days => ${CLIENT_REQUEST_WINDOW_DAYS})`,
        sql`${ticketAuditEvent.payload} ->> 'client_request_id' = ${key}`,
      ),
    )
    .limit(1);
  return row?.ticket_id ?? null;
};

/**
 * `beforeInsert` for createDocumentWithLines: two concurrent saves with the same
 * key wait on one lock, and the second finds the first one's document.
 */
export const clientRequestBeforeInsert =
  (scope: ClientRequestScope) =>
  async (tx: DocumentTx): Promise<bigint | null> => {
    await acquireAdvisoryLock(
      tx,
      ADVISORY_LOCK_NAMESPACE.composerClientRequest,
      clientRequestLockKey(scope),
    );
    return findClientRequestDocument(tx, scope);
  };

export type ReplayedDocument = {
  id: string;
  total: number;
  folio: string;
  replayed: true;
  finished: boolean;
};

/**
 * Checked before any validation: a replay returns what the first call saved,
 * even when the client or a catalog service was deleted since.
 */
export const loadClientRequestDocument = async (
  scope: ClientRequestScope,
): Promise<ReplayedDocument | null> => {
  const existingId = await findClientRequestDocument(db, scope);
  if (existingId == null) return null;
  const existing = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, existingId), eq(ticket.company_id, scope.companyId)),
  });
  if (!existing) return null;
  return {
    id: String(existing.id),
    total: existing.total ?? 0,
    folio: formatDocumentFolio(existing),
    replayed: true,
    finished: existing.finished === true,
  };
};
