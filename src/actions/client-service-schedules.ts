'use server';

import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  not,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  client,
  clientServiceSchedule,
  service,
  servicesTickets,
  ticket,
  type ClientServiceScheduleRow,
  type Service,
} from '@/db/schema';
import { companyDay, parseCompanyDayIso } from '@/lib/company-day';
import { formatDocumentFolio } from '@/lib/folio';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  classifyScheduleBucket,
  classifyScheduleBucketByBounds,
  companyDaysFromToday,
  DEFAULT_SCHEDULE_AGENDA_SORT,
  DEFAULT_SCHEDULE_AGENDA_VIEW,
  isScheduleAgendaSort,
  isScheduleAgendaView,
  isScheduleFilterBucket,
  matchesScheduleFilter,
  scheduleBucketBounds,
  type ScheduleAgendaView,
  type ScheduleBucketBounds,
  type ScheduleDisplayBucket,
  type ScheduleFilterBucket,
} from '@/lib/schedule-buckets';
import {
  computeNextDueAt,
  isScheduleIntervalUnit,
  type ScheduleIntervalUnit,
} from '@/lib/schedule-date';
import {
  DEFAULT_SCHEDULE_SNOOZE_DAYS,
  resolveScheduleSnoozeTarget,
  type ScheduleSnoozeInput,
} from '@/lib/schedule-snooze';
import {
  requireScheduleRead,
  requireScheduleWrite,
} from '@/lib/service-schedules-rbac-server';
import { revalidatePath } from 'next/cache';

