/**
 * Web Push delivery (ZIG-I20-2): standard Web Push with the app's own VAPID
 * keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), no paid
 * service. Every send is scoped by company: a notification row only reaches
 * the subscriptions of `row.company_id` (and of `row.user_id` when targeted),
 * so a push never carries another company's data. Subscriptions the push
 * service rejects with 404/410 are deleted. Best effort: never throws into
 * the caller, which already inserted the in-app notification.
 */
import { and, count, eq, inArray, isNull, or } from 'drizzle-orm';
import { notification, pushSubscription, type NotificationRow } from '@/db/schema';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { notificationHref } from '@/lib/notification-href';
import {
  MAX_PUSH_ACTIONS,
  withNotificationParam,
  type PushAction,
  type PushPayload,
} from '@/lib/push/display';
import { SCHEDULE_DAILY_DIGEST_TYPE } from '@/lib/schedule-digest';

export type { PushPayload } from '@/lib/push/display';

export type PushTarget = Pick<
  NotificationRow,
  'id' | 'company_id' | 'user_id' | 'type' | 'title' | 'body' | 'resource_type' | 'resource_id'
>;

export const isWebPushConfigured = (): boolean =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** `scheduleId:clientId:serviceId` rows point at one schedule. */
const scheduleIdOf = (row: PushTarget): string | null => {
  if (row.resource_type !== 'client_service_schedule' || !row.resource_id) return null;
  const parts = row.resource_id.split(':');
  return parts.length === 3 ? parts[0] : null;
};

/**
 * One tag per schedule, so an overdue notice replaces the earlier "próximo"
 * for the same service (and re-alerts, see `buildNotificationDisplay`); one
 * tag for the daily digest, so today's replaces yesterday's.
 */
export const pushTagFor = (row: PushTarget): string => {
  if (row.type === SCHEDULE_DAILY_DIGEST_TYPE) return 'zigzag-schedule-digest';
  const scheduleId = scheduleIdOf(row);
  if (scheduleId) return `zigzag-schedule-${scheduleId}`;
  return `zigzag-notification-${row.id}`;
};

/** Only Vercel Blob downloads are offered as a Descargar button. */
const isBlobDownloadUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
};

/**
 * Android action buttons (ZIG-I21-2): a schedule reminder offers Crear ticket
 * (composer prefilled) and Ver (the schedule queue); a ready export offers
 * Descargar. In-app URLs carry `?notification=<id>` so the page marks it read.
 */
export const pushActionsFor = (row: PushTarget): PushAction[] => {
  const actions: PushAction[] = [];
  const scheduleId = scheduleIdOf(row);
  if (scheduleId && row.type !== SCHEDULE_DAILY_DIGEST_TYPE) {
    const composer = notificationHref(row);
    if (composer) {
      actions.push({ action: 'crear', title: 'Crear ticket', url: withNotificationParam(composer, row.id) });
    }
    const filter = row.type === 'schedule_overdue' ? 'atrasados' : 'proximos';
    actions.push({
      action: 'ver',
      title: 'Ver',
      url: withNotificationParam(`/service-schedules?filter=${filter}`, row.id),
    });
  }
  if (row.resource_type === 'company_export' && row.resource_id && isBlobDownloadUrl(row.resource_id)) {
    actions.push({ action: 'descargar', title: 'Descargar', url: row.resource_id });
  }
  return actions.slice(0, MAX_PUSH_ACTIONS);
};

export const buildPushPayload = (row: PushTarget): PushPayload => {
  const url =
    (row.resource_type === 'company_export' ? '/company' : notificationHref(row)) ?? '/dashboard';
  return {
    title: row.title,
    body: row.body ?? null,
    url: withNotificationParam(url, row.id),
    tag: pushTagFor(row),
    type: row.type,
    notificationId: row.id,
    actions: pushActionsFor(row),
  };
};

type WebPushModule = typeof import('web-push');

let webPushPromise: Promise<WebPushModule | null> | null = null;

/** Loaded lazily so the cron and job paths pay for the module only when keys exist. */
const loadWebPush = (): Promise<WebPushModule | null> => {
  if (!isWebPushConfigured()) return Promise.resolve(null);
  if (!webPushPromise) {
    webPushPromise = import('web-push').then((mod) => {
      const webPush = mod.default ?? mod;
      webPush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:hola@zigzag.app',
        process.env.VAPID_PUBLIC_KEY as string,
        process.env.VAPID_PRIVATE_KEY as string,
      );
      return webPush;
    });
  }
  return webPushPromise;
};

/**
 * Unread notifications one user sees in the company (same visibility as the
 * bell: company-wide rows plus the user's own), for the app icon badge
 * (ZIG-I21-3). Undefined when the count fails: the push still goes out.
 */
const unreadCountFor = async (companyId: number, userId: bigint): Promise<number | undefined> => {
  try {
    const [row] = await db
      .select({ total: count() })
      .from(notification)
      .where(
        and(
          eq(notification.company_id, companyId),
          isNull(notification.read_at),
          or(isNull(notification.user_id), eq(notification.user_id, userId)),
        ),
      );
    return Number(row?.total ?? 0);
  } catch (error) {
    logger.warn('Web Push unread count failed', { companyId, error });
    return undefined;
  }
};

/** Push-service status codes that mean the subscription is dead. */
const GONE_STATUSES = new Set([404, 410]);

/**
 * Send one notification row to every device subscribed in its company (or
 * only the target user's devices when the row has a user). Returns how many
 * devices accepted it.
 */
export const sendPushForNotification = async (row: PushTarget): Promise<number> => {
  const webPush = await loadWebPush();
  if (!webPush) return 0;

  const subscriptions = await db
    .select()
    .from(pushSubscription)
    .where(
      row.user_id != null
        ? and(
            eq(pushSubscription.company_id, row.company_id),
            eq(pushSubscription.user_id, row.user_id),
          )
        : eq(pushSubscription.company_id, row.company_id),
    );
  if (subscriptions.length === 0) return 0;

  const basePayload = buildPushPayload(row);
  const userIds = [...new Set(subscriptions.map((subscription) => subscription.user_id))];
  const unreadByUser = new Map(
    await Promise.all(
      userIds.map(async (userId) => [userId, await unreadCountFor(row.company_id, userId)] as const),
    ),
  );
  const payloadFor = (userId: bigint) =>
    JSON.stringify({ ...basePayload, unread: unreadByUser.get(userId) });
  const gone: number[] = [];
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payloadFor(subscription.user_id),
          { TTL: 24 * 60 * 60, urgency: 'normal' },
        );
        delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status !== undefined && GONE_STATUSES.has(status)) {
          gone.push(subscription.id);
        } else {
          logger.warn('Web Push send failed', {
            subscriptionId: subscription.id,
            companyId: row.company_id,
            status,
          });
        }
      }
    }),
  );

  if (gone.length > 0) {
    await db.delete(pushSubscription).where(inArray(pushSubscription.id, gone));
  }
  return delivered;
};

/** Fan out several rows (e.g. the reminders a materialization just inserted). */
export const sendPushForNotifications = async (rows: PushTarget[]): Promise<void> => {
  if (rows.length === 0 || !isWebPushConfigured()) return;
  try {
    for (const row of rows) {
      await sendPushForNotification(row);
    }
  } catch (error) {
    logger.warn('Web Push fan-out failed', { count: rows.length, error });
  }
};
