/**
 * The one document line editor (ZIG-I13-6), shared by the `updateTicketLines`
 * server action and MCP `update_document` (ZIG-I23-6). Replaces the whole set
 * of lines and their materials in one transaction, re-syncs the total, audits
 * before/after and refuses a total below what is already paid. Callers
 * authorize first and pass the actor.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { client, servicesTickets, ticket, type TicketRow } from '@/db/schema';
import { db } from '@/lib/db';
import type { ActionAuthContext } from '@/lib/authz-context';
import { TICKET_EMAIL_MAX_LENGTH } from '@/lib/documents/create-document';
import { AuthorizationError } from '@/lib/errors';
import { activeLineMaterialsWith } from '@/lib/line-materials-query';
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
import {
  isPresupuestoMutable,
  isPresupuestoTicket,
  isWorkTicket,
} from '@/lib/ticket-document-kind';
import { AMOUNT_TOLERANCE, isTicketFullyPaid } from '@/lib/ticket-payment-status';
import type { ParsedServiceLine } from '@/lib/ticket-service-line-schema';

export class PresupuestoMutationBlockedError extends Error {
  constructor() {
    super('Presupuesto mutation blocked');
    this.name = 'PresupuestoMutationBlockedError';
  }
}

export class TicketAlreadyPaidError extends Error {
  constructor() {
    super('Ticket already fully paid');
    this.name = 'TicketAlreadyPaidError';
  }
}

/** The new total would fall below what the client already paid. */
export class TotalBelowPaidError extends Error {
  constructor(public readonly paid: number) {
    super('Total below the amount already paid');
    this.name = 'TotalBelowPaidError';
  }
}

export const assertTicketWritable = async (
  ticketId: bigint,
  companyId: number,
): Promise<TicketRow> => {
  const ticketRow = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
  });

  if (!ticketRow) {
    throw new AuthorizationError('Ticket not found');
  }

  if (ticketRow.company_id !== companyId) {
    throw new AuthorizationError('Access denied to this ticket');
  }

  return ticketRow;
};

export const assertIsWorkTicketRow = (ticketRow: {
  document_kind?: string | null;
}): void => {
  if (!isWorkTicket(ticketRow.document_kind)) {
    throw new PresupuestoMutationBlockedError();
  }
};

export const assertTicketNotFullyPaid = async (
  ticketId: bigint,
  companyId: number,
): Promise<void> => {
  const ticketRow = await db.query.ticket.findFirst({
    where: and(
      eq(ticket.id, ticketId),
      eq(ticket.company_id, companyId),
      isNull(ticket.deleted_at),
    ),
    columns: { total: true, paid: true },
  });

  if (!ticketRow) {
    throw new AuthorizationError('Ticket not found');
  }

  if (isTicketFullyPaid(ticketRow.total, ticketRow.paid)) {
    throw new TicketAlreadyPaidError();
  }
};

export type ReplaceDocumentLinesInput = {
  companyId: number;
  documentId: bigint;
  /** Applied only while a ticket is En proceso (not finalized). */
  clientId?: number;
  ticketDate?: Date;
  workNotes?: string;
  lines: ParsedServiceLine[];
  audit?: { source?: string; extra?: Record<string, unknown>; via?: 'action' | 'api' };
};

export type ReplaceDocumentLinesResult = {
  id: bigint;
  total: number;
  previousTotal: number;
  finished: boolean;
};

const loadClientSnapshot = async (clientId: number, companyId: number) => {
  const clientRow = await db.query.client.findFirst({
    where: and(
      eq(client.id, clientId),
      eq(client.company_id, companyId),
      isNull(client.deleted_at),
    ),
    columns: { id: true, name: true, phone: true, email: true, document: true },
  });
  if (!clientRow) {
    throw new AuthorizationError('Client not found for this company');
  }
  return {
    client_id: clientRow.id,
    client_name: clientRow.name.slice(0, 100),
    client_tel: (clientRow.phone ?? '').slice(0, 20),
    email:
      clientRow.email && clientRow.email.length <= TICKET_EMAIL_MAX_LENGTH
        ? clientRow.email
        : null,
    document: clientRow.document ?? null,
  };
};

/**
 * Work tickets: refused once fully paid; client and date change only while En
 * proceso. Presupuestos: refused once converted or canceled.
 */
