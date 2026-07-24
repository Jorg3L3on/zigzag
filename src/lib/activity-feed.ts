import { resolveAuditResourceLink } from '@/lib/audit-display';
import { extractTicketAuditAmount } from '@/lib/ticket-audit-display';
import { formatCompactCurrency } from '@/lib/format-compact';

/** Icon keys mapped by the presentation layer (keep formatter React-free). */
export type ActivityFeedIconKey =
  | 'ticket'
  | 'payment'
  | 'invoice'
  | 'client'
  | 'service'
  | 'user'
  | 'company'
  | 'auth'
  | 'generic';

export type ActivityFeedEventInput = {
  id: number;
  occurredAt: string;
  actorUserId: string | null;
  actorName: string | null;
  resourceType: string;
  resourceId: string | null;
  action: string;
  result: string;
  payload: Record<string, unknown> | null;
};

export type ActivityFeedItem = {
  /** Stable key for React lists (single id or grouped ids). */
  id: string;
  eventIds: number[];
  icon: ActivityFeedIconKey;
  title: string;
  description: string | null;
  occurredAt: string;
  href: string | null;
  count: number;
  actorName: string | null;
  resourceType: string;
  action: string;
};

const GROUP_WINDOW_MS = 15 * 60 * 1000;

const FEED_ACTION_ALLOWLIST = new Set([
  'created',
  'updated',
  'finished',
  'payment_collected',
  'generated',
  'signed_in',
  'signed_out',
]);

const FEED_RESOURCE_ALLOWLIST = new Set([
  'ticket',
  'client',
  'service',
  'user',
  'company',
  'auth',
  'invoice',
]);

export const ACTIVITY_FEED_RESOURCE_TYPES = [
  'ticket',
  'client',
  'service',
  'user',
  'company',
  'auth',
  'invoice',
] as const;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const pickName = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    const value = asString(candidate);
    if (value) {
      return value;
    }
  }
  return null;
};

const getPayloadRecord = (
  payload: Record<string, unknown> | null,
  key: 'before' | 'after' | 'ticket',
): Record<string, unknown> | null => asRecord(payload?.[key]);

const actorLabel = (actorName: string | null): string =>
  actorName?.trim() || 'Alguien';

const isDeletedResource = (event: ActivityFeedEventInput): boolean => {
  if (event.action === 'deleted') {
    return true;
  }
  const after = getPayloadRecord(event.payload, 'after');
  return after?.deleted_at != null;
};

const resolveHref = (event: ActivityFeedEventInput): string | null => {
  if (isDeletedResource(event)) {
    return null;
  }
  if (event.resourceType === 'auth') {
    return null;
  }
  if (event.resourceType === 'invoice') {
    return resolveAuditResourceLink('invoice', event.resourceId)?.href ?? null;
  }
  if (event.resourceType === 'user') {
    return resolveAuditResourceLink('user', event.resourceId)?.href ?? null;
  }
  return (
    resolveAuditResourceLink(event.resourceType, event.resourceId)?.href ?? null
  );
};

const isCompanyActivated = (event: ActivityFeedEventInput): boolean => {
  if (event.resourceType !== 'company' || event.action !== 'updated') {
    return false;
  }
  const before = getPayloadRecord(event.payload, 'before');
  const after = getPayloadRecord(event.payload, 'after');
  return before?.status !== 'active' && after?.status === 'active';
};

export const isActivityFeedEvent = (event: ActivityFeedEventInput): boolean => {
  if (event.result !== 'success') {
    return false;
  }
  if (event.action === 'permission_denied') {
    return false;
  }
  if (!FEED_RESOURCE_ALLOWLIST.has(event.resourceType)) {
    return false;
  }
  if (!FEED_ACTION_ALLOWLIST.has(event.action)) {
    return false;
  }
  // Ticket "assigned" / generic status codes do not exist in the catalog yet.
  return true;
};

const ticketClientName = (event: ActivityFeedEventInput): string | null => {
  const ticket = getPayloadRecord(event.payload, 'ticket');
  const after = getPayloadRecord(event.payload, 'after');
  const before = getPayloadRecord(event.payload, 'before');
  return pickName(
    ticket?.client_name,
    after?.client_name,
    before?.client_name,
  );
};

