/**
 * MCP `register_payment` (ZIG-I23-7): records a collection on a finished
 * ticket through the app's own payment path (`applyTicketPaymentInTx`, the one
 * cobranza and the ticket detail use), so `paid`, the payment status and the
 * audit stay consistent. Only connections holding the `payments` scope reach
 * it. No refunds and no deletions: the agent can only add a payment up to the
 * balance.
 */
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { acquireAdvisoryLock, ADVISORY_LOCK_NAMESPACE } from '@/lib/db-locks';
import { applyTicketPaymentInTx } from '@/lib/documents/apply-payment';
import {
  afterDocumentWrite,
  findIdempotentDocument,
  idempotencyLockKey,
  loadDocument,
  mapErrors,
  startWrite,
  type WriteAgent,
} from '@/lib/mcp/domain/writes';
import { McpToolError } from '@/lib/mcp/tool-helpers';
import { isWorkTicket } from '@/lib/ticket-document-kind';
import { AMOUNT_TOLERANCE, getTicketBalanceDue } from '@/lib/ticket-payment-status';

/** How the client paid; the app keeps no method column, so it goes to the audit only. */
export const PAYMENT_METHODS = ['efectivo', 'transferencia', 'tarjeta', 'otro'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type RegisterPaymentArgs = {
  document_id: bigint;
  amount: number;
  method?: PaymentMethod;
  note?: string;
  idempotency_key?: string;
};

const formatPesos = (amount: number) =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FINISH_FIRST = new McpToolError(
  'validation',
  'Termina el ticket antes de registrar un cobro (update_document con finished: true).',
);

export const registerAgentPayment = async (
  agent: WriteAgent,
  args: RegisterPaymentArgs,
): Promise<{ id: bigint; replayed: boolean }> =>
  mapErrors(async () => {
    const session = await startWrite(agent, 'register_payment');
    const key = args.idempotency_key;

    if (key) {
      const existing = await findIdempotentDocument(
        db,
        agent.companyId,
        session.connection,
        key,
        'payment_collected',
      );
      if (existing != null) return { id: existing, replayed: true };
    }

    const document = await loadDocument(agent.companyId, args.document_id);
    if (!isWorkTicket(document.document_kind)) {
      throw new McpToolError(
        'validation',
        'Los pagos solo se registran en tickets, no en presupuestos.',
      );
    }
    if (!document.finished) throw FINISH_FIRST;

    const balance = getTicketBalanceDue(document.total, document.paid);
    if (balance <= AMOUNT_TOLERANCE) {
      throw new McpToolError('validation', 'El ticket ya está pagado por completo.');
    }
    // Exact to the cent: the agent never records more than the balance.
    if (Math.round(args.amount * 100) > Math.round(balance * 100)) {
      throw new McpToolError(
        'validation',
        `El monto (${formatPesos(args.amount)}) es mayor al saldo por pagar (${formatPesos(balance)}).`,
      );
    }

    const audit = session.audit({
      document_id: String(args.document_id),
      ...(key ? { idempotency_key: key } : {}),
      ...(args.method ? { payment_method: args.method } : {}),
      ...(args.note ? { payment_note: args.note } : {}),
    });

    const replayed = await db.transaction(async (tx) => {
      if (key) {
        await acquireAdvisoryLock(
          tx,
          ADVISORY_LOCK_NAMESPACE.mcpIdempotency,
          idempotencyLockKey(session.connection, key),
        );
        const existing = await findIdempotentDocument(
          tx,
          agent.companyId,
          session.connection,
          key,
          'payment_collected',
        );
        if (existing != null) return true;
      }

      const result = await applyTicketPaymentInTx(tx, session.actor, {
        ticketId: args.document_id,
        companyId: agent.companyId,
        amount: args.amount,
        auditExtra: audit.extra,
        via: 'api',
      });
      if (result.status === 'invalid') throw FINISH_FIRST;
      if (result.status === 'noop') {
        // Another collection covered the balance between the check and the lock.
        throw new McpToolError('validation', 'El ticket ya está pagado por completo.');
      }
      return false;
    });

    afterDocumentWrite(agent.companyId, args.document_id);
    try {
      revalidatePath('/cobranza');
    } catch {
      // Outside a Next request.
    }
    return { id: args.document_id, replayed };
  });