export type ClientServiceScheduleListItem = {
  id: number;
  clientId: number;
  clientName: string;
  clientPhone: string | null;
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

export type ServiceScheduleFormCatalogClient = {
  id: number;
  name: string;
};

export type ServiceScheduleFormCatalog = {
  clients: ServiceScheduleFormCatalogClient[];
  services: Service[];
};

/** An agenda row: the list item plus the relative days the table shows (ZIG-I30). */
export type ClientServiceScheduleAgendaItem = ClientServiceScheduleListItem & {
  /** Company calendar days until next_due_at; negative when overdue. */
  daysUntilDue: number;
  /** Company calendar days since last_service_at; null without one. */
  daysSinceLast: number | null;
};

/** Rows per agenda view under the current search and service filter. */
export type ClientServiceScheduleAgendaCounts = Record<ScheduleAgendaView, number>;

export type PaginatedClientServiceSchedulesData = {
  items: ClientServiceScheduleAgendaItem[];
  counts: ClientServiceScheduleAgendaCounts;
  view: ScheduleAgendaView;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** The dates of one schedule, before or after a change; Deshacer sends them back. */
export type ClientServiceScheduleDates = {
  id: number;
  lastServiceAt: string | null;
  nextDueAt: string;
};

export type ClientServiceScheduleDatesChange = {
  applied: ClientServiceScheduleDates;
  previous: ClientServiceScheduleDates;
};

export type BulkClientServiceSchedulesAction = 'snooze' | 'pause' | 'delete';

export type BulkClientServiceSchedulesInput = {
  ids: number[];
  action: BulkClientServiceSchedulesAction;
  snooze?: ScheduleSnoozeInput;
  pauseReason?: string | null;
  companyId?: number | null;
};

export type BulkClientServiceSchedulesResult = {
  /** Ids the action changed: Posponer skips paused rows, Pausar skips paused ones. */
  appliedIds: number[];
  /** Dates before a snooze, for Deshacer; empty for pause and delete. */
  previous: ClientServiceScheduleDates[];
};

export type ClientServiceScheduleHistoryTicket = {
  id: string;
  folio: string;
  date: string | null;
  total: number;
  paid: number;
  finished: boolean;
};

export type ClientServiceScheduleHistory = {
  schedule: ClientServiceScheduleAgendaItem & {
    clientCity: string | null;
    createdAt: string;
  };
  /** The client's tickets with a line of this service, newest first (10 at most). */
  serviceTickets: ClientServiceScheduleHistoryTicket[];
  serviceTicketCount: number;
  /** The client's other tickets, newest first (3 at most). */
  otherTickets: ClientServiceScheduleHistoryTicket[];
  otherTicketCount: number;
  /** The finished ticket that likely created the schedule (same day as created_at). */
  originTicket: { id: string; folio: string } | null;
};

/** One call changes at most this many schedules. */
const BULK_SCHEDULE_LIMIT = 50;

const SCHEDULE_PATHS = [
  '/service-schedules',
  '/dashboard',
] as const;

const revalidateSchedulePaths = () => {
  for (const path of SCHEDULE_PATHS) {
    revalidatePath(path);
  }
};

const toIso = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

const mapRowToListItem = (
  row: ClientServiceScheduleRow & {
    client: { name: string; phone: string | null };
    service: { name: string };
  },
): ClientServiceScheduleListItem => ({
  id: row.id,
  clientId: row.client_id,
  clientName: row.client.name,
  clientPhone: row.client.phone,
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

const toAgendaItem = (
  item: ClientServiceScheduleListItem,
  now: Date,
): ClientServiceScheduleAgendaItem => ({
  ...item,
  daysUntilDue: companyDaysFromToday(new Date(item.nextDueAt), now),
  daysSinceLast: item.lastServiceAt
    ? companyDaysFromToday(now, new Date(item.lastServiceAt))
    : null,
});

const escapeLike = (value: string): string => value.replace(/[%_\\]/g, '\\$&');

/** SQL for each agenda view, the same cut as classifyScheduleBucket. */
const buildAgendaViewConditions = (
  bounds: ScheduleBucketBounds,
): Record<ScheduleAgendaView, SQL | undefined> => {
  const active = isNull(clientServiceSchedule.paused_at);
  return {
    'por-atender': and(active, lt(clientServiceSchedule.next_due_at, bounds.soonEnd)),
    atrasados: and(active, lt(clientServiceSchedule.next_due_at, bounds.todayStart)),
    proximos: and(
      active,
      gte(clientServiceSchedule.next_due_at, bounds.todayStart),
      lt(clientServiceSchedule.next_due_at, bounds.soonEnd),
    ),
    programados: and(active, gte(clientServiceSchedule.next_due_at, bounds.soonEnd)),
    pausados: isNotNull(clientServiceSchedule.paused_at),
    todos: undefined,
  };
};

const countWhere = (condition: SQL | undefined) =>
  (condition
    ? sql<number>`count(*) filter (where ${condition})`
    : sql<number>`count(*)`
  ).mapWith(Number);

const agendaRowFields = {
  id: clientServiceSchedule.id,
  clientId: clientServiceSchedule.client_id,
  clientName: client.name,
  clientPhone: client.phone,
  serviceId: clientServiceSchedule.service_id,
  serviceName: service.name,
  intervalValue: clientServiceSchedule.interval_value,
  intervalUnit: clientServiceSchedule.interval_unit,
  lastServiceAt: clientServiceSchedule.last_service_at,
  nextDueAt: clientServiceSchedule.next_due_at,
  pausedAt: clientServiceSchedule.paused_at,
  pauseReason: clientServiceSchedule.pause_reason,
};

type AgendaRow = {
  id: number;
  clientId: number;
  clientName: string;
  clientPhone: string | null;
  serviceId: number;
  serviceName: string;
  intervalValue: number;
  intervalUnit: string;
  lastServiceAt: Date | null;
  nextDueAt: Date;
  pausedAt: Date | null;
  pauseReason: string | null;
};

const mapAgendaRow = (
  row: AgendaRow,
  bounds: ScheduleBucketBounds,
  now: Date,
): ClientServiceScheduleAgendaItem =>
  toAgendaItem(
    {
      id: row.id,
      clientId: row.clientId,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      intervalValue: row.intervalValue,
      intervalUnit: row.intervalUnit as ScheduleIntervalUnit,
      lastServiceAt: toIso(row.lastServiceAt),
      nextDueAt: row.nextDueAt.toISOString(),
      pausedAt: toIso(row.pausedAt),
      pauseReason: row.pauseReason,
      bucket: classifyScheduleBucketByBounds(row.nextDueAt, row.pausedAt, bounds),
    },
    now,
  );

const datesOf = (row: {
  id: number;
  last_service_at: Date | null;
  next_due_at: Date;
}): ClientServiceScheduleDates => ({
  id: row.id,
  lastServiceAt: toIso(row.last_service_at),
  nextDueAt: row.next_due_at.toISOString(),
});

/** Distinct positive integer ids, 1 to BULK_SCHEDULE_LIMIT of them, or null. */
const normalizeBulkIds = (ids: unknown): number[] | null => {
  if (!Array.isArray(ids)) {
    return null;
  }
  const unique = [...new Set(ids)];
  if (
    unique.length < 1 ||
    unique.length > BULK_SCHEDULE_LIMIT ||
    !unique.every((id) => Number.isInteger(id) && (id as number) > 0)
  ) {
    return null;
  }
  return unique as number[];
};

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
    const { companyId: effectiveCompanyId } = await requireScheduleRead(companyId);

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
    const { companyId: effectiveCompanyId } = await requireScheduleRead(
      params.companyId,
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

export async function listServiceScheduleFormCatalog(
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ServiceScheduleFormCatalog;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleWrite(
      companyId,
    );

    const [clientRows, serviceRows] = await Promise.all([
      db.query.client.findMany({
        where: and(
          eq(client.company_id, effectiveCompanyId),
          isNull(client.deleted_at),
        ),
        columns: {
          id: true,
          name: true,
        },
        orderBy: [asc(client.name)],
      }),
      db.query.service.findMany({
        where: and(
          eq(service.company_id, effectiveCompanyId),
          isNull(service.deleted_at),
        ),
        orderBy: [asc(service.name)],
      }),
    ]);

    return {
      success: true,
      data: {
        clients: clientRows,
        services: serviceRows,
      },
    };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.formCatalog',
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

export async function snoozeClientServiceSchedule(
  id: number,
  input: ScheduleSnoozeInput = { days: DEFAULT_SCHEDULE_SNOOZE_DAYS },
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: { nextDueAt: string; previousNextDueAt: string };
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleWrite(
      companyId,
    );
    const now = new Date();

    const existing = await db.query.clientServiceSchedule.findFirst({
      where: and(
        eq(clientServiceSchedule.id, id),
        eq(clientServiceSchedule.company_id, effectiveCompanyId),
        isNull(clientServiceSchedule.deleted_at),
      ),
    });
    if (!existing) {
      return buildActionError('SS001');
    }
    if (existing.paused_at) {
      return buildActionError('SS003');
    }

    const nextDueAt = resolveScheduleSnoozeTarget(input, existing.next_due_at, now);
    if (!nextDueAt) {
      return buildActionError('SS002');
    }

    const result = await db
      .update(clientServiceSchedule)
      .set({
        next_due_at: nextDueAt,
        updated_at: now,
      })
      .where(
        and(
          eq(clientServiceSchedule.id, id),
          eq(clientServiceSchedule.company_id, effectiveCompanyId),
          isNull(clientServiceSchedule.deleted_at),
          isNull(clientServiceSchedule.paused_at),
        ),
      )
      .returning({ id: clientServiceSchedule.id });

    if (!result.length) {
      return buildActionError('SS001');
    }

    revalidateSchedulePaths();
    return {
      success: true,
      data: {
        nextDueAt: nextDueAt.toISOString(),
        previousNextDueAt: existing.next_due_at.toISOString(),
      },
    };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.snooze',
      'SS005',
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

/**
 * The agenda (ZIG-I30): one page of a view plus the count of every view, all
 * under the same search (client or service name) and service filter. Buckets
 * are computed in SQL with the company-day cut of classifyScheduleBucket.
 */
export async function listClientServiceSchedulesPaginated(params: {
  companyId?: number | null;
  view?: string;
  search?: string;
  serviceId?: number | null;
  sort?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  success: boolean;
  data?: PaginatedClientServiceSchedulesData;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleRead(
      params.companyId,
    );

    const view =
      params.view && isScheduleAgendaView(params.view)
        ? params.view
        : DEFAULT_SCHEDULE_AGENDA_VIEW;
    const sort =
      params.sort && isScheduleAgendaSort(params.sort)
        ? params.sort
        : DEFAULT_SCHEDULE_AGENDA_SORT;
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 25)));
    const search = params.search?.trim();
    const serviceId =
      params.serviceId && Number.isInteger(params.serviceId) && params.serviceId > 0
        ? params.serviceId
        : null;

    const now = new Date();
    const bounds = scheduleBucketBounds(now);
    const viewConditions = buildAgendaViewConditions(bounds);

    const baseWhere = and(
      eq(clientServiceSchedule.company_id, effectiveCompanyId),
      isNull(clientServiceSchedule.deleted_at),
      isNull(client.deleted_at),
      isNull(service.deleted_at),
      ...(serviceId ? [eq(clientServiceSchedule.service_id, serviceId)] : []),
      ...(search
        ? [
            or(
              ilike(client.name, `%${escapeLike(search)}%`),
              ilike(service.name, `%${escapeLike(search)}%`),
            ),
          ]
        : []),
    );

    const [countRow] = await db
      .select({
        'por-atender': countWhere(viewConditions['por-atender']),
        atrasados: countWhere(viewConditions.atrasados),
        proximos: countWhere(viewConditions.proximos),
        programados: countWhere(viewConditions.programados),
        pausados: countWhere(viewConditions.pausados),
        todos: countWhere(viewConditions.todos),
      })
      .from(clientServiceSchedule)
      .innerJoin(client, eq(client.id, clientServiceSchedule.client_id))
      .innerJoin(service, eq(service.id, clientServiceSchedule.service_id))
      .where(baseWhere);

    const counts: ClientServiceScheduleAgendaCounts = {
      'por-atender': Number(countRow?.['por-atender'] ?? 0),
      atrasados: Number(countRow?.atrasados ?? 0),
      proximos: Number(countRow?.proximos ?? 0),
      programados: Number(countRow?.programados ?? 0),
      pausados: Number(countRow?.pausados ?? 0),
      todos: Number(countRow?.todos ?? 0),
    };
    const total = counts[view];

    const orderBy =
      sort === 'cliente'
        ? [asc(client.name), asc(clientServiceSchedule.next_due_at), asc(clientServiceSchedule.id)]
        : sort === 'ultimo'
          ? [
              sql`${clientServiceSchedule.last_service_at} asc nulls last`,
              asc(clientServiceSchedule.id),
            ]
          : [asc(clientServiceSchedule.next_due_at), asc(clientServiceSchedule.id)];

    const viewCondition = viewConditions[view];
    const rows = await db
      .select(agendaRowFields)
      .from(clientServiceSchedule)
      .innerJoin(client, eq(client.id, clientServiceSchedule.client_id))
      .innerJoin(service, eq(service.id, clientServiceSchedule.service_id))
      .where(viewCondition ? and(baseWhere, viewCondition) : baseWhere)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      success: true,
      data: {
        items: rows.map((row) => mapAgendaRow(row, bounds, now)),
        counts,
        view,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.paginated',
      'CL001',
      error,
    );
  }
}

/**
 * Marcar como hecho (ZIG-I30): the service was done on `doneOn` (YYYY-MM-DD,
 * from the last service to today) without a ticket. Sets last_service_at and
 * reschedules next_due_at by the interval. Paused schedules are rejected.
 */
export async function markClientServiceScheduleDone(
  id: number,
  doneOn: string,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ClientServiceScheduleDatesChange;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleWrite(
      companyId,
    );

    const existing = await db.query.clientServiceSchedule.findFirst({
      where: and(
        eq(clientServiceSchedule.id, id),
        eq(clientServiceSchedule.company_id, effectiveCompanyId),
        isNull(clientServiceSchedule.deleted_at),
      ),
    });
    if (!existing) {
      return buildActionError('SS001');
    }
    if (existing.paused_at) {
      return buildActionError('SS003');
    }

    const now = new Date();
    const doneAt = parseCompanyDayIso(doneOn);
    if (
      !doneAt ||
      doneOn > companyDay(now).iso ||
      (existing.last_service_at && doneOn < companyDay(existing.last_service_at).iso)
    ) {
      return buildActionError('SS002');
    }
    if (!isScheduleIntervalUnit(existing.interval_unit)) {
      return buildActionError('SS005');
    }

    const nextDueAt = computeNextDueAt(
      doneAt,
      existing.interval_value,
      existing.interval_unit,
    );

    const result = await db
      .update(clientServiceSchedule)
      .set({
        last_service_at: doneAt,
        next_due_at: nextDueAt,
        updated_at: now,
      })
      .where(
        and(
          eq(clientServiceSchedule.id, id),
          eq(clientServiceSchedule.company_id, effectiveCompanyId),
          isNull(clientServiceSchedule.deleted_at),
          isNull(clientServiceSchedule.paused_at),
        ),
      )
      .returning({ id: clientServiceSchedule.id });

    if (!result.length) {
      return buildActionError('SS001');
    }

    revalidateSchedulePaths();
    return {
      success: true,
      data: {
        applied: { id, lastServiceAt: doneAt.toISOString(), nextDueAt: nextDueAt.toISOString() },
        previous: datesOf(existing),
      },
    };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.markDone',
      'SS005',
      error,
    );
  }
}

/**
 * Selección múltiple (ZIG-I30): snooze, pause or delete up to 50 schedules.
 * Every id must belong to the company, or nothing is applied.
 */
export async function bulkClientServiceSchedules(
  input: BulkClientServiceSchedulesInput,
): Promise<{
  success: boolean;
  data?: BulkClientServiceSchedulesResult;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleWrite(
      input.companyId,
    );

    const ids = normalizeBulkIds(input.ids);
    if (!ids || !['snooze', 'pause', 'delete'].includes(input.action)) {
      return buildActionError('SS004');
    }
    const now = new Date();
    if (input.action === 'snooze') {
      // Validate the option once, before touching rows (a past date fails for all).
      if (!input.snooze || !resolveScheduleSnoozeTarget(input.snooze, now, now)) {
        return buildActionError('SS002');
      }
    }

    const outcome = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: clientServiceSchedule.id,
          last_service_at: clientServiceSchedule.last_service_at,
          next_due_at: clientServiceSchedule.next_due_at,
          paused_at: clientServiceSchedule.paused_at,
        })
        .from(clientServiceSchedule)
        .where(
          and(
            inArray(clientServiceSchedule.id, ids),
            eq(clientServiceSchedule.company_id, effectiveCompanyId),
            isNull(clientServiceSchedule.deleted_at),
          ),
        );

      if (rows.length !== ids.length) {
        return null;
      }

      const scoped = and(
        eq(clientServiceSchedule.company_id, effectiveCompanyId),
        isNull(clientServiceSchedule.deleted_at),
      );

      if (input.action === 'delete') {
        await tx
          .update(clientServiceSchedule)
          .set({ deleted_at: now, updated_at: now })
          .where(and(scoped, inArray(clientServiceSchedule.id, ids)));
        return { appliedIds: ids, previous: [] };
      }

      const active = rows.filter((row) => !row.paused_at);
      const activeIds = active.map((row) => row.id);

      if (input.action === 'pause') {
        if (activeIds.length) {
          await tx
            .update(clientServiceSchedule)
            .set({
              paused_at: now,
              pause_reason: input.pauseReason?.trim() || null,
              updated_at: now,
            })
            .where(
              and(
                scoped,
                inArray(clientServiceSchedule.id, activeIds),
                isNull(clientServiceSchedule.paused_at),
              ),
            );
        }
        return { appliedIds: activeIds, previous: [] };
      }

      for (const row of active) {
        const nextDueAt = resolveScheduleSnoozeTarget(input.snooze!, row.next_due_at, now);
        if (!nextDueAt) {
          continue;
        }
        await tx
          .update(clientServiceSchedule)
          .set({ next_due_at: nextDueAt, updated_at: now })
          .where(and(scoped, eq(clientServiceSchedule.id, row.id)));
      }
      return { appliedIds: activeIds, previous: active.map(datesOf) };
    });

    if (!outcome) {
      return buildActionError('SS001');
    }

    revalidateSchedulePaths();
    return { success: true, data: outcome };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.bulk',
      'SS005',
      error,
    );
  }
}

