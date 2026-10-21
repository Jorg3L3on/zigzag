/**
 * Creates a ticket or presupuesto with all its lines in one transaction: the
 * composer's server path (ZIG-I2 D2, ZIG-I5 D1), shared by the server actions
 * and the MCP `create_document` tool (ZIG-I23-6). Callers authorize first
 * (session RBAC or agent context) and pass the actor; this function owns the
 * client snapshot, catalog checks, folio, lines, total and audit.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { client, ticket, type TicketRow } from '@/db/schema';
import { db } from '@/lib/db';
import type { ActionAuthContext } from '@/lib/authz-context';
import { AuthorizationError } from '@/lib/errors';
import { formatDocumentFolio } from '@/lib/folio';
import { allocateDocumentFolio } from '@/lib/folio-allocator';
import {
  assertCatalogServicesBelongToCompany,
  catalogServiceIds,
  insertServiceLines,
} from '@/lib/service-lines-server';
import {
  assertTicketTotalWithinCap,
  calculateTicketTotal,
  syncTicketTotal,
} from '@/lib/ticket-financials';
import { auditSourceArg } from '@/lib/documents/audit-source';
import { recordTicketAudit } from '@/lib/ticket-audit';
import type { TicketDocumentKind } from '@/lib/ticket-document-kind';
import type { ParsedServiceLine } from '@/lib/ticket-service-line-schema';

/** Ticket.email is varchar(40); longer client emails are left off the snapshot. */
export const TICKET_EMAIL_MAX_LENGTH = 40;

export type DocumentTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CreateDocumentInput = {
  companyId: number;
  kind: TicketDocumentKind;
  clientId: number;
  ticketDate: Date;
  workNotes?: string | null;
  /** Presupuestos only. */
  expiresAt?: Date | null;
  /** Parsed composer lines (composerServiceLineSchema), at least one. */
  lines: ParsedServiceLine[];
  /** What the caller showed; audit only. The server always recomputes the total. */
  clientTotal?: number | null;
  /** Extra audit payload, e.g. `{ source: 'mcp', mcp: {...} }`. Defaults to the composer. */
  audit?: { source?: string; extra?: Record<string, unknown>; via?: 'action' | 'api' };
  /**
   * Runs first inside the transaction. Returning an id skips the insert and
   * returns that document instead (MCP idempotency keys).
   */
  beforeInsert?: (tx: DocumentTx) => Promise<bigint | null>;
  /** Runs inside the same transaction after the lines and total (e.g. finish + pay). */
  afterInsert?: (tx: DocumentTx, created: TicketRow & { total: number }) => Promise<void>;
};

export type CreateDocumentResult = {
  id: bigint;
  total: number;
  folio: string;
  /** True when beforeInsert returned an existing document. */
  replayed: boolean;
};

type PgError = { code?: string; constraint?: string };

const isTicketPrimaryKeyConflict = (error: unknown): boolean => {
  const dbError = (error as { cause?: PgError })?.cause;
  return (
    dbError?.code === '23505' &&
    (dbError?.constraint === 'Ticket_pkey' || dbError?.constraint === 'ticket_pkey')
  );
};

const syncTicketIdSequence = async (): Promise<void> => {
  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('"Ticket"', 'id'),
      COALESCE((SELECT MAX("id") FROM "Ticket"), 0) + 1,
      false
    );
  `);
};

export async function createDocumentWithLines(
  context: ActionAuthContext,
  input: CreateDocumentInput,
): Promise<CreateDocumentResult> {
  assertTicketTotalWithinCap(calculateTicketTotal(input.lines));

  const clientRow = await db.query.client.findFirst({
    where: and(
      eq(client.id, input.clientId),
      eq(client.company_id, input.companyId),
      isNull(client.deleted_at),
    ),
    columns: { id: true, name: true, phone: true, email: true, document: true },
  });
  if (!clientRow) {
    throw new AuthorizationError('Client not found for this company');
  }

  await assertCatalogServicesBelongToCompany(
    db,
    catalogServiceIds(input.lines),
    input.companyId,
  );

  const values = {
    client_id: clientRow.id,
    client_name: clientRow.name.slice(0, 100),
    client_tel: (clientRow.phone ?? '').slice(0, 20),
    email:
      clientRow.email && clientRow.email.length <= TICKET_EMAIL_MAX_LENGTH
        ? clientRow.email
        : null,
    document: clientRow.document ?? null,
    work_notes: input.workNotes || null,
    ticket_date: input.ticketDate,
    ...(input.kind === 'presupuesto' ? { expires_at: input.expiresAt ?? null } : {}),
    company_id: input.companyId,
    userId: BigInt(context.userId),
    document_kind: input.kind,
    finished: false,
    paid: 0,
    total: 0,
  };

  const runTransaction = () =>
    db.transaction(async (tx): Promise<CreateDocumentResult> => {
      const existingId = input.beforeInsert ? await input.beforeInsert(tx) : null;
      if (existingId != null) {
        const existing = await tx.query.ticket.findFirst({
          where: and(eq(ticket.id, existingId), eq(ticket.company_id, input.companyId)),
        });
        if (existing) {
          return {
            id: existing.id,
            total: existing.total ?? 0,
            folio: formatDocumentFolio(existing),
            replayed: true,
          };
        }
      }

      const folio = await allocateDocumentFolio(tx, {
        companyId: input.companyId,
        documentKind: input.kind,
      });
      const [created] = await tx
        .insert(ticket)
        .values({ ...values, ...folio })
        .returning();

      const { rows: lineRows, createdServiceIds, createdMaterialIds } =
        await insertServiceLines(tx, {
          companyId: input.companyId,
          ticketId: created.id,
          lines: input.lines,
        });

      const syncedTotal = await syncTicketTotal(tx, created.id);

      await recordTicketAudit(
        tx,
        context,
        created.id,
        input.companyId,
        'created',
        {
          ticket: { ...created, total: syncedTotal },
          ...(input.kind === 'presupuesto' ? { document_kind: 'presupuesto' } : {}),
          source: input.audit?.source ?? 'composer',
          lines: lineRows,
          ...(createdServiceIds.length > 0
            ? { savedToCatalogServiceIds: createdServiceIds }
            : {}),
          ...(createdMaterialIds.length > 0
            ? { savedToCatalogMaterialIds: createdMaterialIds }
            : {}),
          syncedTotal,
          ignoredClientTotal: input.clientTotal ?? null,
          ...(input.audit?.extra ?? {}),
        },
        ...auditSourceArg(input.audit?.via),
      );

      await input.afterInsert?.(tx, { ...created, total: syncedTotal });

      return {
        id: created.id,
        total: syncedTotal,
        folio: formatDocumentFolio({ ...created, document_kind: input.kind }),
        replayed: false,
      };
    });

  try {
    return await runTransaction();
  } catch (error) {
    if (!isTicketPrimaryKeyConflict(error)) {
      throw error;
    }
    await syncTicketIdSequence();
    return runTransaction();
  }
}
