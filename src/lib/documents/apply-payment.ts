/**
 * Registrar un cobro on a finished ticket: the money path the cobranza and
 * ticket detail flows use (`applyTicketPayment`), shared with MCP
 * `register_payment` (ZIG-I23-7). Runs inside the caller's transaction under
 * the ticket's payment advisory lock, so concurrent collections cannot
 * double-apply; never records more than the balance.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { ticket, ticketPayment, type TicketRow } from '@/db/schema';
import type { ActionAuthContext } from '@/lib/authz-context';
import { acquireAdvisoryLock, ADVISORY_LOCK_NAMESPACE } from '@/lib/db-locks';
import { auditSourceArg } from '@/lib/documents/audit-source';
import type { DocumentTx } from '@/lib/documents/create-document';
import { addMoney, roundMoney, subtractMoney } from '@/lib/money';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { AMOUNT_TOLERANCE } from '@/lib/ticket-payment-status';

export type ApplyPaymentResult =
  | { status: 'invalid' }
  | { status: 'noop'; row: TicketRow }
  | { status: 'ok'; row: TicketRow | undefined; appliedAmount: number };

export async function applyTicketPaymentInTx(
  tx: DocumentTx,
  context: ActionAuthContext,
  input: {
    ticketId: bigint;
    companyId: number;
    amount: number;
    auditExtra?: Record<string, unknown>;
    via?: 'action' | 'api';
  },
): Promise<ApplyPaymentResult> {
  const { ticketId, companyId, amount } = input;
  await acquireAdvisoryLock(tx, ADVISORY_LOCK_NAMESPACE.ticketPayment, ticketId);

  const fresh = await tx.query.ticket.findFirst({
    where: and(eq(ticket.id, ticketId), isNull(ticket.deleted_at)),
  });

  if (!fresh || !fresh.finished) {
    return { status: 'invalid' };
  }

  const freshTotal = roundMoney(Number(fresh.total ?? 0));
  const freshPaid = roundMoney(Number(fresh.paid ?? 0));
  const newPaid = roundMoney(Math.min(freshTotal, addMoney(freshPaid, amount)));
  const appliedAmount = subtractMoney(newPaid, freshPaid);

  if (appliedAmount <= AMOUNT_TOLERANCE) {
    // A concurrent collection already covered this balance; no-op.
    return { status: 'noop', row: fresh };
  }

  await tx.insert(ticketPayment).values({
    ticket_id: ticketId,
    amount: appliedAmount,
    company_id: fresh.company_id,
  });

  const [row] = await tx
    .update(ticket)
    .set({ paid: newPaid })
    .where(and(eq(ticket.id, ticketId), eq(ticket.company_id, companyId), isNull(ticket.deleted_at)))
    .returning();

  if (row) {
    await recordTicketAudit(
      tx,
      context,
      ticketId,
      companyId,
      'payment_collected',
      {
        before: fresh,
        after: row,
        payment: { requestedAmount: amount, appliedAmount },
        ...(input.auditExtra ?? {}),
      },
      ...auditSourceArg(input.via),
    );
  }

  return { status: 'ok', row, appliedAmount };
}