/**
 * Deshacer (ZIG-I30): put back the dates a snooze or Marcar como hecho
 * returned as `previous`. Every id must belong to the company, or nothing is
 * applied.
 */
export async function restoreClientServiceScheduleDates(
  entries: ClientServiceScheduleDates[],
  companyId?: number | null,
): Promise<{ success: boolean; error?: string; errorType?: ActionErrorType }> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleWrite(
      companyId,
    );

    const ids = normalizeBulkIds(entries?.map((entry) => entry.id));
    if (!ids || ids.length !== entries.length) {
      return buildActionError('SS004');
    }
    const parsed = entries.map((entry) => ({
      id: entry.id,
      nextDueAt: new Date(entry.nextDueAt),
      lastServiceAt: entry.lastServiceAt ? new Date(entry.lastServiceAt) : null,
    }));
    if (
      parsed.some(
        (entry) =>
          Number.isNaN(entry.nextDueAt.getTime()) ||
          (entry.lastServiceAt && Number.isNaN(entry.lastServiceAt.getTime())),
      )
    ) {
      return buildActionError('SS002');
    }

    const now = new Date();
    const applied = await db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: clientServiceSchedule.id })
        .from(clientServiceSchedule)
        .where(
          and(
            inArray(clientServiceSchedule.id, ids),
            eq(clientServiceSchedule.company_id, effectiveCompanyId),
            isNull(clientServiceSchedule.deleted_at),
          ),
        );
      if (rows.length !== ids.length) {
        return false;
      }
      for (const entry of parsed) {
        await tx
          .update(clientServiceSchedule)
          .set({
            next_due_at: entry.nextDueAt,
            last_service_at: entry.lastServiceAt,
            updated_at: now,
          })
          .where(
            and(
              eq(clientServiceSchedule.id, entry.id),
              eq(clientServiceSchedule.company_id, effectiveCompanyId),
              isNull(clientServiceSchedule.deleted_at),
            ),
          );
      }
      return true;
    });

    if (!applied) {
      return buildActionError('SS001');
    }

    revalidateSchedulePaths();
    return { success: true };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.restore',
      'SS005',
      error,
    );
  }
}

