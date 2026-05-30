import {
  classifyScheduleBucket,
  DUE_SOON_DAYS,
  matchesScheduleFilter,
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
});
