/**
 * Document readers for the MCP connector (ZIG-I23-3): tickets and presupuestos
 * are both Ticket rows, told apart by `document_kind`. Every query is scoped to
 * `agent.companyId` (already authorized by resolveAgentContext) and skips
 * soft-deleted rows, so a document of another company is simply not found.
 */

import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { servicesTickets, ticket, ticketLineMaterial } from '@/db/schema';
import { companyDay } from '@/lib/company-day';
import { db } from '@/lib/db';
import { loadDashboardDayQueueForCompany } from '@/lib/dashboard-day-queue-loader';
import { loadDashboardMetricsForCompany } from '@/lib/dashboard-metrics-loader';
import { formatDocumentFolio, parseFolioSearch, type FolioParts } from '@/lib/folio';
import { McpToolError } from '@/lib/mcp/tool-helpers';
import { mapAgentTicketSummary } from '@/lib/mcp/serialize-ticket';
import { lineTotalWithMaterials } from '@/lib/money';
import { buildReviewLine } from '@/lib/review-lines';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import {
  getPresupuestoStatus,
  normalizeTicketDocumentKind,
  type PresupuestoStatus,
  type TicketDocumentKind,
} from '@/lib/ticket-document-kind';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
  type TicketPaymentStatus,
} from '@/lib/ticket-payment-status';

/* ------------------------------------------------------------------------- */
/* Shared pieces (phase 5 search/fetch reuses them)                          */
/* ------------------------------------------------------------------------- */

export type DocumentPaymentStatus = 'pendiente' | 'parcial' | 'pagado';

export const PAYMENT_STATUS_TO_MCP: Record<TicketPaymentStatus, DocumentPaymentStatus> = {
  pending: 'pendiente',
  partial: 'parcial',
  paid: 'pagado',
};

const MCP_TO_PAYMENT_STATUS: Record<DocumentPaymentStatus, TicketPaymentStatus> = {
  pendiente: 'pending',
  parcial: 'partial',
  pagado: 'paid',
};

export type DocumentUrls = { app: string; pdf: string; share: string | null };

/**
 * Links into the app for a document. `share` stays null: the app shares the
 * recibo as a PDF file from the device and has no public link yet.
 */
export const buildDocumentUrls = (
  issuer: string,
  doc: { id: bigint | string; document_kind?: string | null },
): DocumentUrls => {
  const id = String(doc.id);
  const base = issuer.replace(/\/$/, '');
  if (normalizeTicketDocumentKind(doc.document_kind) === 'presupuesto') {
    return {
      app: `${base}/presupuestos/${id}`,
      pdf: `${base}/presupuestos/${id}/pdf`,
      share: null,
    };
  }
  return {
    app: `${base}/tickets/${id}`,
    pdf: `${base}/tickets/${id}/recibo`,
    share: null,
  };
};

/** Columns a document summary needs. */
export const documentSummaryColumns = {
  id: true,
  client_id: true,
  client_name: true,
  ticket_date: true,
  total: true,
  paid: true,
  finished: true,
  company_id: true,
  created_at: true,
  updated_at: true,
  document_kind: true,
  folio_number: true,
  folio_prefix: true,
  expires_at: true,
  canceled_at: true,
  converted_to_ticket_id: true,
} as const;

export type DocumentSummaryRow = {
  id: bigint;
  client_id: number | null;
  client_name: string | null;
  ticket_date: Date | null;
  total: number | null;
  paid: number | null;
  finished: boolean;
  company_id: number | null;
  created_at: Date;
  updated_at: Date | null;
  document_kind: string;
  folio_number: number | null;
  folio_prefix: string | null;
  expires_at: Date | null;
  canceled_at: Date | null;
  converted_to_ticket_id: bigint | null;
};

export const mapDocumentFolio = (
  row: FolioParts & { id?: bigint | string; document_kind?: string | null },
) => ({
  prefix: row.folio_prefix ?? null,
  number: row.folio_number ?? null,
  label: formatDocumentFolio(row),
});

/** v1 summary fields plus kind, folio, payment status, balance and updated_at. */
export const mapDocumentSummary = (row: DocumentSummaryRow, today: Date = new Date()) => {
  const kind: TicketDocumentKind = normalizeTicketDocumentKind(row.document_kind);
  const presupuestoStatus: PresupuestoStatus | null =
    kind === 'presupuesto' ? getPresupuestoStatus(row, today) : null;
  return {
    ...mapAgentTicketSummary(row),
    kind,
    folio: mapDocumentFolio(row),
    payment_status: PAYMENT_STATUS_TO_MCP[getTicketPaymentStatus(row.total, row.paid)],
    balance: getTicketBalanceDue(row.total, row.paid),
    presupuesto_status: presupuestoStatus,
    updated_at: row.updated_at,
  };
};

