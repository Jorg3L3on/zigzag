'use server';

import { and, desc, eq, isNull, max, sql } from 'drizzle-orm';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { db } from '@/lib/db';
import { service, servicesTickets, ticket, ticketPayment } from '@/db/schema';
import { requireTicketRead } from '@/lib/tickets-rbac-server';
import {
  buildCobranzaRows,
  summarizeCobranzaRows,
  type CobranzaRow,
} from '@/lib/cobranza';

export type CobranzaListData = {
  rows: CobranzaRow[];
  summary: { count: number; balanceSum: number };
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

    const tickets = await db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, effectiveCompanyId),
        isNull(ticket.deleted_at),
        eq(ticket.document_kind, 'ticket'),
      ),
      orderBy: [desc(ticket.created_at)],
    });

    // Last payment and the work done, aggregated in SQL (no N+1), scoped by company.
    const [lastPayments, serviceLines] = await Promise.all([
      db
        .select({
          ticket_id: ticketPayment.ticket_id,
          last_payment_at: max(ticketPayment.created_at),
        })
        .from(ticketPayment)
        .innerJoin(ticket, eq(ticket.id, ticketPayment.ticket_id))
        .where(
          and(
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
            eq(ticket.document_kind, 'ticket'),
          ),
        )
        .groupBy(ticketPayment.ticket_id),
      db
        .select({
          ticket_id: servicesTickets.ticket_id,
          summary: sql<string | null>`string_agg(coalesce(${servicesTickets.name}, ${service.name}), ', ' order by ${servicesTickets.id})`,
        })
        .from(servicesTickets)
        .innerJoin(ticket, eq(ticket.id, servicesTickets.ticket_id))
        .leftJoin(service, eq(service.id, servicesTickets.service_id))
        .where(
          and(
            eq(ticket.company_id, effectiveCompanyId),
            isNull(ticket.deleted_at),
            eq(ticket.document_kind, 'ticket'),
            isNull(servicesTickets.deleted_at),
          ),
        )
        .groupBy(servicesTickets.ticket_id),
    ]);
    const lastPaymentByTicket = new Map(
      lastPayments.map((r) => [String(r.ticket_id), r.last_payment_at]),
    );
    const summaryByTicket = new Map(
      serviceLines.map((r) => [String(r.ticket_id), r.summary]),
    );

    const rows = buildCobranzaRows(
      tickets.map((row) => ({
        id: row.id,
        client_name: row.client_name,
        client_tel: row.client_tel,
        ticket_date: row.ticket_date,
        created_at: row.created_at,
        total: row.total,
        paid: row.paid,
        finished: row.finished,
        company_id: row.company_id,
        document_kind: row.document_kind,
        client_id: row.client_id,
        folio_number: row.folio_number,
        folio_prefix: row.folio_prefix,
        last_payment_at: lastPaymentByTicket.get(String(row.id)) ?? null,
        services_summary: summaryByTicket.get(String(row.id)) ?? null,
      })),
    );

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
