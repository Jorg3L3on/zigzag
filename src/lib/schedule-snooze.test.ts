import { describe, expect, it } from '@jest/globals';
import { computeSnoozedNextDueAt } from '@/lib/schedule-snooze';

describe('schedule-snooze', () => {
  it('adds 7 days from today when overdue', () => {
    const now = new Date('2026-08-12T10:00:00');
    const overdue = new Date('2026-08-01T12:00:00');
    expect(computeSnoozedNextDueAt(overdue, 7, now).toISOString().slice(0, 10)).toBe(
      '2026-08-19',
    );
  });

  it('adds 7 days from current due when still in the future', () => {
    const now = new Date('2026-08-12T10:00:00');
    const future = new Date('2026-08-15T12:00:00');
    expect(computeSnoozedNextDueAt(future, 7, now).toISOString().slice(0, 10)).toBe(
      '2026-08-22',
    );
  });
});