const resourceDisplayName = (event: ActivityFeedEventInput): string | null => {
  const after = getPayloadRecord(event.payload, 'after');
  const before = getPayloadRecord(event.payload, 'before');
  const ticket = getPayloadRecord(event.payload, 'ticket');
  return pickName(
    after?.name,
    before?.name,
    ticket?.client_name,
    after?.client_name,
    before?.client_name,
  );
};

const formatTicketRef = (resourceId: string | null): string =>
  resourceId ? `#${resourceId}` : 'un ticket';

const buildSingleTitle = (event: ActivityFeedEventInput): string => {
  const who = actorLabel(event.actorName);
  const name = resourceDisplayName(event);
  const ticketRef = formatTicketRef(event.resourceId);

  if (event.resourceType === 'auth' && event.action === 'signed_in') {
    return `${who} inició sesión`;
  }
  if (event.resourceType === 'auth' && event.action === 'signed_out') {
    return `${who} cerró sesión`;
  }

  if (event.resourceType === 'ticket') {
    if (event.action === 'created') {
      return `${who} creó el ticket ${ticketRef}`;
    }
    if (event.action === 'updated') {
      return `${who} actualizó el ticket ${ticketRef}`;
    }
    if (event.action === 'finished') {
      return `${who} finalizó el ticket ${ticketRef}`;
    }
    if (event.action === 'payment_collected') {
      const amount = extractTicketAuditAmount(
        'payment_collected',
        event.payload,
      );
      if (amount != null) {
        return `${who} registró un pago de ${formatCompactCurrency(amount)} en el ticket ${ticketRef}`;
      }
      return `${who} registró un pago en el ticket ${ticketRef}`;
    }
  }

  if (event.resourceType === 'invoice' && event.action === 'generated') {
    return `${who} generó la factura del ticket ${ticketRef}`;
  }

  if (event.resourceType === 'client') {
    const label = name ? `"${name}"` : 'un cliente';
    if (event.action === 'created') {
      return `${who} creó el cliente ${label}`;
    }
    if (event.action === 'updated') {
      return `${who} actualizó el cliente ${label}`;
    }
  }

  if (event.resourceType === 'service') {
    const label = name ? `"${name}"` : 'un servicio';
    if (event.action === 'created') {
      return `${who} creó el servicio ${label}`;
    }
    if (event.action === 'updated') {
      return `${who} actualizó el servicio ${label}`;
    }
  }

  if (event.resourceType === 'user' && event.action === 'created') {
    const label = name ? `"${name}"` : 'un usuario';
    return `${who} creó el usuario ${label}`;
  }

  if (event.resourceType === 'company') {
    const label = name ? `"${name}"` : 'una empresa';
    if (event.action === 'created') {
      return `${who} creó la empresa ${label}`;
    }
    if (isCompanyActivated(event)) {
      return `${who} activó la empresa ${label}`;
    }
    if (event.action === 'updated') {
      return `${who} actualizó la empresa ${label}`;
    }
  }

  return `${who} realizó una acción`;
};

const buildSingleDescription = (
  event: ActivityFeedEventInput,
): string | null => {
  if (event.resourceType === 'ticket') {
    const client = ticketClientName(event);
    if (client) {
      return `Cliente: ${client}`;
    }
  }
  if (event.resourceType === 'invoice') {
    return 'Comprobante PDF generado';
  }
  if (event.resourceType === 'auth') {
    return null;
  }
  return null;
};

const resolveIcon = (event: ActivityFeedEventInput): ActivityFeedIconKey => {
  if (event.resourceType === 'invoice') {
    return 'invoice';
  }
  if (event.action === 'payment_collected') {
    return 'payment';
  }
  if (event.resourceType === 'ticket') {
    return 'ticket';
  }
  if (event.resourceType === 'client') {
    return 'client';
  }
  if (event.resourceType === 'service') {
    return 'service';
  }
  if (event.resourceType === 'user') {
    return 'user';
  }
  if (event.resourceType === 'company') {
    return 'company';
  }
  if (event.resourceType === 'auth') {
    return 'auth';
  }
  return 'generic';
};

