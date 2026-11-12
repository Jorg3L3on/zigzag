import type { AuditEventListItem } from '@/lib/audit-query';
import { formatAuditEventSummary } from '@/lib/audit-event-summary';
import { formatAuditResourceTypeLabel } from '@/lib/audit-labels';
import { isOperatorIncidentEvent } from '@/lib/operator-audit-incidents';
import {
  SIGN_IN_BURST_THRESHOLD,
  SIGN_IN_BURST_WINDOW_MINUTES,
} from '@/lib/operator-sign-in-burst';

const GROUP_WINDOW_MS = 15 * 60 * 1000;

export type OperatorActivityRow = AuditEventListItem & {
  /** Collapsed consecutive event ids (includes self). */
  eventIds: number[];
  count: number;
  /** Times of the grouped events, newest first (includes self). */
  times: string[];
};

const canGroup = (
  current: OperatorActivityRow,
  next: AuditEventListItem,
  windowMs: number,
): boolean => {
  if (current.actor_user_id !== next.actor_user_id) {
    return false;
  }
  if (current.resource_type !== next.resource_type) {
    return false;
  }
  if (current.action !== next.action) {
    return false;
  }
  if (current.result !== next.result) {
    return false;
  }
  // Only collapse noisy auth session events; keep other rows distinct.
  if (current.resource_type !== 'auth') {
    return false;
  }
  if (
    current.action !== 'signed_in' &&
    current.action !== 'signed_out' &&
    current.action !== 'sign_in_failed'
  ) {
    return false;
  }

  const gapMs = Math.abs(
    new Date(current.occurred_at).getTime() -
      new Date(next.occurred_at).getTime(),
  );
  return gapMs <= windowMs;
};

/**
 * Groups consecutive auth session events from the same actor within a window.
 * Input must already be reverse-chronological.
 */
export const groupOperatorActivityEvents = (
  events: AuditEventListItem[],
  windowMs: number = GROUP_WINDOW_MS,
): OperatorActivityRow[] => {
  if (events.length === 0) {
    return [];
  }

  const grouped: OperatorActivityRow[] = [];
  let current: OperatorActivityRow = {
    ...events[0],
    eventIds: [events[0].id],
    count: 1,
    times: [events[0].occurred_at],
  };

  for (let i = 1; i < events.length; i += 1) {
    const next = events[i];
    if (canGroup(current, next, windowMs)) {
      current = {
        ...current,
        eventIds: [...current.eventIds, next.id],
        count: current.count + 1,
        times: [...current.times, next.occurred_at],
      };
      continue;
    }
    grouped.push(current);
    current = {
      ...next,
      eventIds: [next.id],
      count: 1,
      times: [next.occurred_at],
    };
  }

  grouped.push(current);
  return grouped;
};

/* ---- Actividad of the console (ZIG-I38-5) ---- */

export type ActivityDatePreset = '7d' | '30d' | '90d' | 'all';

export const ACTIVITY_DATE_OPTIONS: { value: ActivityDatePreset; label: string }[] = [
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: '90d', label: 'Últimos 90 días' },
  { value: 'all', label: 'Todo el historial' },
];

export type ActivityFilters = {
  companyId: number;
  search: string;
  date: ActivityDatePreset;
  actorUserId: string | null;
  action: string | null;
  alertsOnly: boolean;
};

export const ACTIVITY_PAGE_SIZE = 25;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The query string for /api/audit/events; `from` comes from the date preset. */
export const buildActivityQuery = (
  filters: ActivityFilters,
  cursor: number | null = null,
  now: Date = new Date(),
): URLSearchParams => {
  const params = new URLSearchParams();
  params.set('target_company_id', String(filters.companyId));
  params.set('limit', String(ACTIVITY_PAGE_SIZE));
  if (filters.search) params.set('search', filters.search);
  const days = { '7d': 7, '30d': 30, '90d': 90, all: null }[filters.date];
  if (days != null) {
    params.set('from', new Date(now.getTime() - days * DAY_MS).toISOString());
    params.set('to', now.toISOString());
  }
  if (filters.actorUserId) params.set('actor_user_id', filters.actorUserId);
  if (filters.action) params.set('action', filters.action);
  if (filters.alertsOnly) params.set('incidents_only', '1');
  if (cursor != null) params.set('cursor', String(cursor));
  return params;
};

/** Done by someone outside the company: the ZigZag operator (audit A4). */
export const isOperatorActor = (row: AuditEventListItem): boolean =>
  row.actor_company_id != null &&
  row.target_company_id != null &&
  row.actor_company_id !== row.target_company_id;

export type ActivityResult = { label: string; tone: 'emerald' | 'amber' | 'red' | 'slate' };

export const activityResult = (row: OperatorActivityRow): ActivityResult => {
  if (row.action === 'sign_in_failed' && row.count >= SIGN_IN_BURST_THRESHOLD) {
    return { label: 'Alerta', tone: 'red' };
  }
  if (row.action === 'permission_denied') return { label: 'Denegado', tone: 'amber' };
  if (row.result === 'success') return { label: 'Correcto', tone: 'emerald' };
  if (row.result === 'denied') return { label: 'Denegado', tone: 'amber' };
  if (row.result === 'failed') return { label: 'Fallido', tone: 'red' };
  return { label: row.result, tone: 'slate' };
};

/** Why the row is an alert, when it is one. */
export const activityAlertReason = (row: OperatorActivityRow): string | null => {
  if (row.action === 'sign_in_failed' && row.count >= SIGN_IN_BURST_THRESHOLD) {
    return `${SIGN_IN_BURST_THRESHOLD} o más intentos fallidos en ${SIGN_IN_BURST_WINDOW_MINUTES} minutos`;
  }
  if (row.action === 'permission_denied') {
    return 'Intentó algo para lo que no tiene permiso';
  }
  return null;
};

/** One sentence: who + what + on what; grouped rows say how many times. */
export const activitySentence = (row: OperatorActivityRow): string => {
  const { title } = formatAuditEventSummary({
    actor_name: row.actor_name,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    action: row.action,
    result: row.result,
    payload: row.payload,
    request_meta: row.request_meta,
  });
  return row.count > 1 ? `${title}, ${row.count} veces` : title;
};

export const activityArea = (row: AuditEventListItem): string =>
  formatAuditResourceTypeLabel(row.resource_type);

export const isActivityAlertRow = (row: OperatorActivityRow): boolean =>
  isOperatorIncidentEvent(row);

/** «Chrome en Android» from a user agent; null when it says nothing useful. */
export const describeUserAgent = (ua: unknown): string | null => {
  if (typeof ua !== 'string' || !ua.trim()) return null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua) || /HeadlessChrome/.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iOS/.test(ua)
      ? 'iPhone'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (browser && os) return `${browser} en ${os}`;
  return browser ?? os;
};

export type ActivityChange = { field: string; before: string; after: string };

const display = (value: unknown): string => {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const asObject = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Fields that changed between payload.before and payload.after (audit A2). */
export const activityChanges = (
  payload: Record<string, unknown> | null,
  redact: (value: unknown) => unknown = (value) => value,
): ActivityChange[] => {
  const before = asObject(payload?.before);
  const after = asObject(payload?.after);
  if (!before || !after) return [];
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys
    .filter((key) => !['updated_at', 'created_at'].includes(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({
      field: key,
      before: display(redact(before[key])),
      after: display(redact(after[key])),
    }));
};
