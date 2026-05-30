import { addDays, addMonths } from 'date-fns';

export const SCHEDULE_INTERVAL_UNITS = ['month', 'day'] as const;
export type ScheduleIntervalUnit = (typeof SCHEDULE_INTERVAL_UNITS)[number];

export const isScheduleIntervalUnit = (
  value: string,
): value is ScheduleIntervalUnit =>
  SCHEDULE_INTERVAL_UNITS.includes(value as ScheduleIntervalUnit);

export const computeNextDueAt = (
  lastServiceAt: Date,
  intervalValue: number,
  intervalUnit: ScheduleIntervalUnit,
): Date => {
  if (!Number.isFinite(intervalValue) || intervalValue < 1) {
    throw new Error('intervalValue must be a positive number');
  }

  if (intervalUnit === 'month') {
    return addMonths(lastServiceAt, intervalValue);
  }

  return addDays(lastServiceAt, intervalValue);
};
