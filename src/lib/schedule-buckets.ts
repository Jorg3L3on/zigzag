import {
  addDays,
  endOfDay,
  isWithinInterval,
  startOfDay,
} from 'date-fns';

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

  const dayStart = startOfDay(today);
  const dueDay = startOfDay(nextDueAt);
  const soonEnd = endOfDay(addDays(dayStart, DUE_SOON_DAYS));

  if (dueDay < dayStart) {
    return 'atrasados';
  }

  if (
    isWithinInterval(dueDay, {
      start: dayStart,
      end: soonEnd,
    })
  ) {
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
