'use server';

import { and, eq, gte, inArray, isNull, max, sql } from 'drizzle-orm';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { db } from '@/lib/db';
import { client, service, servicesTickets, ticket, ticketPayment } from '@/db/schema';
import { requireTicketRead } from '@/lib/tickets-rbac-server';
import { companyDay } from '@/lib/company-day';
import { formatDocumentFolio } from '@/lib/folio';
import {
  buildCobranzaRows,
  cobranzaClientKey,
  filterCobranzaRows,
  groupCobranzaRowsByClient,
  matchesCobranzaScope,
  sortCobranzaRows,
  summarizeCobranzaBuckets,
  summarizeCobranzaRows,
  type CobranzaAgingBucket,
  type CobranzaBucketSummary,
  type CobranzaClientGroup,
  type CobranzaRow,
  type CobranzaSort,
  type CobranzaStatusFilter,
} from '@/lib/cobranza';

export type CobranzaListData = {
  rows: CobranzaRow[];
  summary: { count: number; balanceSum: number };
};

/** A work ticket with a saldo: total above the tolerance and not covered by paid. */
const DUE_CONDITION = sql`COALESCE(${ticket.total}, 0) > 0.01 AND COALESCE(${ticket.paid}, 0) < COALESCE(${ticket.total}, 0) - 0.01`;

/**
 * One phone for the queue, the reminders and the estado de cuenta: the client's
 * current phone, else the snapshot on the ticket (same source as the client page).
 */
const CURRENT_PHONE = sql<string | null>`COALESCE(NULLIF(TRIM(${client.phone}), ''), ${ticket.client_tel})`;

const clientJoin = and(eq(client.id, ticket.client_id), isNull(client.deleted_at));

const roundCents = (value: number): number => Math.round(value * 100) / 100;

const workTicketScope = (companyId: number) =>
  and(
    eq(ticket.company_id, companyId),
    isNull(ticket.deleted_at),
    eq(ticket.document_kind, 'ticket'),
  );

/** Finished work tickets with a saldo (ZIG-I31 rule), with last payment and work summary. */
const loadCobranzaRows = async (
  companyId: number,
  now: Date,
): Promise<CobranzaRow[]> => {
  const cobrableScope = and(
    workTicketScope(companyId),
    eq(ticket.finished, true),
    DUE_CONDITION,
  );

  const tickets = await db
    .select({
      id: ticket.id,
      client_name: ticket.client_name,
      client_tel: CURRENT_PHONE,
      ticket_date: ticket.ticket_date,
      created_at: ticket.created_at,
      total: ticket.total,
      paid: ticket.paid,
      finished: ticket.finished,
      company_id: ticket.company_id,
      document_kind: ticket.document_kind,
      client_id: ticket.client_id,
      folio_number: ticket.folio_number,
      folio_prefix: ticket.folio_prefix,
    })
    .from(ticket)
    .leftJoin(client, clientJoin)
    .where(cobrableScope);

  if (tickets.length === 0) {
    return [];
  }

  // Last payment and the work done, aggregated in SQL (no N+1), only for the queue.
  const ids = tickets.map((row) => row.id);
  const [lastPayments, serviceLines] = await Promise.all([
    db
      .select({
        ticket_id: ticketPayment.ticket_id,
        last_payment_at: max(ticketPayment.created_at),
      })
      .from(ticketPayment)
      .where(inArray(ticketPayment.ticket_id, ids))
      .groupBy(ticketPayment.ticket_id),
    db
      .select({
        ticket_id: servicesTickets.ticket_id,
        summary: sql<string | null>`string_agg(coalesce(${servicesTickets.name}, ${service.name}), ', ' order by ${servicesTickets.id})`,
        count: sql<number>`count(*)`,
      })
      .from(servicesTickets)
      .leftJoin(service, eq(service.id, servicesTickets.service_id))
      .where(
        and(
          inArray(servicesTickets.ticket_id, ids),
          isNull(servicesTickets.deleted_at),
        ),
      )
      .groupBy(servicesTickets.ticket_id),
  ]);
  const lastPaymentByTicket = new Map(
    lastPayments.map((r) => [String(r.ticket_id), r.last_payment_at]),
  );
  const summaryByTicket = new Map(serviceLines.map((r) => [String(r.ticket_id), r]));

  return buildCobranzaRows(
    tickets.map((row) => ({
      ...row,
      last_payment_at: lastPaymentByTicket.get(String(row.id)) ?? null,
      services_summary: summaryByTicket.get(String(row.id))?.summary ?? null,
      services_count: Number(summaryByTicket.get(String(row.id))?.count ?? 0),
    })),
    now,
  );
};

export async function getCobranzaList(
  companyId: number | null,
): Promise<{
  success: boolean;
  data?: CobranzaListData;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireTicketRead(
      companyId ?? undefined,
    );

    const rows = await loadCobranzaRows(effectiveCompanyId, new Date());

    return {
      success: true,
      data: {
        rows,
        summary: summarizeCobranzaRows(rows),
      },
    };
  } catch (e) {
    return handleCodedServerActionError('cobranza.list', 'TC002', e);
  }
}

export type CobranzaGroupBy = 'ticket' | 'client';