export async function replaceDocumentLines(
  context: ActionAuthContext,
  input: ReplaceDocumentLinesInput,
): Promise<ReplaceDocumentLinesResult> {
  assertTicketTotalWithinCap(calculateTicketTotal(input.lines));
  const { companyId, documentId: ticketId } = input;

  const prior = await assertTicketWritable(ticketId, companyId);
  const presupuesto = isPresupuestoTicket(prior.document_kind);
  if (presupuesto) {
    if (!isPresupuestoMutable(prior)) {
      throw new PresupuestoMutationBlockedError();
    }
  } else {
    assertIsWorkTicketRow(prior);
    await assertTicketNotFullyPaid(ticketId, companyId);
  }

  const paid = presupuesto ? 0 : (prior.paid ?? 0);
  if (calculateTicketTotal(input.lines) < paid - AMOUNT_TOLERANCE) {
    throw new TotalBelowPaidError(paid);
  }

  await assertCatalogServicesBelongToCompany(db, catalogServiceIds(input.lines), companyId);

  const editable = !prior.finished;
  const clientSnapshot =
    editable && input.clientId != null && input.clientId !== prior.client_id
      ? await loadClientSnapshot(input.clientId, companyId)
      : undefined;

  const beforeLines = await db.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), eq(ticket.company_id, companyId), isNull(ticket.deleted_at)),
    with: {
      services_tickets: {
        where: isNull(servicesTickets.deleted_at),
        with: { ...activeLineMaterialsWith },
      },
    },
  });

  const total = await db.transaction(async (tx) => {
    await tx
      .update(servicesTickets)
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where(and(eq(servicesTickets.ticket_id, ticketId), isNull(servicesTickets.deleted_at)));

    const { rows: lineRows, createdServiceIds, createdMaterialIds } = await insertServiceLines(
      tx,
      { companyId, ticketId, lines: input.lines },
    );

    const syncedTotal = await syncTicketTotal(tx, ticketId);
    if (syncedTotal < paid - AMOUNT_TOLERANCE) {
      // Rolls the replacement back: the lines stay as they were.
      throw new TotalBelowPaidError(paid);
    }

    const [row] = await tx
      .update(ticket)
      .set({
        ...(clientSnapshot ?? {}),
        ...(editable && input.ticketDate ? { ticket_date: input.ticketDate } : {}),
        ...(input.workNotes !== undefined ? { work_notes: input.workNotes || null } : {}),
        updated_at: new Date(),
      })
      .where(and(eq(ticket.id, ticketId), eq(ticket.company_id, companyId), isNull(ticket.deleted_at)))
      .returning();

    await recordTicketAudit(
      tx,
      context,
      ticketId,
      companyId,
      'updated',
      {
        before: beforeLines,
        after: row,
        ...(presupuesto ? { document_kind: 'presupuesto' } : {}),
        servicesChanged: true,
        source: input.audit?.source ?? 'composer-edit',
        previousTotal: prior.total ?? 0,
        total: syncedTotal,
        lines: lineRows,
        ...(createdServiceIds.length > 0 ? { savedToCatalogServiceIds: createdServiceIds } : {}),
        ...(createdMaterialIds.length > 0 ? { savedToCatalogMaterialIds: createdMaterialIds } : {}),
        ...(input.audit?.extra ?? {}),
      },
      ...auditSourceArg(input.audit?.via),
    );

    return syncedTotal;
  });

  return { id: ticketId, total, previousTotal: prior.total ?? 0, finished: prior.finished };
}

/**
 * Client, date and work notes without touching the lines, under the same
 * rules as replaceDocumentLines (paid, converted and canceled documents are
 * refused; client and date only while En proceso).
 */
export async function updateDocumentFields(
  context: ActionAuthContext,
  input: Omit<ReplaceDocumentLinesInput, 'lines'>,
): Promise<ReplaceDocumentLinesResult> {
  const { companyId, documentId: ticketId } = input;
  const prior = await assertTicketWritable(ticketId, companyId);
  const presupuesto = isPresupuestoTicket(prior.document_kind);
  if (presupuesto) {
    if (!isPresupuestoMutable(prior)) {
      throw new PresupuestoMutationBlockedError();
    }
  } else {
    assertIsWorkTicketRow(prior);
    await assertTicketNotFullyPaid(ticketId, companyId);
  }

  const editable = !prior.finished;
  const clientSnapshot =
    editable && input.clientId != null && input.clientId !== prior.client_id
      ? await loadClientSnapshot(input.clientId, companyId)
      : undefined;

  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(ticket)
      .set({
        ...(clientSnapshot ?? {}),
        ...(editable && input.ticketDate ? { ticket_date: input.ticketDate } : {}),
        ...(input.workNotes !== undefined ? { work_notes: input.workNotes || null } : {}),
        updated_at: new Date(),
      })
      .where(and(eq(ticket.id, ticketId), eq(ticket.company_id, companyId), isNull(ticket.deleted_at)))
      .returning();

    await recordTicketAudit(
      tx,
      context,
      ticketId,
      companyId,
      'updated',
      {
        before: prior,
        after: row,
        ...(presupuesto ? { document_kind: 'presupuesto' } : {}),
        source: input.audit?.source ?? 'composer-edit',
        ...(input.audit?.extra ?? {}),
      },
      ...auditSourceArg(input.audit?.via),
    );
  });

  return {
    id: ticketId,
    total: prior.total ?? 0,
    previousTotal: prior.total ?? 0,
    finished: prior.finished,
  };
}
