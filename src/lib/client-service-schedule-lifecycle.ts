import { and, eq, isNull } from 'drizzle-orm';
import { clientServiceSchedule } from '@/db/schema';
import { db } from '@/lib/db';

export const pauseSchedulesForClient = async (
  clientId: number,
  companyId: number,
): Promise<void> => {
  const now = new Date();
  await db
    .update(clientServiceSchedule)
    .set({ paused_at: now, updated_at: now })
    .where(
      and(
        eq(clientServiceSchedule.company_id, companyId),
        eq(clientServiceSchedule.client_id, clientId),
        isNull(clientServiceSchedule.deleted_at),
        isNull(clientServiceSchedule.paused_at),
      ),
    );
};

export const pauseSchedulesForService = async (
  serviceId: number,
  companyId: number,
): Promise<void> => {
  const now = new Date();
  await db
    .update(clientServiceSchedule)
    .set({ paused_at: now, updated_at: now })
    .where(
      and(
        eq(clientServiceSchedule.company_id, companyId),
        eq(clientServiceSchedule.service_id, serviceId),
        isNull(clientServiceSchedule.deleted_at),
        isNull(clientServiceSchedule.paused_at),
      ),
    );
};
