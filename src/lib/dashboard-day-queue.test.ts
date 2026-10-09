import { buildCobranzaRows } from '@/lib/cobranza';
import {
  buildDashboardDayQueue,
  daysLate,
  pickDefaultDayQueueFilter,
  pickReminderSchedules,
} from '@/lib/dashboard-day-queue';
import { buildTechnicianDayQueue } from '@/lib/technician-day-queue';

const today = new Date(2026, 9, 8, 15, 0, 0);
const day = (offset: number) => new Date(2026, 9, 8 + offset, 10, 0, 0);

type Raw = {
  id: number;
  date: Date;
  finished: boolean;
  total: number;
  paid: number;
  kind?: string;
};

const raws: Raw[] = [
  { id: 1, date: day(0), finished: false, total: 500, paid: 0 },
  { id: 2, date: day(0), finished: false, total: 500, paid: 500 },
  { id: 3, date: day(-3), finished: false, total: 800, paid: 100 },
  { id: 4, date: day(-40), finished: false, total: 300, paid: 0 },
  { id: 5, date: day(-10), finished: true, total: 1000, paid: 0 },
  { id: 6, date: day(-90), finished: true, total: 1000, paid: 400 },
  { id: 7, date: day(-5), finished: true, total: 700, paid: 700 },
  { id: 8, date: day(2), finished: false, total: 200, paid: 0 },
  { id: 9, date: day(-2), finished: false, total: 100, paid: 0, kind: 'presupuesto' },
];

const toInput = (raw: Raw) => ({
  id: raw.id,
  client_name: `Cliente ${raw.id}`,
  client_tel: null,
  ticket_date: raw.date,
  created_at: raw.date,
  total: raw.total,
  paid: raw.paid,
  finished: raw.finished,
  company_id: 1,
  document_kind: raw.kind ?? 'ticket',
});

const build = (limit?: number) =>
  buildDashboardDayQueue({
    dayTickets: buildTechnicianDayQueue(
      raws.filter((raw) => !raw.finished).map(toInput),
      today,
    ).items,
    cobranzaRows: buildCobranzaRows(raws.map(toInput), today),
    schedules: [],
    today,
    limit,
  });

describe('buildDashboardDayQueue', () => {
  it('puts every ticket in at most one filter', () => {
    const queue = build();
    const ids = [
      ...queue.hoy.map((row) => row.id),
      ...queue.atrasados.map((row) => row.id),
      ...queue.porCobrar.map((row) => row.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(queue.hoy.map((row) => row.id)).toEqual(['1', '2']);
    expect(queue.atrasados.map((row) => row.id)).toEqual(['4', '3']);
    // Unfinished tickets with a balance stay in Hoy/Atrasados, never Por cobrar.
    expect(queue.porCobrar.map((row) => row.id)).toEqual(['6', '5']);
  });

  it('leaves out future work, paid tickets and presupuestos', () => {
    const queue = build();
    const all = [...queue.hoy, ...queue.atrasados, ...queue.porCobrar].map(
      (row) => row.id,
    );
    expect(all).not.toContain('8');
    expect(all).not.toContain('7');
    expect(all).not.toContain('9');
  });

  it('counts full sets while capping the rows', () => {
    const queue = build(1);
    expect(queue.counts).toEqual({
      hoy: 2,
      atrasados: 2,
      porCobrar: 2,
      recordatorios: 0,
    });
    expect(queue.hoy).toHaveLength(1);
    expect(queue.atrasados.map((row) => row.id)).toEqual(['4']);
    expect(queue.porCobrar.map((row) => row.id)).toEqual(['6']);
    expect(queue.porCobrarBalance).toBe(1000 + 600);
  });
});

describe('pickReminderSchedules', () => {
  const schedule = (id: number, due: Date, pausedAt: Date | null = null) => ({
    id,
    clientId: id,
    clientName: `Cliente ${id}`,
    clientPhone: null,
    serviceId: 10 + id,
    serviceName: 'Mantenimiento',
    nextDueAt: due,
    pausedAt,
  });

  it('keeps overdue and next-14-day schedules, soonest first, never paused', () => {
    const rows = pickReminderSchedules(
      [
        schedule(1, day(10)),
        schedule(2, day(-20)),
        schedule(3, day(30)),
        schedule(4, day(-1), day(-5)),
        schedule(5, day(0)),
      ],
      today,
    );
    expect(rows.map((row) => [row.id, row.overdue])).toEqual([
      [2, true],
      [5, false],
      [1, false],
    ]);
  });
});

describe('pickDefaultDayQueueFilter', () => {
  it('prefers Hoy, then the first filter with work', () => {
    expect(
      pickDefaultDayQueueFilter({ hoy: 2, atrasados: 5, porCobrar: 1, recordatorios: 0 }),
    ).toBe('hoy');
    expect(
      pickDefaultDayQueueFilter({ hoy: 0, atrasados: 0, porCobrar: 3, recordatorios: 4 }),
    ).toBe('porCobrar');
    expect(
      pickDefaultDayQueueFilter({ hoy: 0, atrasados: 0, porCobrar: 0, recordatorios: 0 }),
    ).toBe('hoy');
  });
});

describe('daysLate', () => {
  it('counts whole calendar days', () => {
    expect(daysLate(day(-40).toISOString(), today)).toBe(40);
    expect(daysLate(day(0).toISOString(), today)).toBe(0);
  });
});
