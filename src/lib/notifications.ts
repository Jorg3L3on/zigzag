import { addDays, endOfDay, format, startOfDay } from 'date-fns';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { clientServiceSchedule, notification } from '@/db/schema';
import { db } from '@/lib/db';
import { classifyScheduleBucket, DUE_SOON_DAYS } from '@/lib/schedule-buckets';
import { emitRealtimeEvent } from '@/lib/realtime/events';

const dueDateKey = (date: Date): string => format(startOfDay(date), 'yyyy-MM-dd');

type NotificationInsert = typeof notification.$inferInsert;

/**
 * Materialize in-app reminder notifications for a single company from its
 * service schedules. Idempotent: a partial unique index on
 * (company_id, dedupe_key) plus ON CONFLICT DO NOTHING prevents duplicates, so
 * this is safe to call on demand (when a user opens the app) and from cron.
 *
 * Returns the number of candidate notifications considered (not necessarily
 * inserted, since duplicates are ignored).
 */
export const materializeScheduleNotificationsForCompany = async (
  companyId: number,
  today: Date = new Date(),
): Promise<number> => {
  const horizon = endOfDay(addDays(startOfDay(today), DUE_SOON_DAYS));

  const schedules = await db.query.clientServiceSchedule.findMany({
    where: and(
      eq(clientServiceSchedule.company_id, companyId),
      isNull(clientServiceSchedule.deleted_at),
      isNull(clientServiceSchedule.paused_at),
      lte(clientServiceSchedule.next_due_at, horizon),
    ),
    with: { client: true, service: true },
  });

  const rows: NotificationInsert[] = [];
  for (const schedule of schedules) {
    const bucket = classifyScheduleBucket(
      schedule.next_due_at,
      schedule.paused_at,
      today,
    );
    if (bucket !== 'atrasados' && bucket !== 'proximos') {
      continue;
    }

    const clientName = schedule.client?.name ?? 'Cliente';
    const serviceName = schedule.service?.name ?? 'Servicio';
    const isOverdue = bucket === 'atrasados';

    rows.push({
      company_id: companyId,
      user_id: null,
      type: isOverdue ? 'schedule_overdue' : 'schedule_due_soon',
      title: isOverdue ? 'Servicio atrasado' : 'Servicio próximo',
      body: `${serviceName} para ${clientName}`,
      resource_type: 'client_service_schedule',
      resource_id: String(schedule.id),
      dedupe_key: `schedule:${schedule.id}:${bucket}:${dueDateKey(
        schedule.next_due_at,
      )}`,
    });
  }

  if (rows.length === 0) {
    return 0;
  }

  await db.insert(notification).values(rows).onConflictDoNothing();
  await emitRealtimeEvent({
    type: 'notification',
    companyId,
    resourceType: 'client_service_schedule',
  });
  return rows.length;
};

/** Materialize reminders across every company that has schedules (cron entry point). */
export const materializeScheduleNotificationsForAllCompanies = async (
  today: Date = new Date(),
): Promise<{ companies: number; candidates: number }> => {
  const companyRows = await db
    .selectDistinct({ companyId: clientServiceSchedule.company_id })
    .from(clientServiceSchedule)
    .where(isNull(clientServiceSchedule.deleted_at));

  let candidates = 0;
  for (const { companyId } of companyRows) {
    candidates += await materializeScheduleNotificationsForCompany(
      companyId,
      today,
    );
  }

  return { companies: companyRows.length, candidates };
};