const historyTicketFields = {
  id: ticket.id,
  folio_number: ticket.folio_number,
  folio_prefix: ticket.folio_prefix,
  ticket_date: ticket.ticket_date,
  created_at: ticket.created_at,
  updated_at: ticket.updated_at,
  total: ticket.total,
  paid: ticket.paid,
  finished: ticket.finished,
  matchCount: sql<number>`count(*) over()`.mapWith(Number),
};

type HistoryTicketRow = {
  id: bigint;
  folio_number: number | null;
  folio_prefix: string | null;
  ticket_date: Date | null;
  created_at: Date;
  updated_at: Date | null;
  total: number | null;
  paid: number | null;
  finished: boolean;
  matchCount: number;
};

const toHistoryTicket = (row: HistoryTicketRow): ClientServiceScheduleHistoryTicket => ({
  id: String(row.id),
  folio: formatDocumentFolio({ ...row, document_kind: 'ticket' }),
  date: toIso(row.ticket_date ?? row.created_at),
  total: Number(row.total ?? 0),
  paid: Number(row.paid ?? 0),
  finished: row.finished,
});

/** A finished ticket of the service touched on the day the schedule was created. */
const findOriginTicket = (
  rows: HistoryTicketRow[],
  scheduleCreatedAt: Date,
): HistoryTicketRow | undefined => {
  const createdDay = companyDay(scheduleCreatedAt).iso;
  return rows.find(
    (row) =>
      row.finished &&
      [row.updated_at, row.ticket_date].some(
        (date) => date && companyDay(date).iso === createdDay,
      ),
  );
};

