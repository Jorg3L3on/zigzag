'use server';

import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { db } from '@/lib/db';
import { ticket } from '@/db/schema';
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
