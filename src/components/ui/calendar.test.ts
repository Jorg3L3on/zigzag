import {
  calendarClassNames,
  resolveCalendarSelectedMonth,
} from '@/components/ui/calendar';

describe('Calendar DayPicker v9 helpers', () => {
  it('maps selected/today modifiers with v9 classNames keys', () => {
    const names = calendarClassNames('single');
    expect(names.selected).toContain('bg-primary');
    expect(names.today).toContain('bg-accent');
    expect(names.day_button).toBeTruthy();
    expect(
      (names as Record<string, string>).day_selected,
    ).toBeUndefined();
  });

  it('resolves the visible month from a single selected date', () => {
    const selected = new Date(2024, 5, 15);
    expect(resolveCalendarSelectedMonth(selected)).toEqual(selected);
  });

  it('resolves the visible month from a range selection', () => {
    const from = new Date(2023, 0, 5);
    expect(
      resolveCalendarSelectedMonth({ from, to: new Date(2023, 0, 10) }),
    ).toEqual(from);
  });
});
