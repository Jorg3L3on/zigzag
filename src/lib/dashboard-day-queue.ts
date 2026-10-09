/**
 * Inicio «Tu día»: one ticket lives in exactly one filter.
 *
 * - Hoy: unfinished work tickets dated today
 * - Atrasados: unfinished work tickets dated before today
 * - Por cobrar: finished work tickets with a balance
 * - Recordatorios: service schedules overdue or due within DUE_SOON_DAYS
 */

import { startOfDay } from 'date-fns';
import type { CobranzaRow } from '@/lib/cobranza';
import { classifyScheduleBucket } from '@/lib/schedule-buckets';
import type { TechnicianDayTicket } from '@/lib/technician-day-queue';

export const DAY_QUEUE_FILTERS = [
  'hoy',
  'atrasados',
  'porCobrar',
  'recordatorios',
] as const;

export type DayQueueFilter = (typeof DAY_QUEUE_FILTERS)[number];

/** Rows shown per filter; the tile count is always the full set size. */
export const DAY_QUEUE_ROW_LIMIT = 5;

export type DayQueueScheduleInput = {
  id: number;
  clientId: number;
  clientName: string;
  clientPhone: string | null;
  serviceId: number;
  serviceName: string;
  nextDueAt: Date | string;
  pausedAt: Date | string | null;
};

export type DayQueueScheduleRow = {
  id: number;
  clientId: number;
  clientName: string;
  clientPhone: string | null;
  serviceId: number;
  serviceName: string;
  nextDueAt: string;
  overdue: boolean;
};

export type DashboardDayQueue = {
  counts: Record<DayQueueFilter, number>;
  /** Sum of balances in Por cobrar (all rows, not just the visible ones). */
  porCobrarBalance: number;
  hoy: TechnicianDayTicket[];
  atrasados: TechnicianDayTicket[];
  porCobrar: CobranzaRow[];
  recordatorios: DayQueueScheduleRow[];
};

const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

const byTicketDateAsc = (a: TechnicianDayTicket, b: TechnicianDayTicket) =>
  new Date(a.ticketDate).getTime() - new Date(b.ticketDate).getTime() ||
  Number(a.id) - Number(b.id);

const byDaysOutstandingDesc = (a: CobranzaRow, b: CobranzaRow) =>
  b.daysOutstanding - a.daysOutstanding || Number(a.id) - Number(b.id);

/** Overdue and due-soon schedules, soonest due first; paused ones never. */
export const pickReminderSchedules = (
  schedules: DayQueueScheduleInput[],
  today: Date = new Date(),
): DayQueueScheduleRow[] =>
  schedules
    .map((schedule) => {
      const nextDueAt = toDate(schedule.nextDueAt);
      const pausedAt = schedule.pausedAt ? toDate(schedule.pausedAt) : null;
      const bucket = classifyScheduleBucket(nextDueAt, pausedAt, today);
      return { schedule, nextDueAt, bucket };
    })
    .filter(({ bucket }) => bucket === 'atrasados' || bucket === 'proximos')
    .sort((a, b) => a.nextDueAt.getTime() - b.nextDueAt.getTime())
    .map(({ schedule, nextDueAt, bucket }) => ({
      id: schedule.id,
      clientId: schedule.clientId,
      clientName: schedule.clientName,
      clientPhone: schedule.clientPhone,
      serviceId: schedule.serviceId,
      serviceName: schedule.serviceName,
      nextDueAt: nextDueAt.toISOString(),
      overdue: bucket === 'atrasados',
    }));

export const buildDashboardDayQueue = (input: {
  /** Unfinished work tickets dated today or earlier (technician day queue). */
  dayTickets: TechnicianDayTicket[];
  /** Cobranza rows (balance > 0); unfinished ones belong to Hoy/Atrasados. */
  cobranzaRows: CobranzaRow[];
  schedules: DayQueueScheduleInput[];
  today?: Date;
  limit?: number;
}): DashboardDayQueue => {
  const today = input.today ?? new Date();
  const limit = input.limit ?? DAY_QUEUE_ROW_LIMIT;

  const hoy = input.dayTickets
    .filter((ticket) => !ticket.isOverdue)
    .sort(byTicketDateAsc);
  const atrasados = input.dayTickets
    .filter((ticket) => ticket.isOverdue)
    .sort(byTicketDateAsc);
  const porCobrar = input.cobranzaRows
    .filter((row) => row.finished && row.balanceDue > 0)
    .sort(byDaysOutstandingDesc);
  const recordatorios = pickReminderSchedules(input.schedules, today);

  return {
    counts: {
      hoy: hoy.length,
      atrasados: atrasados.length,
      porCobrar: porCobrar.length,
      recordatorios: recordatorios.length,
    },
    porCobrarBalance: porCobrar.reduce((sum, row) => sum + row.balanceDue, 0),
    hoy: hoy.slice(0, limit),
    atrasados: atrasados.slice(0, limit),
    porCobrar: porCobrar.slice(0, limit),
    recordatorios: recordatorios.slice(0, limit),
  };
};

/** Hoy if it has work, else the first non-empty filter, else Hoy. */
export const pickDefaultDayQueueFilter = (
  counts: Record<DayQueueFilter, number>,
): DayQueueFilter =>
  DAY_QUEUE_FILTERS.find((filter) => counts[filter] > 0) ?? 'hoy';

/** Whole days between a ticket's work date and today (0 for today). */
export const daysLate = (ticketDate: string, today: Date = new Date()): number =>
  Math.max(
    0,
    Math.round(
      (startOfDay(today).getTime() - startOfDay(new Date(ticketDate)).getTime()) /
        86_400_000,
    ),
  );
