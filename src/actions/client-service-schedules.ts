'use server';

import { and, asc, eq, isNull } from 'drizzle-orm';
import {
  client,
  clientServiceSchedule,
  service,
  type ClientServiceScheduleRow,
} from '@/db/schema';
import { db } from '@/lib/db';
import {
  AuthorizationError,
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  classifyScheduleBucket,
  isScheduleFilterBucket,
  matchesScheduleFilter,
  type ScheduleDisplayBucket,
  type ScheduleFilterBucket,
} from '@/lib/schedule-buckets';
import {
  computeNextDueAt,
  isScheduleIntervalUnit,
  type ScheduleIntervalUnit,
} from '@/lib/schedule-date';
import {
  SERVICE_SCHEDULES_READ_PERMISSION,
  SERVICE_SCHEDULES_WRITE_PERMISSIONS,
} from '@/lib/service-schedules-rbac';
import { requireActionPermission } from '@/lib/security';
import { revalidatePath } from 'next/cache';

export type ClientServiceScheduleListItem = {
  id: number;
  clientId: number;
  clientName: string;
  serviceId: number;
  serviceName: string;
  intervalValue: number;
  intervalUnit: ScheduleIntervalUnit;
  lastServiceAt: string | null;
  nextDueAt: string;
  pausedAt: string | null;
  pauseReason: string | null;
  bucket: ScheduleDisplayBucket;
};

export type UpsertClientServiceScheduleInput = {
  clientId: number;
  serviceId: number;
  intervalValue: number;
  intervalUnit: ScheduleIntervalUnit;
  lastServiceAt: Date;
  companyId?: number | null;
};

const SCHEDULE_PATHS = [
  '/dashboard/service-schedules',
  '/dashboard',
] as const;

const revalidateSchedulePaths = () => {
  for (const path of SCHEDULE_PATHS) {
    revalidatePath(path);
  }
};

const requireScheduleWrite = async (
  companyId?: number | null,
): Promise<{ companyId: number }> => {
  const [primaryWritePermission, fallbackWritePermission] =
    SERVICE_SCHEDULES_WRITE_PERMISSIONS;

  try {
    return await requireActionPermission(
      primaryWritePermission,
      companyId ?? undefined,
    );
  } catch (error) {
    if (!(error instanceof AuthorizationError)) {
      throw error;
    }
    return await requireActionPermission(
      fallbackWritePermission,
      companyId ?? undefined,
    );
  }
};

const toIso = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

const mapRowToListItem = (
  row: ClientServiceScheduleRow & {
    client: { name: string };
    service: { name: string };
  },
): ClientServiceScheduleListItem => ({
  id: row.id,
  clientId: row.client_id,
  clientName: row.client.name,
  serviceId: row.service_id,
  serviceName: row.service.name,
  intervalValue: row.interval_value,
  intervalUnit: row.interval_unit as ScheduleIntervalUnit,
  lastServiceAt: toIso(row.last_service_at),
  nextDueAt: row.next_due_at.toISOString(),
  pausedAt: toIso(row.paused_at),
  pauseReason: row.pause_reason,
  bucket: classifyScheduleBucket(row.next_due_at, row.paused_at),
});

const assertCatalogRefs = async (
  companyId: number,
  clientId: number,
  serviceId: number,
): Promise<
  | { success: false; error?: string; errorType?: ActionErrorType }
  | { success: true }
> => {
  const clientRow = await db.query.client.findFirst({
    where: and(
      eq(client.id, clientId),
      eq(client.company_id, companyId),
      isNull(client.deleted_at),
    ),
  });

  if (!clientRow) {
    return buildActionError('CL001');
  }

  const serviceRow = await db.query.service.findFirst({
    where: and(
      eq(service.id, serviceId),
      eq(service.company_id, companyId),
      isNull(service.deleted_at),
    ),
  });

  if (!serviceRow) {
    return buildActionError('SV001');
  }

  return { success: true };
};

export async function listClientServiceSchedulesForClient(
  clientId: number,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ClientServiceScheduleListItem[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireActionPermission(
      SERVICE_SCHEDULES_READ_PERMISSION,
      companyId ?? undefined,
    );

    const rows = await db.query.clientServiceSchedule.findMany({
      where: and(
        eq(clientServiceSchedule.company_id, effectiveCompanyId),
        eq(clientServiceSchedule.client_id, clientId),
        isNull(clientServiceSchedule.deleted_at),
      ),
      with: {
        client: true,
        service: true,
      },
      orderBy: [asc(clientServiceSchedule.next_due_at)],
    });

    const items = rows
      .filter(
        (row) => row.client.deleted_at === null && row.service.deleted_at === null,
      )
      .map(mapRowToListItem);

    return { success: true, data: items };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.listForClient',
      'CL001',
      error,
    );
  }
}

