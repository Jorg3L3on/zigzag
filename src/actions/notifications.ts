'use server';

import { and, count, desc, eq, isNull, or } from 'drizzle-orm';
import { notification, type NotificationRow } from '@/db/schema';
import { db } from '@/lib/db';
import { requireActionAuth } from '@/lib/security';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { materializeScheduleNotificationsForCompany } from '@/lib/notifications';

const NOTIFICATION_LIST_LIMIT = 30;

/**
 * Notifications are visible to any authenticated member of the company. Each
 * row is either company-wide (`user_id` null) or targeted at a specific user.
 */
const visibilityCondition = (companyId: number, userId: string) =>
  and(
    eq(notification.company_id, companyId),
    or(isNull(notification.user_id), eq(notification.user_id, BigInt(userId))),
  );

export async function getNotifications(): Promise<{
  success: boolean;
  data?: NotificationRow[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    if (!context.companyId) {
      return { success: true, data: [] };
    }

    // Best-effort on-demand materialization so reminders appear even without the
    // cron job (e.g. local dev). Never block the list on this.
    try {
      await materializeScheduleNotificationsForCompany(context.companyId);
    } catch (materializeError) {
      console.warn('[notifications] materialize failed', materializeError);
    }

    const rows = await db
      .select()
      .from(notification)
      .where(visibilityCondition(context.companyId, context.userId))
      .orderBy(desc(notification.created_at))
      .limit(NOTIFICATION_LIST_LIMIT);

    return { success: true, data: rows };
  } catch (e) {
    return handleCodedServerActionError('notifications.list', 'GN001', e);
  }
}

export async function getUnreadNotificationCount(): Promise<{
  success: boolean;
  data?: number;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    if (!context.companyId) {
      return { success: true, data: 0 };
    }

    const [row] = await db
      .select({ total: count() })
      .from(notification)
      .where(
        and(
          visibilityCondition(context.companyId, context.userId),
          isNull(notification.read_at),
        ),
      );

    return { success: true, data: Number(row?.total ?? 0) };
  } catch (e) {
    return handleCodedServerActionError('notifications.count', 'GN001', e);
  }
}

export async function markNotificationRead(id: number): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    if (!context.companyId) {
      return { success: false, errorType: 'auth' };
    }

    await db
      .update(notification)
      .set({ read_at: new Date() })
      .where(
        and(
          eq(notification.id, id),
          visibilityCondition(context.companyId, context.userId),
          isNull(notification.read_at),
        ),
      );

    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('notifications.read', 'GN001', e);
  }
}

export async function markAllNotificationsRead(): Promise<{
  success: boolean;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const context = await requireActionAuth();
    if (!context.companyId) {
      return { success: false, errorType: 'auth' };
    }

    await db
      .update(notification)
      .set({ read_at: new Date() })
      .where(
        and(
          visibilityCondition(context.companyId, context.userId),
          isNull(notification.read_at),
        ),
      );

    return { success: true };
  } catch (e) {
    return handleCodedServerActionError('notifications.read-all', 'GN001', e);
  }
}
