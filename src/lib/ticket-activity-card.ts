import {
  describeTicketAuditEvent,
  extractTicketAuditAmount,
  type TicketTimelineEntryInput,
} from '@/lib/ticket-audit-display';

const formatFullCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const servicesChanged = (payload: Record<string, unknown> | null): boolean =>
  payload != null &&
  (payload.servicesChanged === true || Array.isArray(payload.services) || payload.serviceLine != null);

/**
 * The desktop Actividad card of a ticket (canvas Main): what happened, with
 * the full amount, not who did it («Cobro registrado $421,582.40», «Ticket
 * terminado · pago inicial $500,000.00»). Actor and time go on the second line.
 */
export const formatTicketActivityCardTitle = (
  input: Pick<TicketTimelineEntryInput, 'eventType' | 'payload'>,
): string => {
  const amount = extractTicketAuditAmount(input.eventType, input.payload);
  const money = amount != null ? formatFullCurrency(amount) : null;
  switch (input.eventType) {
    case 'created':
      return 'Ticket creado';
    case 'updated':
      return servicesChanged(input.payload) ? 'Servicios editados' : 'Ticket editado';
    case 'finished':
      return amount != null && amount > 0 ? `Ticket terminado · pago inicial ${money}` : 'Ticket terminado';
    case 'payment_collected':
      return money ? `Cobro registrado ${money}` : 'Cobro registrado';
    case 'receipt_shared':
      return 'Recibo compartido';
    case 'deleted':
      return 'Ticket eliminado';
    default:
      return describeTicketAuditEvent(input.eventType);
  }
};
