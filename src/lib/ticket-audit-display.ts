import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
  /** Field-level / service change bullets under the title (ticket detail only). */
  details: string[];
  icon: TicketTimelineIconKey;
  amount: number | null;
};

/** User-facing fields compared on soft updates (excludes internal client_id). */
export const TICKET_AUDIT_DIFF_FIELDS = [
  'client_name',
  'client_tel',
  'email',
  'document',
  'ticket_date',
  'total',
] as const;

export type TicketAuditDiffField = (typeof TICKET_AUDIT_DIFF_FIELDS)[number];

const FIELD_LABELS: Record<TicketAuditDiffField, string> = {
  client_name: 'cliente',
  client_tel: 'teléfono',
  email: 'email',
  document: 'documento',
  ticket_date: 'fecha',
  total: 'total',
};

export const describeTicketAuditEvent = (eventType: string): string =>
  TICKET_AUDIT_EVENT_LABELS[eventType] ?? eventType;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

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

const normalizeComparable = (value: unknown): string => {
  if (value == null || value === '') {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // ISO-ish timestamps from JSON payloads
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    return trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return String(value);
};

export const formatTicketAuditFieldValue = (
  field: TicketAuditDiffField,
  value: unknown,
): string => {
  if (value == null || value === '') {
    return '—';
  }

  if (field === 'total') {
    const amount = asNumber(value);
    if (amount == null) {
      const parsed = typeof value === 'string' ? Number(value) : null;
      if (parsed != null && Number.isFinite(parsed)) {
        return formatCompactCurrency(parsed);
      }
      return String(value);
    }
    return formatCompactCurrency(amount);
  }

  if (field === 'ticket_date') {
    const date =
      value instanceof Date
        ? value
        : typeof value === 'string' || typeof value === 'number'
          ? new Date(value)
          : null;
    if (date && !Number.isNaN(date.getTime())) {
      return format(date, 'd MMM yyyy', { locale: es });
    }
    return String(value);
  }

  return String(value).trim() || '—';
};

export const buildTicketAuditFieldDetails = (
  payload: Record<string, unknown> | null,
): string[] => {
  const before = asRecord(payload?.before);
  const after = asRecord(payload?.after);
  if (!before || !after) {
    return [];
  }

  const details: string[] = [];
  for (const field of TICKET_AUDIT_DIFF_FIELDS) {
    const beforeRaw = before[field];
    const afterRaw = after[field];
    if (normalizeComparable(beforeRaw) === normalizeComparable(afterRaw)) {
      continue;
    }
    const label = FIELD_LABELS[field];
    details.push(
      `${label}: ${formatTicketAuditFieldValue(field, beforeRaw)} → ${formatTicketAuditFieldValue(field, afterRaw)}`,
    );
  }
  return details;
};

const resolveServiceName = (payload: Record<string, unknown>): string | null => {
  if (typeof payload.serviceName === 'string' && payload.serviceName.trim()) {
    return payload.serviceName.trim();
  }
  const line = asRecord(payload.line);
  if (!line) {
    return null;
  }
  if (typeof line.name === 'string' && line.name.trim()) {
    return line.name.trim();
  }
  const nested = asRecord(line.service);
  if (typeof nested?.name === 'string' && nested.name.trim()) {
    return nested.name.trim();
  }
  return null;
};

export const buildTicketAuditServiceDetails = (
  payload: Record<string, unknown> | null,
): string[] => {
  if (!payload) {
    return [];
  }

  const serviceLine = payload.serviceLine;
  if (
    serviceLine === 'created' ||
    serviceLine === 'updated' ||
    serviceLine === 'deleted'
  ) {
    const name = resolveServiceName(payload);
    const verb =
      serviceLine === 'created'
        ? 'añadido'
        : serviceLine === 'updated'
          ? 'actualizado'
          : 'eliminado';
    if (name) {
      return [`Servicio ${verb}: ${name}`];
    }
    return [`Servicio ${verb}`];
  }

  if (hasServicesChanged(payload)) {
    const services = Array.isArray(payload.services) ? payload.services : [];
    const names = services
      .map((item) => {
        const row = asRecord(item);
        if (!row) {
          return null;
        }
        if (typeof row.name === 'string' && row.name.trim()) {
          return row.name.trim();
        }
        const nested = asRecord(row.service);
        if (typeof nested?.name === 'string' && nested.name.trim()) {
          return nested.name.trim();
        }
        return null;
      })
      .filter((name): name is string => Boolean(name));

    if (names.length > 0) {
      return [`Servicios actualizados: ${names.join(', ')}`];
    }
    return ['Servicios del ticket actualizados'];
  }

  return [];
};

export const buildTicketAuditUpdateDetails = (
  payload: Record<string, unknown> | null,
): string[] => {
  if (!payload) {
    return [];
  }

  const details = [
    ...buildTicketAuditFieldDetails(payload),
    ...buildTicketAuditServiceDetails(payload),
  ];

  if (payload.restored === true) {
    details.unshift('Ticket restaurado desde la papelera');
  }

  return details;
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
  const details =
    input.eventType === 'updated'
      ? buildTicketAuditUpdateDetails(input.payload)
      : [];

  return {
    title: formatTicketTimelineTitle(input),
    details,
    icon: getTicketTimelineIcon(input.eventType),
    amount,
  };
};