export const formatActivityFeedItem = (
  event: ActivityFeedEventInput,
): ActivityFeedItem | null => {
  if (!isActivityFeedEvent(event)) {
    return null;
  }

  return {
    id: String(event.id),
    eventIds: [event.id],
    icon: resolveIcon(event),
    title: buildSingleTitle(event),
    description: buildSingleDescription(event),
    occurredAt: event.occurredAt,
    href: resolveHref(event),
    count: 1,
    actorName: event.actorName,
    resourceType: event.resourceType,
    action: isCompanyActivated(event) ? 'activated' : event.action,
  };
};

const pluralResource = (resourceType: string, count: number): string => {
  switch (resourceType) {
    case 'ticket':
      return count === 1 ? 'ticket' : 'tickets';
    case 'client':
      return count === 1 ? 'cliente' : 'clientes';
    case 'service':
      return count === 1 ? 'servicio' : 'servicios';
    case 'user':
      return count === 1 ? 'usuario' : 'usuarios';
    case 'company':
      return count === 1 ? 'empresa' : 'empresas';
    case 'invoice':
      return count === 1 ? 'factura' : 'facturas';
    default:
      return count === 1 ? 'evento' : 'eventos';
  }
};

const buildGroupedTitle = (item: ActivityFeedItem, count: number): string => {
  const who = actorLabel(item.actorName);
  const resource = pluralResource(item.resourceType, count);

  if (item.action === 'created') {
    return `${who} creó ${count} ${resource}`;
  }
  if (item.action === 'updated') {
    return `${who} actualizó ${count} ${resource}`;
  }
  if (item.action === 'finished') {
    return `${who} finalizó ${count} ${resource}`;
  }
  if (item.action === 'payment_collected') {
    return `${who} registró ${count} pagos`;
  }
  if (item.action === 'generated') {
    return `${who} generó ${count} ${resource}`;
  }
  if (item.action === 'signed_in') {
    return `${who} inició sesión ${count} veces`;
  }
  if (item.action === 'signed_out') {
    return `${who} cerró sesión ${count} veces`;
  }
  if (item.action === 'activated') {
    return `${who} activó ${count} ${resource}`;
  }
  return `${who} realizó ${count} acciones`;
};

/**
 * Groups consecutive identical activity items that occur within a short window.
 * Input must already be reverse-chronological.
 */
export const groupActivityFeedItems = (
  items: ActivityFeedItem[],
  windowMs: number = GROUP_WINDOW_MS,
): ActivityFeedItem[] => {
  if (items.length === 0) {
    return [];
  }

  const grouped: ActivityFeedItem[] = [];
  let current: ActivityFeedItem = {
    ...items[0],
    eventIds: [...items[0].eventIds],
  };

  for (let i = 1; i < items.length; i += 1) {
    const next = items[i];
    const sameActor = current.actorName === next.actorName;
    const sameKind =
      current.resourceType === next.resourceType &&
      current.action === next.action;
    const gapMs = Math.abs(
      new Date(current.occurredAt).getTime() -
        new Date(next.occurredAt).getTime(),
    );
    const withinWindow = gapMs <= windowMs;

    if (sameActor && sameKind && withinWindow) {
      const eventIds = [...current.eventIds, ...next.eventIds];
      const count = current.count + next.count;
      current = {
        ...current,
        id: `group-${eventIds.join('-')}`,
        eventIds,
        count,
        title: buildGroupedTitle(current, count),
        description: 'Varias acciones consecutivas',
        href: null,
      };
      continue;
    }

    grouped.push(current);
    current = { ...next, eventIds: [...next.eventIds] };
  }

  grouped.push(current);
  return grouped;
};

export const formatActivityFeed = (
  events: ActivityFeedEventInput[],
): ActivityFeedItem[] => {
  const items: ActivityFeedItem[] = [];
  for (const event of events) {
    const item = formatActivityFeedItem(event);
    if (item) {
      items.push(item);
    }
  }
  return groupActivityFeedItems(items);
};
