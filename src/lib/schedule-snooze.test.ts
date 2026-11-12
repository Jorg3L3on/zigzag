import { describe, expect, it } from '@jest/globals';
import {
  computeSnoozedNextDueAt,
  resolveScheduleSnoozeTarget,
} from '@/lib/schedule-snooze';

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

  it('moves an overdue item from the company day at 23:30 CDMX, not the UTC day', () => {
    const now = new Date('2026-10-24T23:30:00-06:00');
    const overdue = new Date('2026-10-01T12:00:00.000Z');
    expect(computeSnoozedNextDueAt(overdue, 7, now).toISOString()).toBe(
      '2026-10-31T12:00:00.000Z',
    );
  });
});

describe('resolveScheduleSnoozeTarget (ZIG-I30)', () => {
  const now = new Date('2026-10-25T18:00:00.000Z');
  const overdue = new Date('2026-06-01T12:00:00.000Z');

  it.each([7, 14, 30])('accepts %i days from today when overdue', (days) => {
    const target = resolveScheduleSnoozeTarget({ days }, overdue, now);
    expect(target?.toISOString()).toBe(
      new Date(Date.UTC(2026, 9, 25 + days, 12)).toISOString(),
    );
  });

  it.each([0, 3, 10, 31, -7, 7.5])('rejects %p days', (days) => {
    expect(resolveScheduleSnoozeTarget({ days }, overdue, now)).toBeNull();
  });

  it('accepts a date from today on, as noon UTC of that day', () => {
    expect(resolveScheduleSnoozeTarget({ until: '2026-10-25' }, overdue, now)?.toISOString()).toBe(
      '2026-10-25T12:00:00.000Z',
    );
    expect(resolveScheduleSnoozeTarget({ until: '2027-01-15' }, overdue, now)?.toISOString()).toBe(
      '2027-01-15T12:00:00.000Z',
    );
  });

  it('rejects a past or invalid date', () => {
    expect(resolveScheduleSnoozeTarget({ until: '2026-10-24' }, overdue, now)).toBeNull();
    expect(resolveScheduleSnoozeTarget({ until: '2026-13-01' }, overdue, now)).toBeNull();
    expect(resolveScheduleSnoozeTarget({ until: '' }, overdue, now)).toBeNull();
  });
});
