import {
  eachMonthOfInterval,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns';
import type { Locale } from 'date-fns';
import { es } from 'date-fns/locale';

export type RevenueByMonthPoint = {
  monthKey: string;
  label: string;
  revenue: number;
};

/** Minimal ticket shape for revenue aggregation (finished + total). */
export type TicketForRevenueAggregate = {
  finished: boolean;
  total: number | null;
  ticket_date: Date | null;
  created_at: Date;
};

export const ALLOWED_DASHBOARD_MONTH_COUNTS = [3, 6, 12] as const;
export type DashboardMonthCount = (typeof ALLOWED_DASHBOARD_MONTH_COUNTS)[number];

export const parseDashboardMonthCount = (
  value: unknown,
): DashboardMonthCount => {
  const n = Number(value);
  if (n === 3 || n === 6 || n === 12) {
    return n;
  }
  return 12;
};

/** Inclusive range of calendar months: `monthCount` months ending at `startOfMonth(now)`. */
export const buildMonthBuckets = (
  monthCount: DashboardMonthCount,
  now: Date = new Date(),
): Date[] => {
  const monthEnd = startOfMonth(now);
  const monthStartRange = subMonths(monthEnd, monthCount - 1);
  return eachMonthOfInterval({
    start: monthStartRange,
    end: monthEnd,
  });
};

/**
 * Sums `total` for finished tickets into `yyyy-MM` keys that exist in `monthBuckets`.
 */
export const aggregateFinishedRevenueByMonthKey = (
  tickets: TicketForRevenueAggregate[],
  monthBuckets: Date[],
): Map<string, number> => {
  const revenueByMonthMap = new Map<string, number>();
  for (const m of monthBuckets) {
    revenueByMonthMap.set(format(m, 'yyyy-MM'), 0);
  }
  for (const t of tickets) {
    if (!t.finished || t.total == null) {
      continue;
    }
    const refDate = t.ticket_date ?? t.created_at;
    if (!refDate) {
      continue;
    }
    const key = format(startOfMonth(refDate), 'yyyy-MM');
    if (!revenueByMonthMap.has(key)) {
      continue;
    }
    revenueByMonthMap.set(
      key,
      (revenueByMonthMap.get(key) ?? 0) + t.total,
    );
  }
  return revenueByMonthMap;
};

export const toRevenueByMonthPoints = (
  monthBuckets: Date[],
  revenueByMonthMap: Map<string, number>,
  locale: Locale = es,
): Array<RevenueByMonthPoint> =>
  monthBuckets.map((m) => {
    const monthKey = format(m, 'yyyy-MM');
    return {
      monthKey,
      label: format(m, 'MMM yyyy', { locale }),
      revenue: revenueByMonthMap.get(monthKey) ?? 0,
    };
  });
