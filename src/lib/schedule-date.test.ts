import { computeNextDueAt } from '@/lib/schedule-date';

describe('computeNextDueAt', () => {
  it('adds calendar months with end-of-month clamping', () => {
    const last = new Date(2026, 0, 31);
    const next = computeNextDueAt(last, 1, 'month');
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });

  it('adds multiple months', () => {
    const last = new Date(2026, 2, 15);
    const next = computeNextDueAt(last, 2, 'month');
    expect(next).toEqual(new Date(2026, 4, 15));
  });

  it('adds days', () => {
    const last = new Date(2026, 4, 10);
    const next = computeNextDueAt(last, 45, 'day');
    expect(next).toEqual(new Date(2026, 5, 24));
  });

  it('rejects non-positive interval', () => {
    expect(() =>
      computeNextDueAt(new Date(2026, 0, 1), 0, 'month'),
    ).toThrow();
  });
});
