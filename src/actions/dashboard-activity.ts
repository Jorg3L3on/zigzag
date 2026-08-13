'use server';

import { auth } from '@/lib/auth';
import {
  ACTIVITY_FEED_RESOURCE_TYPES,
  formatActivityFeed,
  isActivityFeedEvent,
  type ActivityFeedEventInput,
  type ActivityFeedItem,
} from '@/lib/activity-feed';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { queryAuditEvents } from '@/lib/audit-query';
import { checkPermission } from '@/lib/security';

const DEFAULT_LIMIT = 15;
const FETCH_PAGE_SIZE = 40;
const MAX_FETCH_PAGES = 3;

const FEED_ACTIONS = [
  'created',
  'updated',
  'finished',
  'payment_collected',
  'generated',
  'signed_in',
  'signed_out',
] as const;

export type DashboardActivityResponse = {
  success: boolean;
  data?: {
    items: ActivityFeedItem[];
    nextCursor: number | null;
  };
  error?: string;
  errorType?: ActionErrorType;
};

export type FetchDashboardActivityInput = {
  companyId?: number;
  cursor?: number;
  limit?: number;
};

const toFeedInput = (event: {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  resource_type: string;
  resource_id: string | null;
  action: string;
  result: string;
  payload: Record<string, unknown> | null;
}): ActivityFeedEventInput => ({
  id: event.id,
  occurredAt: event.occurred_at,
  actorUserId: event.actor_user_id,
  actorName: event.actor_name,
  resourceType: event.resource_type,
  resourceId: event.resource_id,
  action: event.action,
  result: event.result,
  payload: event.payload,
});

/**
 * Tenant-scoped activity feed backed by AuditEvent.
 * Reuses `queryAuditEvents` with dashboard `tickets.read` RBAC.
 * Permission-denied and failed events are excluded.
 */
export async function fetchDashboardActivity(
  input: FetchDashboardActivityInput = {},
): Promise<DashboardActivityResponse> {
  try {
    const session = await auth();
    if (!session?.user?.company_id) {
      return buildActionError('AU001');
    }

    if (
      !session.user.company_is_system &&
      input.companyId != null &&
      input.companyId !== session.user.company_id
    ) {
      return buildActionError('AU002');
    }

    let effectiveCompanyId = session.user.company_id;
    if (session.user.company_is_system) {
      if (input.companyId == null) {
        return { success: true, data: { items: [], nextCursor: null } };
      }
      effectiveCompanyId = input.companyId;
      // Never surface the system company's own audit stream as tenant activity.
      if (effectiveCompanyId === session.user.company_id) {
        return { success: true, data: { items: [], nextCursor: null } };
      }
    }

    const allowed = await checkPermission(
      session.user.id,
      effectiveCompanyId,
      'tickets.read',
    );
    if (!allowed) {
      return buildActionError('AU002');
    }

    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), 50);
    const collected: ActivityFeedEventInput[] = [];
    let cursor = input.cursor;
    let queryNextCursor: number | null = null;
    let pages = 0;

    while (collected.length < limit && pages < MAX_FETCH_PAGES) {
      const page = await queryAuditEvents({
        targetCompanyId: effectiveCompanyId,
        result: 'success',
        resourceTypes: [...ACTIVITY_FEED_RESOURCE_TYPES],
        actions: [...FEED_ACTIONS],
        cursor,
        limit: FETCH_PAGE_SIZE,
      });

      for (const row of page.items) {
        const feedInput = toFeedInput(row);
        if (!isActivityFeedEvent(feedInput)) {
          continue;
        }
        collected.push(feedInput);
        if (collected.length >= limit) {
          break;
        }
      }

      queryNextCursor = page.nextCursor;
      if (!page.nextCursor) {
        break;
      }
      cursor = page.nextCursor;
      pages += 1;
    }

    const pageEvents = collected.slice(0, limit);
    const nextCursor =
      pageEvents.length === limit
        ? (pageEvents[pageEvents.length - 1]?.id ?? null)
        : null;

    // If we stopped early because pages exhausted but the query still has more,
    // preserve that cursor so "Load more" can continue.
    const resolvedCursor =
      nextCursor ??
      (pages >= MAX_FETCH_PAGES ? queryNextCursor : null);

    return {
      success: true,
      data: {
        items: formatActivityFeed(pageEvents),
        nextCursor: resolvedCursor,
      },
    };
  } catch (error) {
    return handleCodedServerActionError('dashboard.activity', 'DB001', error);
  }
}
