import type { AuditEventListItem } from '@/lib/audit-query';

const GROUP_WINDOW_MS = 15 * 60 * 1000;

export type OperatorActivityRow = AuditEventListItem & {
  /** Collapsed consecutive event ids (includes self). */
  eventIds: number[];
  count: number;
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
  };

  for (let i = 1; i < events.length; i += 1) {
    const next = events[i];
    if (canGroup(current, next, windowMs)) {
      current = {
        ...current,
        eventIds: [...current.eventIds, next.id],
        count: current.count + 1,
      };
      continue;
    }
    grouped.push(current);
    current = {
      ...next,
      eventIds: [next.id],
      count: 1,
    };
  }

  grouped.push(current);
  return grouped;
};