export type DocumentSummary = ReturnType<typeof mapDocumentSummary>;

/* ------------------------------------------------------------------------- */
/* Cursor                                                                    */
/* ------------------------------------------------------------------------- */

type CursorPosition = { createdAt: Date; id: bigint };

export const encodeDocumentCursor = (position: CursorPosition): string =>
  Buffer.from(
    JSON.stringify({ c: position.createdAt.toISOString(), i: position.id.toString() }),
  ).toString('base64url');

export const decodeDocumentCursor = (cursor: string): CursorPosition => {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      c?: unknown;
      i?: unknown;
    };
    if (typeof parsed.c !== 'string' || typeof parsed.i !== 'string' || !/^\d+$/.test(parsed.i)) {
      throw new Error('shape');
    }
    const createdAt = new Date(parsed.c);
    if (Number.isNaN(createdAt.getTime())) throw new Error('date');
    return { createdAt, id: BigInt(parsed.i) };
  } catch {
    throw new McpToolError(
      'validation',
      'cursor inválido. Usa el next_cursor de la respuesta anterior.',
    );
  }
};

/* ------------------------------------------------------------------------- */
/* list_documents                                                            */
/* ------------------------------------------------------------------------- */

/** Same CASE as the dashboard's payment breakdown (getTicketPaymentStatus in SQL). */
const paymentStatusSql = sql<TicketPaymentStatus>`
  CASE
    WHEN COALESCE(${ticket.total}, 0) <= 0.01 THEN 'pending'
    WHEN COALESCE(${ticket.paid}, 0) >= COALESCE(${ticket.total}, 0) - 0.01 THEN 'paid'
    WHEN COALESCE(${ticket.paid}, 0) > 0.01 THEN 'partial'
    ELSE 'pending'
  END
`;

const escapeLike = (value: string): string => value.replace(/[%_\\]/g, (c) => `\\${c}`);

const folioCondition = (folio: { prefix: string; number: number }): SQL => {
  const byNumber = eq(ticket.folio_number, folio.number);
  return folio.prefix
    ? (and(byNumber, sql`upper(${ticket.folio_prefix}) = ${folio.prefix}`) as SQL)
    : byNumber;
};

/** `YYYY-MM-DD` as the start of that UTC day. */
const startOfIsoDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const nextIsoDay = (value: string): Date => {
  const date = startOfIsoDate(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

export type ListDocumentsInput = {
  kind?: TicketDocumentKind | 'all';
  client_id?: number;
  folio?: string;
  date_from?: string;
  date_to?: string;
  payment_status?: DocumentPaymentStatus;
  finished?: boolean;
  query?: string;
  limit?: number;
  cursor?: string;
};

export const DEFAULT_DOCUMENT_PAGE_SIZE = 25;

export const listAgentDocuments = async (
  agent: Pick<AgentContext, 'companyId'>,
  input: ListDocumentsInput = {},
) => {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_DOCUMENT_PAGE_SIZE, 1), 100);
  const conditions: SQL[] = [eq(ticket.company_id, agent.companyId), isNull(ticket.deleted_at)];

  if (input.kind && input.kind !== 'all') {
    conditions.push(eq(ticket.document_kind, input.kind));
  }
  if (input.client_id != null) {
    conditions.push(eq(ticket.client_id, input.client_id));
  }
  if (input.folio != null) {
    const folio = parseFolioSearch(input.folio);
    if (!folio) {
      throw new McpToolError('validation', 'folio inválido. Usa R-0012, P-3 o solo el número.');
    }
    conditions.push(folioCondition(folio));
  }
  if (input.date_from) {
    conditions.push(gte(ticket.ticket_date, startOfIsoDate(input.date_from)));
  }
  if (input.date_to) {
    conditions.push(lt(ticket.ticket_date, nextIsoDay(input.date_to)));
  }
  if (input.payment_status) {
    conditions.push(
      sql`(${paymentStatusSql}) = ${MCP_TO_PAYMENT_STATUS[input.payment_status]}`,
    );
  }
  if (input.finished != null) {
    conditions.push(eq(ticket.finished, input.finished));
  }
  const query = input.query?.trim();
  if (query) {
    const byName = ilike(ticket.client_name, `%${escapeLike(query)}%`);
    const folio = parseFolioSearch(query);
    conditions.push(folio ? (or(byName, folioCondition(folio)) as SQL) : byName);
  }
  if (input.cursor) {
    const after = decodeDocumentCursor(input.cursor);
    conditions.push(
      or(
        lt(ticket.created_at, after.createdAt),
        and(eq(ticket.created_at, after.createdAt), lt(ticket.id, after.id)),
      ) as SQL,
    );
  }

  const rows = await db.query.ticket.findMany({
    where: and(...conditions),
    orderBy: [desc(ticket.created_at), desc(ticket.id)],
    limit: limit + 1,
    columns: documentSummaryColumns,
  });

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last
      ? encodeDocumentCursor({ createdAt: last.created_at, id: last.id })
      : null;

  const today = new Date();
  return {
    documents: page.map((row) => mapDocumentSummary(row, today)),
    next_cursor: nextCursor,
  };
};

