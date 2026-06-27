/** Human-readable labels for ticket audit event types (Spanish UI). */
export const TICKET_AUDIT_EVENT_LABELS: Record<string, string> = {
  created: 'Ticket creado',
  updated: 'Ticket actualizado',
  deleted: 'Ticket eliminado',
  finished: 'Ticket finalizado',
  payment_collected: 'Pago registrado',
};

export const describeTicketAuditEvent = (eventType: string): string =>
  TICKET_AUDIT_EVENT_LABELS[eventType] ?? eventType;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Best-effort extraction of a monetary amount from an audit payload so the
 * timeline can show e.g. how much was collected on a payment event.
 */
export const extractTicketAuditAmount = (
  eventType: string,
  payload: Record<string, unknown> | null,
): number | null => {
  if (!payload) {
    return null;
  }
  if (eventType === 'payment_collected') {
    const payment = payload.payment as Record<string, unknown> | undefined;
    return asNumber(payment?.appliedAmount) ?? asNumber(payload.appliedAmount);
  }
  if (eventType === 'finished') {
    return asNumber(payload.initialPayment);
  }
  return null;
};