export type CobranzaPaginatedData = {
  /** Page of tickets (`groupBy: 'ticket'`); empty when grouping by client. */
  rows: CobranzaRow[];
  /** Page of clients (`groupBy: 'client'`); empty when listing tickets. */
  groups: CobranzaClientGroup[];
  /** Tickets, or clients when grouping, that match every filter. */
  total: number;
  /** Saldo of `total` (by client: everything those clients owe). */
  totalBalance: number;
  /** Tickets behind `total` (equal to it by ticket; every owed ticket of the listed clients). */
  ticketCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Aging strip: counts and sums under search, status and client, never the bucket. */
  buckets: CobranzaBucketSummary;
  /** Unfinished tickets with a saldo under the search and client: out of Cobranza, named in the footer. */
  inProgress: { count: number; total: number };
  /** Payments recorded in the company's current month, under the search and client. */
  collectedThisMonth: { amount: number; payments: number; month: string };
};

export async function getCobranzaPaginated(params: {
  companyId?: number | null;
  bucket?: CobranzaAgingBucket;
  status?: CobranzaStatusFilter;
  search?: string;
  sort?: CobranzaSort;
  groupBy?: CobranzaGroupBy;
  /** Only the tickets of this client (ZIG-I17-2). */
  clientId?: number | null;
  page?: number;
  pageSize?: number;
}): Promise<{
  success: boolean;
  data?: CobranzaPaginatedData;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { companyId: effectiveCompanyId } = await requireTicketRead(
      params.companyId ?? undefined,
    );

    const now = new Date();
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 25)));
    const groupBy: CobranzaGroupBy = params.groupBy === 'client' ? 'client' : 'ticket';
    // A month never spans more than 31 days; the company-day check below trims the edges.
    const paymentsSince = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000);

    // The ticket fields the search and client scope look at, for the footer and the strip.
    const scopeFields = {
      id: ticket.id,
      client_id: ticket.client_id,
      client_name: ticket.client_name,
      client_tel: CURRENT_PHONE,
      folio_number: ticket.folio_number,
      folio_prefix: ticket.folio_prefix,
    };
    const scope = { search: params.search, clientId: params.clientId ?? null };
    const inScope = (row: {
      id: bigint;
      client_id: number | null;
      client_name: string | null;
      client_tel: string | null;
      folio_number: number | null;
      folio_prefix: string | null;
    }) => matchesCobranzaScope({ ...row, folio: formatDocumentFolio(row) }, scope);

    const [allRows, inProgressRows, recentPayments] = await Promise.all([
      loadCobranzaRows(effectiveCompanyId, now),
      db
        .select({ ...scopeFields, total: ticket.total, paid: ticket.paid })
        .from(ticket)
        .leftJoin(client, clientJoin)
        .where(
          and(
            workTicketScope(effectiveCompanyId),
            eq(ticket.finished, false),
            DUE_CONDITION,
          ),
        ),
      db
        .select({
          ...scopeFields,
          amount: ticketPayment.amount,
          created_at: ticketPayment.created_at,
        })
        .from(ticketPayment)
        .innerJoin(ticket, eq(ticket.id, ticketPayment.ticket_id))
        .leftJoin(client, clientJoin)
        .where(
          and(
            workTicketScope(effectiveCompanyId),
            gte(ticketPayment.created_at, paymentsSince),
          ),
        ),
    ]);

    const inProgress = { count: 0, total: 0 };
    for (const row of inProgressRows) {
      if (!inScope(row)) continue;
      inProgress.count += 1;
      inProgress.total += Number(row.total ?? 0) - Number(row.paid ?? 0);
    }

    const month = companyDay(now).iso.slice(0, 7);
    const collectedThisMonth = { amount: 0, payments: 0, month };
    for (const payment of recentPayments) {
      if (companyDay(payment.created_at).iso.slice(0, 7) !== month) continue;
      if (!inScope(payment)) continue;
      collectedThisMonth.amount += Number(payment.amount ?? 0);
      collectedThisMonth.payments += 1;
    }

    const underStrip = filterCobranzaRows(allRows, {
      status: params.status ?? 'all',
      search: params.search,
      clientId: params.clientId ?? null,
    });
    const buckets = summarizeCobranzaBuckets(underStrip);
    const filtered = sortCobranzaRows(
      filterCobranzaRows(underStrip, { aging: params.bucket ?? 'all' }),
      params.sort ?? 'days',
    );
    // Por cliente: the filters pick which clients are listed, but each group (its
    // Saldo total and the estado de cuenta) carries everything that client owes.
    const listedClients = new Set(filtered.map((row) => cobranzaClientKey(row)));
    const groups =
      groupBy === 'client'
        ? groupCobranzaRowsByClient(allRows, params.sort === 'days' ? 'days' : 'balance').filter(
            (group) => listedClients.has(group.key),
          )
        : [];
    const totalBalance =
      groupBy === 'client'
        ? groups.reduce((sum, group) => sum + group.balanceDue, 0)
        : summarizeCobranzaRows(filtered).balanceSum;
    const ticketCount =
      groupBy === 'client'
        ? groups.reduce((sum, group) => sum + group.tickets.length, 0)
        : filtered.length;

    const items = groupBy === 'client' ? groups : filtered;
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (Math.min(page, totalPages) - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);

    return {
      success: true,
      data: {
        rows: groupBy === 'ticket' ? (pageItems as CobranzaRow[]) : [],
        groups: groupBy === 'client' ? (pageItems as CobranzaClientGroup[]) : [],
        total,
        totalBalance,
        ticketCount,
        page: Math.min(page, totalPages),
        pageSize,
        totalPages,
        buckets,
        inProgress: { count: inProgress.count, total: roundCents(inProgress.total) },
        collectedThisMonth: {
          ...collectedThisMonth,
          amount: roundCents(collectedThisMonth.amount),
        },
      },
    };
  } catch (e) {
    return handleCodedServerActionError('cobranza.paginated', 'TC002', e);
  }
}
