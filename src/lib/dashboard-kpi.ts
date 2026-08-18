import {
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns';
import type { Locale } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  TICKET_PAYMENT_STATUS_LABEL,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';

export type DashboardKpiKey =
  | 'revenue'
  | 'cashCollected'
  | 'outstandingBalance'
  | 'activeTickets';

export type DashboardKpiSparklinePoint = {
  monthKey: string;
  label: string;
  value: number;
};

export type DashboardKpi = {
  key: DashboardKpiKey;
  label: string;
  value: number;
  deltaPercent: number | null;
  sparkline: DashboardKpiSparklinePoint[];
  format: 'currency' | 'number';
};

export type TicketForKpiAggregate = {
  finished: boolean;
  total: number | null;
  paid: number | null;
  ticket_date: Date | null;
  created_at: Date;
};

export const SPARKLINE_MONTH_COUNT = 8;

export type DashboardMonthlyBucket = {
  monthKey: string;
  revenue: number;
  cash: number;
  outstanding: number;
  active: number;
};

export const computeDeltaPercent = (
  current: number,
  prior: number,
): number | null => {
  if (prior === 0) {
    if (current === 0) {
      return 0;
    }
    return 100;
  }
  return ((current - prior) / prior) * 100;
};

export const ticketReferenceDate = (ticket: TicketForKpiAggregate): Date =>
  ticket.ticket_date ?? ticket.created_at;

export const isDateInCalendarMonth = (
  date: Date,
  monthStart: Date,
): boolean => {
  const start = startOfMonth(monthStart);
  const end = endOfMonth(monthStart);
  return date >= start && date <= end;
};

export const getTicketOutstanding = (ticket: TicketForKpiAggregate): number =>
  getTicketBalanceDue(ticket.total, ticket.paid);

export type PaymentStatusBreakdownItem = {
  status: TicketPaymentStatus;
  label: string;
  count: number;
  amount: number;
};

const PAYMENT_STATUS_ORDER: TicketPaymentStatus[] = [
  'paid',
  'partial',
  'pending',
];

export const buildPaymentStatusBreakdownFromCounts = (
  counts: Partial<
    Record<TicketPaymentStatus, { count: number; amount: number }>
  >,
): PaymentStatusBreakdownItem[] =>
  PAYMENT_STATUS_ORDER.map((status) => ({
    status,
    label: TICKET_PAYMENT_STATUS_LABEL[status],
    count: counts[status]?.count ?? 0,
    amount: counts[status]?.amount ?? 0,
  }));

export const buildPaymentStatusBreakdown = (
  tickets: TicketForKpiAggregate[],
): PaymentStatusBreakdownItem[] => {
  const buckets: Record<
    TicketPaymentStatus,
    { count: number; amount: number }
  > = {
    paid: { count: 0, amount: 0 },
    partial: { count: 0, amount: 0 },
    pending: { count: 0, amount: 0 },
  };

  for (const ticket of tickets) {
    const status = getTicketPaymentStatus(ticket.total, ticket.paid);
    buckets[status].count += 1;
    buckets[status].amount += ticket.total ?? 0;
  }

  return buildPaymentStatusBreakdownFromCounts(buckets);
};

export const sumFinishedRevenueInMonth = (
  tickets: TicketForKpiAggregate[],
  monthStart: Date,
): number =>
  tickets.reduce((sum, ticket) => {
    if (!ticket.finished || ticket.total == null) {
      return sum;
    }
    const ref = ticketReferenceDate(ticket);
    if (!isDateInCalendarMonth(ref, monthStart)) {
      return sum;
    }
    return sum + ticket.total;
  }, 0);

export const sumFinishedCashInMonth = (
  tickets: TicketForKpiAggregate[],
  monthStart: Date,
): number =>
  tickets.reduce((sum, ticket) => {
    if (!ticket.finished) {
      return sum;
    }
    const ref = ticketReferenceDate(ticket);
    if (!isDateInCalendarMonth(ref, monthStart)) {
      return sum;
    }
    return sum + (ticket.paid ?? 0);
  }, 0);

/** Outstanding balance for Tickets referenced in the calendar month (unpaid portion). */
export const sumOutstandingInMonth = (
  tickets: TicketForKpiAggregate[],
  monthStart: Date,
): number =>
  tickets.reduce((sum, ticket) => {
    const ref = ticketReferenceDate(ticket);
    if (!isDateInCalendarMonth(ref, monthStart)) {
      return sum;
    }
    return sum + getTicketOutstanding(ticket);
  }, 0);

/** Total outstanding across all Tickets (snapshot). */
export const sumOutstandingSnapshot = (
  tickets: TicketForKpiAggregate[],
): number =>
  tickets.reduce((sum, ticket) => sum + getTicketOutstanding(ticket), 0);

export const countActiveTicketsSnapshot = (
  tickets: TicketForKpiAggregate[],
): number => tickets.filter((ticket) => !ticket.finished).length;

export const countActiveTicketsInMonth = (
  tickets: TicketForKpiAggregate[],
  monthStart: Date,
): number =>
  tickets.filter((ticket) => {
    if (ticket.finished) {
      return false;
    }
    const ref = ticketReferenceDate(ticket);
    return isDateInCalendarMonth(ref, monthStart);
  }).length;

const buildSparklineBuckets = (
  now: Date,
  monthCount: number,
): Date[] => {
  const end = startOfMonth(now);
  const buckets: Date[] = [];
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    buckets.push(subMonths(end, i));
  }
  return buckets;
};