/** Summaries for known ids of the company, in the order given (missing ids drop out). */
export const getAgentDocumentSummariesByIds = async (
  agent: Pick<AgentContext, 'companyId'>,
  ids: Array<bigint | string>,
): Promise<DocumentSummary[]> => {
  if (ids.length === 0) return [];
  const wanted = ids.map((id) => BigInt(id));
  const rows = await db.query.ticket.findMany({
    where: and(
      eq(ticket.company_id, agent.companyId),
      isNull(ticket.deleted_at),
      inArray(ticket.id, wanted),
    ),
    columns: documentSummaryColumns,
  });
  const byId = new Map(rows.map((row) => [row.id.toString(), row]));
  const today = new Date();
  return wanted.flatMap((id) => {
    const row = byId.get(id.toString());
    return row ? [mapDocumentSummary(row, today)] : [];
  });
};

/* ------------------------------------------------------------------------- */
/* get_document                                                              */
/* ------------------------------------------------------------------------- */

const formatAddress = (row: {
  street: string | null;
  exterior_number: string | null;
  interior_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  address: string | null;
}): string | null => {
  const streetLine = [
    row.street,
    row.exterior_number ? `#${row.exterior_number}` : null,
    row.interior_number ? `Int. ${row.interior_number}` : null,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ');
  const parts = [
    streetLine,
    row.neighborhood,
    row.city,
    row.state,
    row.postal_code ? `CP ${row.postal_code}` : null,
  ].filter((part): part is string => Boolean(part?.trim()));
  if (parts.length > 0) return parts.join(', ');
  return row.address?.trim() || null;
};

export const getAgentDocument = async (
  agent: Pick<AgentContext, 'companyId'>,
  documentId: bigint,
  opts: { issuer: string },
) => {
  const row = await db.query.ticket.findFirst({
    where: and(
      eq(ticket.id, documentId),
      eq(ticket.company_id, agent.companyId),
      isNull(ticket.deleted_at),
    ),
    columns: {
      ...documentSummaryColumns,
      work_notes: true,
      client_tel: true,
      email: true,
      converted_from_ticket_id: true,
    },
    with: {
      services_tickets: {
        where: isNull(servicesTickets.deleted_at),
        orderBy: [asc(servicesTickets.id)],
        columns: {
          id: true,
          service_id: true,
          name: true,
          description: true,
          quantity: true,
          price: true,
        },
        with: {
          service: { columns: { name: true, description: true } },
          materials: {
            where: isNull(ticketLineMaterial.deleted_at),
            columns: {
              id: true,
              material_id: true,
              name: true,
              unit: true,
              quantity: true,
              price: true,
            },
            orderBy: [asc(ticketLineMaterial.sort_order), asc(ticketLineMaterial.id)],
          },
        },
      },
      client: {
        columns: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          street: true,
          exterior_number: true,
          interior_number: true,
          neighborhood: true,
          city: true,
          state: true,
          postal_code: true,
          company_id: true,
          deleted_at: true,
        },
      },
      User: { columns: { id: true, name: true, deleted_at: true } },
    },
  });

  if (!row) {
    throw new McpToolError('not_found', 'Documento no encontrado');
  }

  // Linked documents (conversion) only when they are live rows of this company.
  const linkedIds = [row.converted_from_ticket_id, row.converted_to_ticket_id].filter(
    (id): id is bigint => id != null,
  );
  const linked =
    linkedIds.length > 0
      ? await db.query.ticket.findMany({
          where: and(
            eq(ticket.company_id, agent.companyId),
            isNull(ticket.deleted_at),
            inArray(ticket.id, linkedIds),
          ),
          columns: { id: true, document_kind: true, folio_number: true, folio_prefix: true },
        })
      : [];
  const source =
    row.converted_from_ticket_id != null
      ? linked.find((doc) => doc.id === row.converted_from_ticket_id) ?? null
      : null;
  const target =
    row.converted_to_ticket_id != null
      ? linked.find((doc) => doc.id === row.converted_to_ticket_id) ?? null
      : null;

  // The client record only counts when it is live and belongs to this company.
  const liveClient =
    row.client && row.client.deleted_at == null && row.client.company_id === agent.companyId
      ? row.client
      : null;

  const lines = row.services_tickets.map((line) => {
    const review = buildReviewLine(line);
    const materials = (review.materials ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
    }));
    return {
      id: review.id,
      service_id: review.serviceId,
      name: review.name,
      quantity: review.quantity,
      price: review.price,
      subtotal: lineTotalWithMaterials(review),
      materials,
    };
  });

  return {
    ...mapDocumentSummary(row),
    lines,
    work_notes: row.work_notes ?? null,
    source_presupuesto_folio:
      source && normalizeTicketDocumentKind(source.document_kind) === 'presupuesto'
        ? mapDocumentFolio(source)
        : null,
    converted_to_document_id: target ? target.id.toString() : null,
    client: {
      id: liveClient?.id ?? null,
      name: row.client_name ?? liveClient?.name ?? null,
      phone: row.client_tel?.trim() || liveClient?.phone || null,
      email: row.email?.trim() || liveClient?.email || null,
      address: liveClient ? formatAddress(liveClient) : null,
    },
    created_by:
      row.User && row.User.deleted_at == null
        ? { id: row.User.id.toString(), name: row.User.name ?? '' }
        : null,
    urls: buildDocumentUrls(opts.issuer, row),
  };
};

