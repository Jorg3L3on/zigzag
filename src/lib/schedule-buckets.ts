import { addDays } from 'date-fns';
import { companyDay } from '@/lib/company-day';

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
