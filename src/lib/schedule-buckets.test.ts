import {
  classifyScheduleBucket,
  classifyScheduleBucketByBounds,
  companyDaysFromToday,
  DUE_SOON_DAYS,
  matchesScheduleFilter,
  scheduleBucketBounds,
} from '@/lib/schedule-buckets';

const today = new Date(2026, 4, 1);

describe('schedule buckets', () => {
  it(`classifies due within ${DUE_SOON_DAYS} days as proximos`, () => {
    expect(
      classifyScheduleBucket(new Date(2026, 4, 10), null, today),
    ).toBe('proximos');
  });

  it('classifies overdue as atrasados', () => {
    expect(
      classifyScheduleBucket(new Date(2026, 3, 30), null, today),
    ).toBe('atrasados');
  });

  it('classifies far future as programados', () => {
    expect(
      classifyScheduleBucket(new Date(2026, 5, 1), null, today),
    ).toBe('programados');
  });

  it('classifies paused schedules as pausados', () => {
    expect(
      classifyScheduleBucket(new Date(2026, 3, 1), new Date(2026, 3, 1), today),
    ).toBe('pausados');
  });

  it('excludes paused from proximos filter', () => {
    expect(
      matchesScheduleFilter(
        'proximos',
        new Date(2026, 4, 5),
        new Date(2026, 4, 1),
        today,
      ),
    ).toBe(false);
  });

  it('includes all non-deleted rows in todos filter', () => {
    expect(
      matchesScheduleFilter('todos', new Date(2026, 8, 1), null, today),
    ).toBe(true);
  });

  it('does not call a same-evening CDMX due date overdue when UTC is the next day (ZIG-25)', () => {
    const evening = new Date('2026-10-23T23:00:00-06:00');
    expect(evening.toISOString().slice(0, 10)).toBe('2026-10-24');
    expect(classifyScheduleBucket(new Date('2026-10-23T23:30:00-06:00'), null, evening)).toBe(
      'proximos',
    );
    expect(classifyScheduleBucket(new Date('2026-10-22T12:00:00-06:00'), null, evening)).toBe(
      'atrasados',
    );
  });
});

describe('schedule bucket bounds (ZIG-I30, the SQL cut)', () => {
  const HOUR = 60 * 60 * 1000;

  /** Every hour from 3 days before `now` to 20 days after, paused and not. */
  const sweep = (now: Date) => {
    const bounds = scheduleBucketBounds(now);
    const seen = new Set<string>();
    for (let offset = -3 * 24; offset <= 20 * 24; offset += 1) {
      const due = new Date(now.getTime() + offset * HOUR);
      for (const paused of [null, new Date(now.getTime() - HOUR)]) {
        const expected = classifyScheduleBucket(due, paused, now);
        expect(classifyScheduleBucketByBounds(due, paused, bounds)).toBe(expected);
        seen.add(expected);
      }
    }
    return seen;
  };

  it('agrees with classifyScheduleBucket in all four buckets at midday', () => {
    expect(sweep(new Date('2026-10-25T18:00:00.000Z'))).toEqual(
      new Set(['atrasados', 'proximos', 'programados', 'pausados']),
    );
  });

  it('agrees at 23:30 CDMX, when UTC is already the next day', () => {
    sweep(new Date('2026-10-24T23:30:00-06:00'));
  });

  it('agrees at 00:30 CDMX, right after the company day starts', () => {
    sweep(new Date('2026-10-25T00:30:00-06:00'));
  });

  it('starts today at 00:00 CDMX and ends próximos after day today + 14', () => {
    const bounds = scheduleBucketBounds(new Date('2026-10-24T23:30:00-06:00'));
    expect(bounds.todayStart.toISOString()).toBe('2026-10-24T06:00:00.000Z');
    // Day 24 + 14 = 7 Nov is the last próximo day; 8 Nov 00:00 CDMX ends it.
    expect(bounds.soonEnd.toISOString()).toBe('2026-11-08T06:00:00.000Z');
    const now = new Date('2026-10-25T18:00:00.000Z');
    const edges = scheduleBucketBounds(now);
    expect(
      classifyScheduleBucketByBounds(new Date(edges.todayStart.getTime() - 1), null, edges),
    ).toBe('atrasados');
    expect(classifyScheduleBucketByBounds(edges.todayStart, null, edges)).toBe('proximos');
    expect(
      classifyScheduleBucketByBounds(new Date(edges.soonEnd.getTime() - 1), null, edges),
    ).toBe('proximos');
    expect(classifyScheduleBucketByBounds(edges.soonEnd, null, edges)).toBe('programados');
  });

  it('counts relative days on the company calendar', () => {
    const now = new Date('2026-10-24T23:30:00-06:00');
    expect(companyDaysFromToday(new Date('2026-10-24T08:00:00-06:00'), now)).toBe(0);
    expect(companyDaysFromToday(new Date('2026-10-25T08:00:00-06:00'), now)).toBe(1);
    expect(companyDaysFromToday(new Date('2026-10-20T12:00:00.000Z'), now)).toBe(-4);
  });
});
