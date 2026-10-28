import {
  formatDaysSince,
  formatRelativeDays,
  formatScheduleEvery,
  formatScheduleLongDate,
  isoDayToLocalDate,
  localDateToIsoDay,
  scheduleDueTone,
} from '@/lib/schedule-agenda-format';
import {
  buildScheduleAgendaQuery,
  parseScheduleAgendaParams,
  scheduleAgendaTab,
} from '@/lib/schedule-agenda-params';

describe('schedule agenda words (ZIG-I30)', () => {
  it.each([
    [0, 'hoy'],
    [1, 'mañana'],
    [-1, 'ayer'],
    [5, 'en 5 días'],
    [-12, 'hace 12 días'],
    [-59, 'hace 59 días'],
    [-120, 'hace 4 meses'],
    [61, 'en 2 meses'],
    [-31 * 13, 'hace 13 meses'],
    [-800, 'hace 2 años'],
  ])('%i days reads «%s»', (days, expected) => {
    expect(formatRelativeDays(days)).toBe(expected);
  });

  it('reads days since the last service as the past', () => {
    expect(formatDaysSince(0)).toBe('hoy');
    expect(formatDaysSince(180)).toBe('hace 6 meses');
    expect(formatDaysSince(null)).toBe('');
  });

  it('says how often', () => {
    expect(formatScheduleEvery(1, 'month')).toBe('cada mes');
    expect(formatScheduleEvery(6, 'month')).toBe('cada 6 meses');
    expect(formatScheduleEvery(15, 'day')).toBe('cada 15 días');
  });

  it('tones Próximo red, amber or grey by bucket', () => {
    expect(scheduleDueTone('atrasados')).toBe('overdue');
    expect(scheduleDueTone('proximos')).toBe('soon');
    expect(scheduleDueTone('programados')).toBe('muted');
    expect(scheduleDueTone('pausados')).toBe('muted');
  });

  it('round-trips picker dates and writes the long form', () => {
    expect(localDateToIsoDay(isoDayToLocalDate('2026-11-08'))).toBe('2026-11-08');
    expect(formatScheduleLongDate('2026-11-08')).toBe('domingo 8 de noviembre de 2026');
  });
});

describe('schedule agenda URL state (ZIG-I30)', () => {
  const read = (query: string) => parseScheduleAgendaParams(new URLSearchParams(query));

  it('opens on Por atender, first page, most overdue first', () => {
    expect(read('')).toEqual({
      view: 'por-atender',
      serviceId: null,
      sort: 'proximo',
      page: 1,
      openId: null,
    });
  });

  it('keeps the old ?filter= links from Hoy and notifications working', () => {
    expect(read('filter=atrasados').view).toBe('atrasados');
    expect(read('filter=proximos').view).toBe('proximos');
    expect(read('filter=todos').view).toBe('todos');
    expect(read('filter=atrasados&vista=pausados').view).toBe('pausados');
    expect(scheduleAgendaTab('atrasados')).toBe('por-atender');
  });

  it('ignores junk values', () => {
    expect(read('vista=nada&orden=x&pagina=-2&servicio=abc&ver=0')).toEqual(read(''));
  });

  it('writes only what differs from the defaults and drops the legacy filter', () => {
    const current = new URLSearchParams('filter=atrasados&ver=7');
    expect(buildScheduleAgendaQuery(current, { view: 'por-atender', page: 1 })).toBe('ver=7');
    expect(
      buildScheduleAgendaQuery(new URLSearchParams(''), {
        view: 'todos',
        serviceId: 3,
        sort: 'cliente',
        page: 2,
      }),
    ).toBe('vista=todos&servicio=3&orden=cliente&pagina=2');
    expect(buildScheduleAgendaQuery(new URLSearchParams('ver=7'), { openId: null })).toBe('');
  });
});
