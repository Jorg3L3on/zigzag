/**
 * Schedule snooze — defer next_due_at by N calendar days.
 */

import { addDays, startOfDay } from 'date-fns';

export const DEFAULT_SCHEDULE_SNOOZE_DAYS = 7;

export const computeSnoozedNextDueAt = (
  currentNextDueAt: Date,
  days: number = DEFAULT_SCHEDULE_SNOOZE_DAYS,
  now: Date = new Date(),
): Date => {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : DEFAULT_SCHEDULE_SNOOZE_DAYS;
  // Snooze from the later of "today" and current due, so overdue items move forward from today.
  const base =
    startOfDay(currentNextDueAt).getTime() > startOfDay(now).getTime()
      ? startOfDay(currentNextDueAt)
      : startOfDay(now);
  return addDays(base, safeDays);
};
