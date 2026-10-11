import { formatLongDate } from '@/lib/format-long-date';

describe('formatLongDate', () => {
  it('formats an ISO date in Spanish', () => {
    expect(formatLongDate('2026-10-08T12:00:00.000Z')).toBe('8 de octubre 2026');
  });

  it('returns null for missing or invalid values', () => {
    expect(formatLongDate(null)).toBeNull();
    expect(formatLongDate('not a date')).toBeNull();
  });
});
