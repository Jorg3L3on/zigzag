/**
 * Web Push delivery (ZIG-I20-2): standard Web Push with the app's own VAPID
 * keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), no paid
 * service. Every send is scoped by company: a notification row only reaches
 * the subscriptions of `row.company_id` (and of `row.user_id` when targeted),
 * so a push never carries another company's data. Subscriptions the push
 * service rejects with 404/410 are deleted. Best effort: never throws into
 * the caller, which already inserted the in-app notification.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { pushSubscription, type NotificationRow } from '@/db/schema';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { notificationHref } from '@/lib/notification-href';
import type { PushPayload } from '@/lib/push/display';
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

export const buildPushPayload = (row: PushTarget): PushPayload => ({
  title: row.title,
  body: row.body ?? null,
  url: row.resource_type === 'company_export' ? '/company' : notificationHref(row),
  tag: pushTagFor(row),
  type: row.type,
  notificationId: row.id,
  actions: [],
});

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

  const payload = JSON.stringify(buildPushPayload(row));
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
          payload,
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
