import {
  buildScheduleAgendaQuery,
  parseScheduleAgendaParams,
  scheduleAgendaSortColumn,
  scheduleAgendaSortFromColumn,
} from '@/lib/schedule-agenda-params';

describe('schedule agenda params', () => {
  it('reads ?orden, servicio included, and falls back to proximo', () => {
    expect(parseScheduleAgendaParams(new URLSearchParams('orden=servicio')).sort).toBe('servicio');
    expect(parseScheduleAgendaParams(new URLSearchParams('orden=otro')).sort).toBe('proximo');
  });

  it('drops the default order from the URL', () => {
    expect(buildScheduleAgendaQuery(new URLSearchParams('orden=cliente'), { sort: 'proximo' })).toBe('');
    expect(buildScheduleAgendaQuery(new URLSearchParams(), { sort: 'ultimo', page: 1 })).toBe('orden=ultimo');
  });

  it('maps the sortable columns to ?orden and back (ZIG-I33-5)', () => {
    expect(scheduleAgendaSortFromColumn('client')).toBe('cliente');
    expect(scheduleAgendaSortFromColumn('service')).toBe('servicio');
    expect(scheduleAgendaSortFromColumn('lastServiceAt')).toBe('ultimo');
    expect(scheduleAgendaSortFromColumn('nextDueAt')).toBe('proximo');
    expect(scheduleAgendaSortFromColumn(undefined)).toBe('proximo');
    expect(scheduleAgendaSortFromColumn('status')).toBe('proximo');
    for (const sort of ['proximo', 'cliente', 'servicio', 'ultimo'] as const) {
      expect(scheduleAgendaSortFromColumn(scheduleAgendaSortColumn(sort))).toBe(sort);
    }
  });
});
