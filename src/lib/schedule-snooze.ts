/**
 * Schedule snooze — defer next_due_at by N calendar days or to a date.
 */

import { addDays } from 'date-fns';
import { companyDay, parseCompanyDayIso } from '@/lib/company-day';

export const DEFAULT_SCHEDULE_SNOOZE_DAYS = 7;

/** Posponer offers these (ZIG-I30); any other day count is rejected. */
export const SCHEDULE_SNOOZE_DAY_OPTIONS = [7, 14, 30] as const;

export const isScheduleSnoozeDays = (value: number): boolean =>
  (SCHEDULE_SNOOZE_DAY_OPTIONS as readonly number[]).includes(value);

/**
 * Snooze from the later of the company's today and the current due day, so
 * overdue items move forward from today. The result is 12:00 UTC of the civil
 * day, which reads as that day in Mexico City too.
 */
export const computeSnoozedNextDueAt = (
  currentNextDueAt: Date,
  days: number = DEFAULT_SCHEDULE_SNOOZE_DAYS,
  now: Date = new Date(),
): Date => {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : DEFAULT_SCHEDULE_SNOOZE_DAYS;
  const dueDay = companyDay(currentNextDueAt).date;
  const today = companyDay(now).date;
  const base = dueDay.getTime() > today.getTime() ? dueDay : today;
  return addDays(base, safeDays);
};

/** Posponer: one of the day options, or a `YYYY-MM-DD` civil day. */
export type ScheduleSnoozeInput = { days: number } | { until: string };

/**
 * The new next_due_at for a snooze, or null when the input is not allowed:
 * a day count outside 7 / 14 / 30, or a date that is not valid or already past
 * (today is allowed).
 */
export const resolveScheduleSnoozeTarget = (
  input: ScheduleSnoozeInput,
  currentNextDueAt: Date,
  now: Date = new Date(),
): Date | null => {
  if ('until' in input) {
    const until = parseCompanyDayIso(input.until);
    if (!until || input.until < companyDay(now).iso) {
      return null;
    }
    return until;
  }
  if (!isScheduleSnoozeDays(input.days)) {
    return null;
  }
  return computeSnoozedNextDueAt(currentNextDueAt, input.days, now);
};
