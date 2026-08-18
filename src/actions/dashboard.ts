'use server';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { client, company, service, servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  buildDashboardKpisFromMonthlySeries,
  buildPaymentStatusBreakdownFromCounts,
  type DashboardKpi,
  type DashboardMonthlyBucket,
  type PaymentStatusBreakdownItem,
} from '@/lib/dashboard-kpi';
import type { TicketPaymentStatus } from '@/lib/ticket-payment-status';
import {
  buildMonthBuckets,
  parseDashboardMonthCount,
  toRevenueByMonthPoints,
  type DashboardMonthCount,
  type RevenueByMonthPoint,
} from '@/lib/dashboard-metrics';
import { checkPermission } from '@/lib/security';
import { createCompanyCache } from '@/lib/cache';
import { withSpan } from '@/lib/observability';

export type DashboardRecentTicket = {
  id: string;
  clientName: string;
  total: number | null;
  paid: number | null;
  ticketDate: Date | null;
  createdAt: Date;
};

export interface DashboardMetrics {
  kpis: DashboardKpi[];
  recentTickets: DashboardRecentTicket[];
  totalTickets: number;
  totalRevenue: number;
  totalRevenueRecognized: number;
  totalCashCollected: number;
  totalClients: number;
  totalServices: number;
  totalServicesSold: number;
  revenueByMonth: RevenueByMonthPoint[];
  paymentStatusBreakdown: PaymentStatusBreakdownItem[];
  clientMetrics: {
    id: number;
    name: string;
    ticketCount: number;
    totalSpent: number;
  }[];
}

export interface DashboardMetricsResponse {
  success: boolean;
  data?: DashboardMetrics;
  error?: string;
  errorType?: ActionErrorType;
}

export type FetchDashboardMetricsInput = {
  /** When the user is a system admin, load metrics for this company. Ignored for normal users. */
  companyId?: number;
  monthCount?: DashboardMonthCount;
};