export type DocumentDetail = Awaited<ReturnType<typeof getAgentDocument>>;

/* ------------------------------------------------------------------------- */
/* get_company_summary                                                       */
/* ------------------------------------------------------------------------- */

export const COMPANY_SUMMARY_QUEUE_LIMIT = 10;

/** `YYYY-MM-DD` → midday UTC of that day, which is the same company calendar day. */
const middayOfIsoDate = (value: string): Date => new Date(`${value}T12:00:00.000Z`);

export const getAgentCompanySummary = async (
  agent: Pick<AgentContext, 'companyId'>,
  input: { date?: string; now?: Date } = {},
) => {
  const today = companyDay(
    input.date ? middayOfIsoDate(input.date) : (input.now ?? new Date()),
  ).date;

  const [queue, metrics, presupuestos] = await Promise.all([
    loadDashboardDayQueueForCompany(agent.companyId, today, {
      limit: COMPANY_SUMMARY_QUEUE_LIMIT,
    }),
    loadDashboardMetricsForCompany(agent.companyId, 1),
    db.query.ticket.findMany({
      where: and(
        eq(ticket.company_id, agent.companyId),
        isNull(ticket.deleted_at),
        eq(ticket.document_kind, 'presupuesto'),
      ),
      columns: {
        document_kind: true,
        expires_at: true,
        canceled_at: true,
        converted_to_ticket_id: true,
      },
    }),
  ]);

  if (!metrics.success || !metrics.data) {
    throw new Error(metrics.error ?? 'dashboard metrics failed');
  }

  const [hoy, atrasados] = await Promise.all([
    getAgentDocumentSummariesByIds(agent, queue.hoy.map((item) => item.id)),
    getAgentDocumentSummariesByIds(agent, queue.atrasados.map((item) => item.id)),
  ]);

  const outstanding =
    metrics.data.kpis.find((kpi) => kpi.key === 'outstandingBalance')?.value ?? 0;
  const active = metrics.data.kpis.find((kpi) => kpi.key === 'activeTickets')?.value ?? 0;
  const bucket = (status: TicketPaymentStatus) => {
    const item = metrics.data!.paymentStatusBreakdown.find((entry) => entry.status === status);
    return { count: item?.count ?? 0, amount: item?.amount ?? 0 };
  };

  return {
    date: companyDay(today).iso,
    queue: {
      counts: {
        hoy: queue.counts.hoy,
        atrasados: queue.counts.atrasados,
        por_cobrar: queue.counts.porCobrar,
        recordatorios: queue.counts.recordatorios,
      },
      hoy,
      atrasados,
    },
    por_cobrar_balance: queue.porCobrarBalance,
    pending_balance_total: outstanding,
    active_tickets: active,
    payment_status_counts: {
      pendiente: bucket('pending'),
      parcial: bucket('partial'),
      pagado: bucket('paid'),
    },
    presupuestos_open: presupuestos.filter(
      (row) => getPresupuestoStatus(row, today) === 'abierto',
    ).length,
  };
};