/**
 * The side panel (ZIG-I30): the schedule, the client's tickets with a line of
 * its service and the client's other tickets, all from the same company.
 */
export async function getClientServiceScheduleHistory(
  id: number,
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: ClientServiceScheduleHistory;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleRead(
      companyId,
    );

    const [row] = await db
      .select({
        ...agendaRowFields,
        clientCity: client.city,
        createdAt: clientServiceSchedule.created_at,
      })
      .from(clientServiceSchedule)
      .innerJoin(client, eq(client.id, clientServiceSchedule.client_id))
      .innerJoin(service, eq(service.id, clientServiceSchedule.service_id))
      .where(
        and(
          eq(clientServiceSchedule.id, id),
          eq(clientServiceSchedule.company_id, effectiveCompanyId),
          isNull(clientServiceSchedule.deleted_at),
          isNull(client.deleted_at),
          isNull(service.deleted_at),
        ),
      )
      .limit(1);

    if (!row) {
      return buildActionError('SS001');
    }

    const clientTickets = and(
      eq(ticket.company_id, effectiveCompanyId),
      eq(ticket.client_id, row.clientId),
      isNull(ticket.deleted_at),
      eq(ticket.document_kind, 'ticket'),
    );
    const hasServiceLine = exists(
      db
        .select({ one: sql`1` })
        .from(servicesTickets)
        .where(
          and(
            eq(servicesTickets.ticket_id, ticket.id),
            eq(servicesTickets.service_id, row.serviceId),
            isNull(servicesTickets.deleted_at),
          ),
        ),
    );
    const newestFirst = [
      sql`coalesce(${ticket.ticket_date}, ${ticket.created_at}) desc`,
      desc(ticket.id),
    ];

    const [serviceRows, otherRows] = await Promise.all([
      db
        .select(historyTicketFields)
        .from(ticket)
        .where(and(clientTickets, hasServiceLine))
        .orderBy(...newestFirst)
        .limit(10),
      db
        .select(historyTicketFields)
        .from(ticket)
        .where(and(clientTickets, not(hasServiceLine)))
        .orderBy(...newestFirst)
        .limit(3),
    ]);

    const now = new Date();
    const origin = findOriginTicket(serviceRows, row.createdAt);

    return {
      success: true,
      data: {
        schedule: {
          ...mapAgendaRow(row, scheduleBucketBounds(now), now),
          clientCity: row.clientCity,
          createdAt: row.createdAt.toISOString(),
        },
        serviceTickets: serviceRows.map(toHistoryTicket),
        serviceTicketCount: serviceRows[0]?.matchCount ?? 0,
        otherTickets: otherRows.map(toHistoryTicket),
        otherTicketCount: otherRows[0]?.matchCount ?? 0,
        originTicket: origin
          ? { id: String(origin.id), folio: toHistoryTicket(origin).folio }
          : null,
      },
    };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.history',
      'SS001',
      error,
    );
  }
}

/**
 * Servicio filter of the agenda (ZIG-I30): the services that have a live
 * schedule in the company, by name. Read permission, unlike the form catalog.
 */
export async function listClientServiceScheduleServiceOptions(
  companyId?: number | null,
): Promise<{
  success: boolean;
  data?: Array<{ id: number; name: string }>;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireScheduleRead(
      companyId,
    );

    const rows = await db
      .selectDistinct({ id: service.id, name: service.name })
      .from(clientServiceSchedule)
      .innerJoin(service, eq(service.id, clientServiceSchedule.service_id))
      .where(
        and(
          eq(clientServiceSchedule.company_id, effectiveCompanyId),
          isNull(clientServiceSchedule.deleted_at),
          isNull(service.deleted_at),
        ),
      )
      .orderBy(asc(service.name), asc(service.id));

    return { success: true, data: rows };
  } catch (error) {
    return handleCodedServerActionError(
      'clientServiceSchedules.serviceOptions',
      'SV001',
      error,
    );
  }
}
