import { formatCompactCurrency } from '@/lib/format-compact';

/** Human-readable labels for ticket audit event types (Spanish UI). */
export const TICKET_AUDIT_EVENT_LABELS: Record<string, string> = {
  created: 'Ticket creado',
  updated: 'Ticket actualizado',
  deleted: 'Ticket eliminado',
  finished: 'Ticket finalizado',
  payment_collected: 'Pago registrado',
};

/** Icon keys aligned with the dashboard activity feed vocabulary. */
export type TicketTimelineIconKey = 'ticket' | 'payment' | 'generic';

export type TicketTimelineEntryInput = {
  eventType: string;
  actorName: string | null;
  payload: Record<string, unknown> | null;
};

export type TicketTimelineFormatted = {
  title: string;
  icon: TicketTimelineIconKey;
  amount: number | null;
};

export const describeTicketAuditEvent = (eventType: string): string =>
  TICKET_AUDIT_EVENT_LABELS[eventType] ?? eventType;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const actorLabel = (actorName: string | null): string =>
  actorName?.trim() || 'Alguien';

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

export const getTicketTimelineIcon = (
  eventType: string,
): TicketTimelineIconKey => {
  if (eventType === 'payment_collected') {
    return 'payment';
  }
  if (
    eventType === 'created' ||
    eventType === 'updated' ||
    eventType === 'finished' ||
    eventType === 'deleted'
  ) {
    return 'ticket';
  }
  return 'generic';
};

const hasServicesChanged = (payload: Record<string, unknown> | null): boolean => {
  if (!payload) {
    return false;
  }
  if (payload.servicesChanged === true) {
    return true;
  }
  return Array.isArray(payload.services);
};

/**
 * Sentence-style timeline copy for a single ticket (no ticket #ref —
 * the detail page already shows identity).
 */
export const formatTicketTimelineTitle = (
  input: TicketTimelineEntryInput,
): string => {
  const who = actorLabel(input.actorName);
  const amount = extractTicketAuditAmount(input.eventType, input.payload);

  switch (input.eventType) {
    case 'created':
      return `${who} creó el ticket`;
    case 'updated':
      if (hasServicesChanged(input.payload)) {
        return `${who} actualizó los servicios del ticket`;
      }
      return `${who} actualizó el ticket`;
    case 'finished': {
      if (amount != null && amount > 0) {
        return `${who} finalizó el ticket con un pago de ${formatCompactCurrency(amount)}`;
      }
      return `${who} finalizó el ticket`;
    }
    case 'payment_collected': {
      if (amount != null) {
        return `${who} registró un pago de ${formatCompactCurrency(amount)}`;
      }
      return `${who} registró un pago`;
    }
    case 'deleted':
      return `${who} eliminó el ticket`;
    default: {
      const label = describeTicketAuditEvent(input.eventType);
      return `${who}: ${label}`;
    }
  }
};

export const formatTicketTimelineEntry = (
  input: TicketTimelineEntryInput,
): TicketTimelineFormatted => {
  const amount = extractTicketAuditAmount(input.eventType, input.payload);
  return {
    title: formatTicketTimelineTitle(input),
    icon: getTicketTimelineIcon(input.eventType),
    amount,
  };
};
