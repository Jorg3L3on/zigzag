import { addDays, differenceInCalendarDays } from 'date-fns';
import { companyDay, companyDayStart } from '@/lib/company-day';

export const DUE_SOON_DAYS = 14;

export const SCHEDULE_FILTER_BUCKETS = [
  'proximos',
  'atrasados',
  'programados',
  'pausados',
  'todos',
] as const;

export type ScheduleFilterBucket = (typeof SCHEDULE_FILTER_BUCKETS)[number];

export type ScheduleDisplayBucket = Exclude<ScheduleFilterBucket, 'todos'>;

export const isScheduleFilterBucket = (
  value: string,
): value is ScheduleFilterBucket =>
  SCHEDULE_FILTER_BUCKETS.includes(value as ScheduleFilterBucket);

export const classifyScheduleBucket = (
  nextDueAt: Date,
  pausedAt: Date | null,
  today: Date = new Date(),
): ScheduleDisplayBucket => {
  if (pausedAt) {
    return 'pausados';
  }

  const dayStart = companyDay(today).date.getTime();
  const dueDay = companyDay(nextDueAt).date.getTime();
  const soonEnd = addDays(companyDay(today).date, DUE_SOON_DAYS).getTime();

  if (dueDay < dayStart) {
    return 'atrasados';
  }

  if (dueDay <= soonEnd) {
    return 'proximos';
  }

  return 'programados';
};

export const matchesScheduleFilter = (
  filter: ScheduleFilterBucket,
  nextDueAt: Date,
  pausedAt: Date | null,
  today: Date = new Date(),
): boolean => {
  if (filter === 'todos') {
    return true;
  }

  const bucket = classifyScheduleBucket(nextDueAt, pausedAt, today);
  return bucket === filter;
};

/**
 * Agenda views (ZIG-I30). `por-atender` = atrasados + próximos and is the
 * default; `atrasados` / `proximos` narrow it (Hoy links `?filter=` to them).
 */
export const SCHEDULE_AGENDA_VIEWS = [
  'por-atender',
  'atrasados',
  'proximos',
  'programados',
  'pausados',
  'todos',
] as const;

export type ScheduleAgendaView = (typeof SCHEDULE_AGENDA_VIEWS)[number];

export const DEFAULT_SCHEDULE_AGENDA_VIEW: ScheduleAgendaView = 'por-atender';

export const isScheduleAgendaView = (
  value: string,
): value is ScheduleAgendaView =>
  SCHEDULE_AGENDA_VIEWS.includes(value as ScheduleAgendaView);

/**
 * Instants that split active schedules into buckets, the same cut as
 * `classifyScheduleBucket`: before `todayStart` is atrasado, before `soonEnd`
 * (exclusive, the start of day today + DUE_SOON_DAYS + 1) is próximo, the rest
 * programado. SQL compares `next_due_at` against them.
 */
export type ScheduleBucketBounds = {
  todayStart: Date;
  soonEnd: Date;
};

export const scheduleBucketBounds = (
  today: Date = new Date(),
): ScheduleBucketBounds => {
  const day = companyDay(today).date;
  return {
    todayStart: companyDayStart(day),
    soonEnd: companyDayStart(addDays(day, DUE_SOON_DAYS + 1)),
  };
};

export const classifyScheduleBucketByBounds = (
  nextDueAt: Date,
  pausedAt: Date | null,
  bounds: ScheduleBucketBounds,
): ScheduleDisplayBucket => {
  if (pausedAt) {
    return 'pausados';
  }
  if (nextDueAt.getTime() < bounds.todayStart.getTime()) {
    return 'atrasados';
  }
  if (nextDueAt.getTime() < bounds.soonEnd.getTime()) {
    return 'proximos';
  }
  return 'programados';
};

/** Calendar days from the company's today to `date` (negative when past). */
export const companyDaysFromToday = (
  date: Date,
  today: Date = new Date(),
): number =>
  differenceInCalendarDays(companyDay(date).date, companyDay(today).date);

/** Agenda order: most overdue first (default), client A–Z, oldest last service first. */
export const SCHEDULE_AGENDA_SORTS = ['proximo', 'cliente', 'ultimo'] as const;

export type ScheduleAgendaSort = (typeof SCHEDULE_AGENDA_SORTS)[number];

export const DEFAULT_SCHEDULE_AGENDA_SORT: ScheduleAgendaSort = 'proximo';

export const isScheduleAgendaSort = (
  value: string,
): value is ScheduleAgendaSort =>
  SCHEDULE_AGENDA_SORTS.includes(value as ScheduleAgendaSort);
