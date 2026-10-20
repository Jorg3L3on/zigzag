/**
 * Finalizar (the listo step / finish panel): marks a work ticket finished with
 * the server-authoritative total and records what was paid. Shared by the
 * `finishTicket` server action and MCP `create_document` with `payment`
 * (ZIG-I23-6). Must run inside the caller's transaction.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { servicesTickets, ticket, ticketPayment, type TicketRow } from '@/db/schema';
import type { ActionAuthContext } from '@/lib/authz-context';
import { acquireAdvisoryLock, ADVISORY_LOCK_NAMESPACE } from '@/lib/db-locks';
import type { DocumentTx } from '@/lib/documents/create-document';
import { roundMoney } from '@/lib/money';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { auditSourceArg } from '@/lib/documents/audit-source';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { AMOUNT_TOLERANCE } from '@/lib/ticket-payment-status';

export class FinishPaidExceedsTotalError extends Error {
  constructor() {
    super('Paid amount exceeds ticket total');
    this.name = 'FinishPaidExceedsTotalError';
  }
}

export class EmptyTicketFinishError extends Error {
  constructor() {
    super('Cannot finish a ticket with no active service lines');
    this.name = 'EmptyTicketFinishError';
  }
}

export class TicketAlreadyFinishedError extends Error {
  constructor() {
    super('Ticket already finished');
    this.name = 'TicketAlreadyFinishedError';
  }
}

/** What the listo step offers: nothing paid, all of it, or part of it. */
export type FinishPaymentChoice = 'pendiente' | 'pagado' | { parcial: number };

/** The amount a payment choice records against a total. */
export const paidAmountForChoice = (choice: FinishPaymentChoice, total: number): number => {
  if (choice === 'pendiente') return 0;
  if (choice === 'pagado') return roundMoney(total);
  return roundMoney(choice.parcial);
};

export async function finishTicketInTx(
  tx: DocumentTx,
  context: ActionAuthContext,
  input: {
    ticketId: bigint;
    companyId: number;
    /** Amount paid now; `(total) => amount` resolves it against the synced total. */
    paid: number | ((total: number) => number);
    prior: TicketRow | null | undefined;
    clientTotal?: number | null;
    auditExtra?: Record<string, unknown>;
    via?: 'action' | 'api';
  },
): Promise<TicketRow> {
  const { ticketId, companyId } = input;
  await acquireAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACE.ticketFinish, ticketId);

  const activeLines = await tx
    .select({ id: servicesTickets.id })
    .from(servicesTickets)
    .where(and(eq(servicesTickets.ticket_id, ticketId), isNull(servicesTickets.deleted_at)))
    .limit(1);
  if (activeLines.length === 0) {
    throw new EmptyTicketFinishError();
  }

  // Authoritative total comes from active service lines, never the client.
  const totalAmount = await syncTicketTotal(tx, ticketId);
  const paidAmount = roundMoney(
    typeof input.paid === 'function' ? input.paid(totalAmount) : input.paid,
  );

  if (paidAmount - totalAmount > AMOUNT_TOLERANCE) {
    throw new FinishPaidExceedsTotalError();
  }

  const [row] = await tx
    .update(ticket)
    .set({ finished: true, total: totalAmount, paid: paidAmount })
    .where(
      and(
        eq(ticket.id, ticketId),
        eq(ticket.company_id, companyId),
        isNull(ticket.deleted_at),
        eq(ticket.finished, false),
      ),
    )
    .returning();

  if (!row) {
    // Concurrent finish won the race; do not insert payment/audit again.
    throw new TicketAlreadyFinishedError();
  }

  if (paidAmount > AMOUNT_TOLERANCE) {
    await tx.insert(ticketPayment).values({
      ticket_id: ticketId,
      amount: paidAmount,
      company_id: row.company_id,
    });
  }

  await recordTicketAudit(
    tx,
    context,
    ticketId,
    companyId,
    'finished',
    {
      before: input.prior,
      after: row,
      initialPayment: paidAmount > AMOUNT_TOLERANCE ? paidAmount : 0,
      syncedTotal: totalAmount,
      ignoredClientTotal: input.clientTotal ?? null,
      ...(input.auditExtra ?? {}),
    },
    ...auditSourceArg(input.via),
  );

  return row;
}