type MonthlyMetricFn = (
  tickets: TicketForKpiAggregate[],
  monthStart: Date,
) => number;

const buildMonthlySparkline = (
  tickets: TicketForKpiAggregate[],
  metricFn: MonthlyMetricFn,
  now: Date,
  locale: Locale = es,
): DashboardKpiSparklinePoint[] => {
  const buckets = buildSparklineBuckets(now, SPARKLINE_MONTH_COUNT);
  return buckets.map((monthStart) => {
    const monthKey = format(monthStart, 'yyyy-MM');
    return {
      monthKey,
      label: format(monthStart, 'MMM yyyy', { locale }),
      value: metricFn(tickets, monthStart),
    };
  });
};

export const buildDashboardKpisFromMonthlySeries = (
  series: DashboardMonthlyBucket[],
  snapshots: { outstanding: number; active: number },
  now: Date = new Date(),
  locale: Locale = es,
): DashboardKpi[] => {
  const byKey = new Map(series.map((bucket) => [bucket.monthKey, bucket]));
  const currentKey = format(startOfMonth(now), 'yyyy-MM');
  const priorKey = format(subMonths(startOfMonth(now), 1), 'yyyy-MM');
  const emptyBucket: DashboardMonthlyBucket = {
    monthKey: '',
    revenue: 0,
    cash: 0,
    outstanding: 0,
    active: 0,
  };
  const current = byKey.get(currentKey) ?? emptyBucket;
  const prior = byKey.get(priorKey) ?? emptyBucket;

  const sparkline = (
    pick: (bucket: DashboardMonthlyBucket) => number,
  ): DashboardKpiSparklinePoint[] =>
    buildSparklineBuckets(now, SPARKLINE_MONTH_COUNT).map((monthStart) => {
      const monthKey = format(monthStart, 'yyyy-MM');
      return {
        monthKey,
        label: format(monthStart, 'MMM yyyy', { locale }),
        value: pick(byKey.get(monthKey) ?? emptyBucket),
      };
    });

  return [
    {
      key: 'revenue',
      label: 'Ingresos del periodo',
      value: current.revenue,
      deltaPercent: computeDeltaPercent(current.revenue, prior.revenue),
      sparkline: sparkline((bucket) => bucket.revenue),
      format: 'currency',
    },
    {
      key: 'cashCollected',
      label: 'Efectivo cobrado',
      value: current.cash,
      deltaPercent: computeDeltaPercent(current.cash, prior.cash),
      sparkline: sparkline((bucket) => bucket.cash),
      format: 'currency',
    },
    {
      key: 'outstandingBalance',
      label: 'Saldo por cobrar',
      value: snapshots.outstanding,
      deltaPercent: computeDeltaPercent(current.outstanding, prior.outstanding),
      sparkline: sparkline((bucket) => bucket.outstanding),
      format: 'currency',
    },
    {
      key: 'activeTickets',
      label: 'Tickets activos',
      value: snapshots.active,
      deltaPercent: computeDeltaPercent(current.active, prior.active),
      sparkline: sparkline((bucket) => bucket.active),
      format: 'number',
    },
  ];
};

export const buildDashboardKpis = (
  tickets: TicketForKpiAggregate[],
  now: Date = new Date(),
  locale: Locale = es,
): DashboardKpi[] => {
  const currentMonth = startOfMonth(now);
  const priorMonth = subMonths(currentMonth, 1);

  const revenueCurrent = sumFinishedRevenueInMonth(tickets, currentMonth);
  const revenuePrior = sumFinishedRevenueInMonth(tickets, priorMonth);

  const cashCurrent = sumFinishedCashInMonth(tickets, currentMonth);
  const cashPrior = sumFinishedCashInMonth(tickets, priorMonth);

  const outstandingValue = sumOutstandingSnapshot(tickets);
  const outstandingCurrentMonth = sumOutstandingInMonth(tickets, currentMonth);
  const outstandingPriorMonth = sumOutstandingInMonth(tickets, priorMonth);

  const activeValue = countActiveTicketsSnapshot(tickets);
  const activeCurrentMonth = countActiveTicketsInMonth(tickets, currentMonth);
  const activePriorMonth = countActiveTicketsInMonth(tickets, priorMonth);

  return [
    {
      key: 'revenue',
      label: 'Ingresos del periodo',
      value: revenueCurrent,
      deltaPercent: computeDeltaPercent(revenueCurrent, revenuePrior),
      sparkline: buildMonthlySparkline(
        tickets,
        sumFinishedRevenueInMonth,
        now,
        locale,
      ),
      format: 'currency',
    },
    {
      key: 'cashCollected',
      label: 'Efectivo cobrado',
      value: cashCurrent,
      deltaPercent: computeDeltaPercent(cashCurrent, cashPrior),
      sparkline: buildMonthlySparkline(tickets, sumFinishedCashInMonth, now, locale),
      format: 'currency',
    },
    {
      key: 'outstandingBalance',
      label: 'Saldo por cobrar',
      value: outstandingValue,
      deltaPercent: computeDeltaPercent(
        outstandingCurrentMonth,
        outstandingPriorMonth,
      ),
      sparkline: buildMonthlySparkline(tickets, sumOutstandingInMonth, now, locale),
      format: 'currency',
    },
    {
      key: 'activeTickets',
      label: 'Tickets activos',
      value: activeValue,
      deltaPercent: computeDeltaPercent(activeCurrentMonth, activePriorMonth),
      sparkline: buildMonthlySparkline(
        tickets,
        countActiveTicketsInMonth,
        now,
        locale,
      ),
      format: 'number',
    },
  ];
};