export async function listClientServiceSchedules(params: {
  companyId?: number | null;
  filter?: string;
}): Promise<{
  success: boolean;
  data?: ClientServiceScheduleListItem[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireActionPermission(
      SERVICE_SCHEDULES_READ_PERMISSION,
      params.companyId ?? undefined,
    );

    const filter: ScheduleFilterBucket =
      params.filter && isScheduleFilterBucket(params.filter)
        ? params.filter
        : 'todos';

    const rows = await db.query.clientServiceSchedule.findMany({
      where: and(
        eq(clientServiceSchedule.company_id, effectiveCompanyId),
        isNull(clientServiceSchedule.deleted_at),
      ),
      with: {
        client: true,
        service: true,
      },
      orderBy: [asc(clientServiceSchedule.next_due_at)],
    });

    const items = rows
      .filter(
        (row) =>
          row.client.deleted_at === null &&
          row.service.deleted_at === null &&
          matchesScheduleFilter(
            filter,
            row.next_due_at,
            row.paused_at,
          ),
      )
      .map(mapRowToListItem);

    return { success: true, data: items };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.list',
      'CL001',
      error,
    );
  }
}

export async function upsertClientServiceSchedule(
  input: UpsertClientServiceScheduleInput,
): Promise<{
  success: boolean;
  data?: ClientServiceScheduleRow;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleWrite(
      input.companyId,
    );

    if (!isScheduleIntervalUnit(input.intervalUnit)) {
      return buildActionError('CL004', undefined, 'validation');
    }

    const catalog = await assertCatalogRefs(
      effectiveCompanyId,
      input.clientId,
      input.serviceId,
    );
    if (!catalog.success) {
      return catalog;
    }

    const nextDueAt = computeNextDueAt(
      input.lastServiceAt,
      input.intervalValue,
      input.intervalUnit,
    );

    const now = new Date();

    const existing = await db.query.clientServiceSchedule.findFirst({
      where: and(
        eq(clientServiceSchedule.company_id, effectiveCompanyId),
        eq(clientServiceSchedule.client_id, input.clientId),
        eq(clientServiceSchedule.service_id, input.serviceId),
        isNull(clientServiceSchedule.deleted_at),
      ),
    });

    let row: ClientServiceScheduleRow | undefined;

    if (existing) {
      [row] = await db
        .update(clientServiceSchedule)
        .set({
          interval_value: input.intervalValue,
          interval_unit: input.intervalUnit,
          last_service_at: input.lastServiceAt,
          next_due_at: nextDueAt,
          paused_at: null,
          pause_reason: null,
          updated_at: now,
        })
        .where(eq(clientServiceSchedule.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(clientServiceSchedule)
        .values({
          company_id: effectiveCompanyId,
          client_id: input.clientId,
          service_id: input.serviceId,
          interval_value: input.intervalValue,
          interval_unit: input.intervalUnit,
          last_service_at: input.lastServiceAt,
          next_due_at: nextDueAt,
        })
        .returning();
    }

    revalidateSchedulePaths();
    return { success: true, data: row };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.upsert',
      'CL004',
      error,
    );
  }
}

export async function pauseClientServiceSchedule(
  id: number,
  pauseReason?: string | null,
  companyId?: number | null,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleWrite(
      companyId,
    );
    const now = new Date();

    const result = await db
      .update(clientServiceSchedule)
      .set({
        paused_at: now,
        pause_reason: pauseReason?.trim() || null,
        updated_at: now,
      })
      .where(
        and(
          eq(clientServiceSchedule.id, id),
          eq(clientServiceSchedule.company_id, effectiveCompanyId),
          isNull(clientServiceSchedule.deleted_at),
        ),
      )
      .returning({ id: clientServiceSchedule.id });

    if (!result.length) {
      return buildActionError('CL001');
    }

    revalidateSchedulePaths();
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.pause',
      'CL004',
      error,
    );
  }
}

export async function resumeClientServiceSchedule(
  id: number,
  companyId?: number | null,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleWrite(
      companyId,
    );
    const now = new Date();

    const result = await db
      .update(clientServiceSchedule)
      .set({
        paused_at: null,
        pause_reason: null,
        updated_at: now,
      })
      .where(
        and(
          eq(clientServiceSchedule.id, id),
          eq(clientServiceSchedule.company_id, effectiveCompanyId),
          isNull(clientServiceSchedule.deleted_at),
        ),
      )
      .returning({ id: clientServiceSchedule.id });

    if (!result.length) {
      return buildActionError('CL001');
    }

    revalidateSchedulePaths();
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.resume',
      'CL004',
      error,
    );
  }
}

export async function deleteClientServiceSchedule(
  id: number,
  companyId?: number | null,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleWrite(
      companyId,
    );
    const now = new Date();

    const result = await db
      .update(clientServiceSchedule)
      .set({
        deleted_at: now,
        updated_at: now,
      })
      .where(
        and(
          eq(clientServiceSchedule.id, id),
          eq(clientServiceSchedule.company_id, effectiveCompanyId),
          isNull(clientServiceSchedule.deleted_at),
        ),
      )
      .returning({ id: clientServiceSchedule.id });

    if (!result.length) {
      return buildActionError('CL001');
    }

    revalidateSchedulePaths();
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.delete',
      'CL005',
      error,
    );
  }
}
