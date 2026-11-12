import { AMOUNT_TOLERANCE } from '@/lib/ticket-payment-status';
import { extractTicketAuditAmount } from '@/lib/ticket-audit-display';

const MATCH_WINDOW_MS = 2_000;

export type PaymentActorEvent = {
  eventType: string;
  createdAt: Date | string;
  actorName: string | null;
  payload: Record<string, unknown> | null;
};

export type PaymentActorMatch = {
  actorName: string | null;
  /** The abono recorded when the ticket was finished. */
  initial: boolean;
};

/**
 * Pair a payment with the audit event that recorded it: same amount, created
 * within 2 seconds. No pair means the row shows no actor (ZIG-I28-2).
 */
export const matchPaymentActor = (
  payment: { amount: number; createdAt: Date | string },
  events: ReadonlyArray<PaymentActorEvent>,
): PaymentActorMatch | null => {
  const paymentTime = new Date(payment.createdAt).getTime();
  if (!Number.isFinite(paymentTime)) return null;

  for (const event of events) {
    if (event.eventType !== 'finished' && event.eventType !== 'payment_collected') continue;
    const eventTime = new Date(event.createdAt).getTime();
    if (!Number.isFinite(eventTime) || Math.abs(eventTime - paymentTime) > MATCH_WINDOW_MS) {
      continue;
    }
    const amount = extractTicketAuditAmount(event.eventType, event.payload);
    if (amount == null || Math.abs(amount - payment.amount) > AMOUNT_TOLERANCE) continue;
    if (event.eventType === 'finished' && amount <= AMOUNT_TOLERANCE) continue;
    return {
      actorName: event.actorName,
      initial: event.eventType === 'finished',
    };
  }
  return null;
};