export async function loadDashboardMetricsForCompany(
  companyId: number,
  monthCount: DashboardMonthCount,
): Promise<DashboardMetricsResponse> {
  try {
    const [companyRow] = await db
      .select()
      .from(company)
      .where(
        and(eq(company.id, companyId), isNull(company.deleted_at)),
      )
      .limit(1);

    if (!companyRow) {
      return buildActionError('CO006');
    }

    const ticketScope = and(
      eq(ticket.company_id, companyId),
      isNull(ticket.deleted_at),
      eq(ticket.document_kind, 'ticket'),
    );

    const ticketMonthTrunc = sql`date_trunc('month', COALESCE(${ticket.ticket_date}, ${ticket.created_at}))`;
    const paymentStatusExpr = sql`
      CASE
        WHEN COALESCE(${ticket.total}, 0) <= 0.01 THEN 'pending'
        WHEN COALESCE(${ticket.paid}, 0) >= COALESCE(${ticket.total}, 0) - 0.01 THEN 'paid'
        WHEN COALESCE(${ticket.paid}, 0) > 0.01 THEN 'partial'
        ELSE 'pending'
      END
    `;
    const outstandingExpr = sql`GREATEST(COALESCE(${ticket.total}, 0) - COALESCE(${ticket.paid}, 0), 0)`;

    const [
      [ticketTotals],
      monthlyRows,
      paymentRows,
      [clientsAgg],
      [servicesAgg],
      [servicesSoldAgg],
      recentTicketRows,
      clientMetrics,
    ] = await Promise.all([
      db
        .select({
          totalTickets: sql<number>`count(*)`,
          totalRevenueRecognized: sql<number>`COALESCE(SUM(CASE WHEN ${ticket.finished} THEN ${ticket.total} ELSE 0 END), 0)`,
          totalCashCollected: sql<number>`COALESCE(SUM(CASE WHEN ${ticket.finished} THEN ${ticket.paid} ELSE 0 END), 0)`,
          outstanding: sql<number>`COALESCE(SUM(${outstandingExpr}), 0)`,
          active: sql<number>`COUNT(*) FILTER (WHERE NOT ${ticket.finished})`,
        })
        .from(ticket)
        .where(ticketScope),
      db
        .select({
          monthKey: sql<string>`to_char(${ticketMonthTrunc}, 'YYYY-MM')`,
          revenue: sql<number>`COALESCE(SUM(CASE WHEN ${ticket.finished} THEN ${ticket.total} ELSE 0 END), 0)`,
          cash: sql<number>`COALESCE(SUM(CASE WHEN ${ticket.finished} THEN ${ticket.paid} ELSE 0 END), 0)`,
          outstanding: sql<number>`COALESCE(SUM(${outstandingExpr}), 0)`,
          active: sql<number>`COUNT(*) FILTER (WHERE NOT ${ticket.finished})`,
        })
        .from(ticket)
        .where(ticketScope)
        .groupBy(ticketMonthTrunc),
      db
        .select({
          status: sql<TicketPaymentStatus>`${paymentStatusExpr}`,
          count: sql<number>`count(*)`,
          amount: sql<number>`COALESCE(SUM(COALESCE(${ticket.total}, 0)), 0)`,
        })
        .from(ticket)
        .where(ticketScope)
        .groupBy(paymentStatusExpr),
      db
        .select({ totalClients: sql<number>`count(*)` })
        .from(client)
        .where(and(eq(client.company_id, companyId), isNull(client.deleted_at))),
      db
        .select({ totalServices: sql<number>`count(*)` })
        .from(service)
        .where(and(eq(service.company_id, companyId), isNull(service.deleted_at))),
      db
        .select({
          totalServicesSold: sql<number>`COALESCE(SUM(${servicesTickets.quantity}), 0)`,
        })
        .from(servicesTickets)
        .innerJoin(ticket, eq(ticket.id, servicesTickets.ticket_id))
        .where(
          and(
            eq(ticket.company_id, companyId),
            isNull(ticket.deleted_at),
            isNull(servicesTickets.deleted_at),
          ),
        ),
      db
        .select({
          id: ticket.id,
          client_name: ticket.client_name,
          client_table_name: client.name,
          total: ticket.total,
          paid: ticket.paid,
          ticket_date: ticket.ticket_date,
          created_at: ticket.created_at,
        })
        .from(ticket)
        .leftJoin(
          client,
          and(eq(ticket.client_id, client.id), isNull(client.deleted_at)),
        )
        .where(ticketScope)
        .orderBy(desc(sql`COALESCE(${ticket.ticket_date}, ${ticket.created_at})`))
        .limit(15),
      db
        .select({
          id: client.id,
          name: client.name,
          ticketCount: sql<number>`COUNT(${ticket.id})`,
          totalSpent: sql<number>`COALESCE(SUM(CASE WHEN ${ticket.finished} THEN ${ticket.total} ELSE 0 END), 0)`,
        })
        .from(client)
        .leftJoin(
          ticket,
          and(
            eq(ticket.client_id, client.id),
            eq(ticket.company_id, companyId),
            isNull(ticket.deleted_at),
          ),
        )
        .where(and(eq(client.company_id, companyId), isNull(client.deleted_at)))
        .groupBy(client.id, client.name)
        .orderBy(
          desc(
            sql`COALESCE(SUM(CASE WHEN ${ticket.finished} THEN ${ticket.total} ELSE 0 END), 0)`,
          ),
        )
        .limit(10),
    ]);

    const monthBuckets = buildMonthBuckets(monthCount);
    const monthlySeries: DashboardMonthlyBucket[] = monthlyRows.map((row) => ({
      monthKey: row.monthKey,
      revenue: Number(row.revenue ?? 0),
      cash: Number(row.cash ?? 0),
      outstanding: Number(row.outstanding ?? 0),
      active: Number(row.active ?? 0),
    }));
    const kpis = buildDashboardKpisFromMonthlySeries(monthlySeries, {
      outstanding: Number(ticketTotals?.outstanding ?? 0),
      active: Number(ticketTotals?.active ?? 0),
    });
    const paymentStatusBreakdown = buildPaymentStatusBreakdownFromCounts(
      Object.fromEntries(
        paymentRows.map((row) => [
          row.status,
          {
            count: Number(row.count ?? 0),
            amount: Number(row.amount ?? 0),
          },
        ]),
      ),
    );
    const revenueByMonth = toRevenueByMonthPoints(
      monthBuckets,
      new Map(monthlySeries.map((row) => [row.monthKey, row.revenue])),
    );

    const recentTickets: DashboardRecentTicket[] = recentTicketRows.map(
      (row) => ({
        id: String(row.id),
        clientName:
          row.client_table_name?.trim() ||
          row.client_name?.trim() ||
          'Sin cliente',
        total: row.total,
        paid: row.paid,
        ticketDate: row.ticket_date,
        createdAt: row.created_at,
      }),
    );

    return {
      success: true,
      data: {
        kpis,
        recentTickets,
        totalTickets: Number(ticketTotals?.totalTickets ?? 0),
        totalRevenue: Number(ticketTotals?.totalRevenueRecognized ?? 0),
        totalRevenueRecognized: Number(ticketTotals?.totalRevenueRecognized ?? 0),
        totalCashCollected: Number(ticketTotals?.totalCashCollected ?? 0),
        totalClients: Number(clientsAgg?.totalClients ?? 0),
        totalServices: Number(servicesAgg?.totalServices ?? 0),
        totalServicesSold: Number(servicesSoldAgg?.totalServicesSold ?? 0),
        revenueByMonth,
        paymentStatusBreakdown,
        clientMetrics: clientMetrics.map((row) => ({
          ...row,
          ticketCount: Number(row.ticketCount ?? 0),
          totalSpent: Number(row.totalSpent ?? 0),
        })),
      },
    };
  } catch (error) {
    return handleCodedServerActionError('dashboard.metrics', 'DB001', error);
  }
}

/**
 * Read-through cached variant. Dashboard data is display-only and tolerant of
 * brief staleness, so it is cached per company (tag `company:{id}:dashboard`)
 * and invalidated by ticket mutations via `invalidateCompanyCache`.
 */
const loadDashboardMetricsCached = createCompanyCache(
  (companyId: number, monthCount: DashboardMonthCount) =>
    withSpan(
      'dashboard.load',
      () => loadDashboardMetricsForCompany(companyId, monthCount),
      { companyId, monthCount },
    ),
  'dashboard',
);

/**
 * Loads dashboard metrics for the authenticated user.
 * Non-system users are always scoped to `session.user.company_id`.
 * System users may pass `companyId` to view another company.
 */
export async function fetchDashboardMetrics(
  input: FetchDashboardMetricsInput = {},
): Promise<DashboardMetricsResponse> {
  const session = await auth();
  if (!session?.user?.company_id) {
    return buildActionError('AU001');
  }

  if (
    !session.user.company_is_system &&
    input.companyId != null &&
    input.companyId !== session.user.company_id
  ) {
    return buildActionError('AU002');
  }

  const monthCount = parseDashboardMonthCount(input.monthCount);

  let effectiveCompanyId = session.user.company_id;
  if (session.user.company_is_system && input.companyId != null) {
    effectiveCompanyId = input.companyId;
  }

  const allowed = await checkPermission(
    session.user.id,
    effectiveCompanyId,
    'tickets.read',
  );

  if (!allowed) {
    return buildActionError('AU002');
  }

  return loadDashboardMetricsCached(effectiveCompanyId, monthCount);
}
