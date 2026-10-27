import { formatListShortDate } from '@/lib/list-short-date';

describe('formatListShortDate', () => {
  it('formats on the company calendar, with the year only when it differs', () => {
    const now = new Date('2026-10-25T18:00:00.000Z');
    // 23:30 CDMX on 24 Oct is already 25 Oct in UTC.
    expect(formatListShortDate('2026-10-25T05:30:00.000Z', now)).toBe('24 oct');
    expect(formatListShortDate('2025-06-12T12:00:00.000Z', now)).toBe('12 jun 2025');
  });

  it('is empty without a valid date', () => {
    expect(formatListShortDate(null)).toBe('');
    expect(formatListShortDate('not a date')).toBe('');
  });
});
