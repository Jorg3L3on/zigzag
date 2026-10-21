/**
 * `search` and `fetch` in OpenAI's company-knowledge shape (ZIG-I23-5), over
 * documents (tickets and presupuestos), clients and services.
 *
 * Ids are typed and opaque: `doc:<ticket id>`, `client:<id>`, `service:<id>`.
 * Every company and every kind is checked with assertAgentCompanyAccess (allow
 * list, tenant access and the permission of that kind), so a company outside
 * the allow-list, or a kind the user may not read, contributes nothing.
 */

import { and, desc, eq, ilike, isNull, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { client, service, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { parseFolioSearch } from '@/lib/folio';
import { toLikePattern } from '@/lib/mcp/cursor';
import { getAgentService } from '@/lib/mcp/domain/catalog';
import { getAgentClient } from '@/lib/mcp/domain/clients';
import {
  buildDocumentUrls,
  getAgentDocument,
  mapDocumentSummary,
  type DocumentDetail,
  type DocumentSummary,
} from '@/lib/mcp/domain/documents';
import { McpToolError } from '@/lib/mcp/tool-helpers';
import {
  AgentAuthError,
  assertAgentCompanyAccess,
  resolveAccessibleCompanyIds,
  type AgentContext,
} from '@/lib/server/resolve-agent-context';
import { PRESUPUESTO_STATUS_LABEL } from '@/lib/ticket-document-kind';
import { formatTicketListAmount } from '@/lib/ticket-payment-status';

export const SEARCH_RESULT_LIMIT = 20;

export type KnowledgeKind = 'doc' | 'client' | 'service';

type SearchAgent = Pick<AgentContext, 'userId' | 'allowedCompanyIds'>;

/** Permission each kind needs; a client also shows its documents, as get_client does. */
const KIND_PERMISSIONS: Record<KnowledgeKind, string[]> = {
  doc: ['tickets.read'],
  client: ['clients.read', 'tickets.read'],
  service: ['services.read'],
};

export const formatKnowledgeId = (kind: KnowledgeKind, id: number | bigint | string) =>
  `${kind}:${String(id)}`;

const NOT_FOUND_MESSAGE = 'No encontramos ese registro. Usa un id que devolvió search.';

export const parseKnowledgeId = (value: string): { kind: KnowledgeKind; id: bigint } => {
  const match = /^(doc|client|service):(\d{1,19})$/.exec(value.trim());
  if (!match) throw new McpToolError('not_found', NOT_FOUND_MESSAGE);
  return { kind: match[1] as KnowledgeKind, id: BigInt(match[2]) };
};

/** True when the connection may read `kind` in `companyId`; access errors read as false. */
const canRead = async (agent: SearchAgent, companyId: number, kind: KnowledgeKind) => {
  try {
    for (const permission of KIND_PERMISSIONS[kind]) {
      await assertAgentCompanyAccess(agent, companyId, permission);
    }
    return true;
  } catch (error) {
    if (error instanceof AgentAuthError) return false;
    throw error;
  }
};

/* ------------------------------------------------------------------------- */
/* Titles                                                                    */
/* ------------------------------------------------------------------------- */

const PAYMENT_LABEL: Record<DocumentSummary['payment_status'], string> = {
  pendiente: 'Pendiente',
  parcial: 'Pago parcial',
  pagado: 'Pagado',
};

/** `R-0042 · Juan Pérez · $1,200 · Pendiente`, or `… · Presupuesto abierto`. */
export const documentTitle = (doc: DocumentSummary): string => {
  const status =
    doc.kind === 'presupuesto' && doc.presupuesto_status
      ? `Presupuesto ${PRESUPUESTO_STATUS_LABEL[doc.presupuesto_status].toLowerCase()}`
      : PAYMENT_LABEL[doc.payment_status];
  return [
    doc.folio.label,
    doc.client_name?.trim() || 'Sin cliente',
    formatTicketListAmount(doc.total),
    status,
  ].join(' · ');
};

const clientTitle = (name: string) => `Cliente · ${name}`;

const serviceTitle = (name: string, price: number) =>
  `Servicio · ${name} · ${formatTicketListAmount(price)}`;

const clientUrl = (issuer: string, id: number) => `${issuer.replace(/\/$/, '')}/clients/${id}`;

const serviceUrl = (issuer: string, id: number) =>
  `${issuer.replace(/\/$/, '')}/services/${id}/edit`;

/* ------------------------------------------------------------------------- */
/* search                                                                    */
/* ------------------------------------------------------------------------- */

type Ranked = { rank: number; at: Date; result: { id: string; title: string; url: string } };

const digitsOf = (value: string) => value.replace(/\D/g, '');

/** A query made of digits and phone punctuation, long enough to be a phone. */
const phoneDigits = (query: string): string | null => {
  const digits = digitsOf(query);
  return /^[\d\s().+-]+$/.test(query) && digits.length >= 4 ? digits : null;
};

const phoneMatches = (column: AnyColumn, digits: string): SQL =>
  sql`regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`;

const searchDocuments = async (
  companyId: number,
  query: string,
  issuer: string,
): Promise<Ranked[]> => {
  const pattern = toLikePattern(query);
  const prefix = `${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const folio = parseFolioSearch(query);
  const phone = phoneDigits(query);

  const folioMatch = folio
    ? folio.prefix
      ? sql`(${ticket.folio_number} = ${folio.number} and upper(${ticket.folio_prefix}) = ${folio.prefix})`
      : sql`(${ticket.folio_number} = ${folio.number})`
    : sql`false`;
  const phoneMatch = phone ? phoneMatches(ticket.client_tel, phone) : sql`false`;
  const lineMatch = sql`exists (
    select 1 from "ServicesTickets" st
    left join "Service" s on s.id = st.service_id
    where st.ticket_id = ${ticket.id} and st.deleted_at is null
      and (st.name ilike ${pattern} or s.name ilike ${pattern})
  )`;
  const materialMatch = sql`exists (
    select 1 from "TicketLineMaterial" m
    join "ServicesTickets" st on st.id = m.services_tickets_id
    where st.ticket_id = ${ticket.id} and st.deleted_at is null
      and m.deleted_at is null and m.name ilike ${pattern}
  )`;
  const rank = sql<number>`case
    when ${folioMatch} then 0
    when ${ticket.client_name} ilike ${prefix} then 1
    when ${ticket.client_name} ilike ${pattern} or ${phoneMatch} then 2
    else 3
  end`;

  const rows = await db
    .select({
      id: ticket.id,
      client_id: ticket.client_id,
      client_name: ticket.client_name,
      ticket_date: ticket.ticket_date,
      total: ticket.total,
      paid: ticket.paid,
      finished: ticket.finished,
      company_id: ticket.company_id,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      document_kind: ticket.document_kind,
      folio_number: ticket.folio_number,
      folio_prefix: ticket.folio_prefix,
      expires_at: ticket.expires_at,
      canceled_at: ticket.canceled_at,
      converted_to_ticket_id: ticket.converted_to_ticket_id,
      rank,
    })
    .from(ticket)
    .where(
      and(
        eq(ticket.company_id, companyId),
        isNull(ticket.deleted_at),
        or(
          folioMatch,
          ilike(ticket.client_name, pattern),
          phoneMatch,
          ilike(ticket.work_notes, pattern),
          lineMatch,
          materialMatch,
        ),
      ),
    )
    .orderBy(rank, desc(ticket.created_at), desc(ticket.id))
    .limit(SEARCH_RESULT_LIMIT);

  return rows.map(({ rank: rowRank, ...row }) => {
    const doc = mapDocumentSummary(row);
    return {
      rank: Number(rowRank),
      at: row.created_at,
      result: {
        id: formatKnowledgeId('doc', row.id),
        title: documentTitle(doc),
        url: buildDocumentUrls(issuer, row).app,
      },
    };
  });
};

const searchClients = async (
  companyId: number,
  query: string,
  issuer: string,
): Promise<Ranked[]> => {
  const pattern = toLikePattern(query);
  const prefix = `${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const phone = phoneDigits(query);
  const phoneMatch = phone ? phoneMatches(client.phone, phone) : sql`false`;
  const rank = sql<number>`case when ${client.name} ilike ${prefix} then 1 else 2 end`;

  const rows = await db
    .select({ id: client.id, name: client.name, created_at: client.created_at, rank })
    .from(client)
    .where(
      and(
        eq(client.company_id, companyId),
        isNull(client.deleted_at),
        or(
          ilike(client.name, pattern),
          ilike(client.email, pattern),
          ilike(client.document, pattern),
          phoneMatch,
        ),
      ),
    )
    .orderBy(rank, desc(client.created_at), desc(client.id))
    .limit(SEARCH_RESULT_LIMIT);

  return rows.map((row) => ({
    rank: Number(row.rank),
    at: row.created_at,
    result: {
      id: formatKnowledgeId('client', row.id),
      title: clientTitle(row.name),
      url: clientUrl(issuer, row.id),
    },
  }));
};

const searchServices = async (
  companyId: number,
  query: string,
  issuer: string,
): Promise<Ranked[]> => {
  const pattern = toLikePattern(query);
  const prefix = `${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const materialMatch = sql`exists (
    select 1 from "ServiceMaterial" sm
    join "Material" m on m.id = sm.material_id
    where sm.service_id = ${service.id} and sm.deleted_at is null
      and m.deleted_at is null and m.company_id = ${companyId} and m.name ilike ${pattern}
  )`;
  const rank = sql<number>`case when ${service.name} ilike ${prefix} then 1 else 2 end`;

  const rows = await db
    .select({
      id: service.id,
      name: service.name,
      price: service.price,
      created_at: service.created_at,
      rank,
    })
    .from(service)
    .where(
      and(
        eq(service.company_id, companyId),
        isNull(service.deleted_at),
        or(ilike(service.name, pattern), ilike(service.description, pattern), materialMatch),
      ),
    )
    .orderBy(rank, desc(service.created_at), desc(service.id))
    .limit(SEARCH_RESULT_LIMIT);

  return rows.map((row) => ({
    rank: Number(row.rank),
    at: row.created_at,
    result: {
      id: formatKnowledgeId('service', row.id),
      title: serviceTitle(row.name, row.price),
      url: serviceUrl(issuer, row.id),
    },
  }));
};

const SEARCHERS: Record<
  KnowledgeKind,
  (companyId: number, query: string, issuer: string) => Promise<Ranked[]>
> = {
  doc: searchDocuments,
  client: searchClients,
  service: searchServices,
};

/**
 * Free-text search. Without `companyId` it covers every allow-listed company
 * the user can access; with one, that company must be readable.
 */
export const searchKnowledge = async (
  agent: SearchAgent,
  input: { query: string; companyId?: number },
  opts: { issuer: string },
) => {
  const query = input.query.trim();
  if (!query) return { results: [] };

  const companyIds =
    input.companyId != null
      ? [input.companyId]
      : await resolveAccessibleCompanyIds(agent.userId, agent.allowedCompanyIds);

  const kinds = Object.keys(SEARCHERS) as KnowledgeKind[];
  const plan = await Promise.all(
    companyIds.flatMap((companyId) =>
      kinds.map(async (kind) => ({ companyId, kind, ok: await canRead(agent, companyId, kind) })),
    ),
  );
  if (input.companyId != null && !plan.some((entry) => entry.ok)) {
    // Surface the real reason (not allow-listed, no access) instead of empty results.
    await assertAgentCompanyAccess(agent, input.companyId, 'tickets.read');
  }

  const batches = await Promise.all(
    plan
      .filter((entry) => entry.ok)
      .map((entry) => SEARCHERS[entry.kind](entry.companyId, query, opts.issuer)),
  );

  const results = batches
    .flat()
    .sort((a, b) => a.rank - b.rank || b.at.getTime() - a.at.getTime())
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((item) => item.result);

  return { results };
};

/* ------------------------------------------------------------------------- */
/* fetch                                                                     */
/* ------------------------------------------------------------------------- */

const money = (value: number | null | undefined) => formatTicketListAmount(value ?? 0);

const isoDay = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : null;

const formatQuantity = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');

/** Readable Spanish rendering of a document for `fetch.text`. */
export const renderDocumentText = (doc: DocumentDetail): string => {
  const kindLabel = doc.kind === 'presupuesto' ? 'Presupuesto' : 'Ticket';
  const status =
    doc.kind === 'presupuesto' && doc.presupuesto_status
      ? PRESUPUESTO_STATUS_LABEL[doc.presupuesto_status]
      : PAYMENT_LABEL[doc.payment_status];
  const lines: string[] = [
    `${kindLabel} ${doc.folio.label} (${status}${doc.finished ? ', terminado' : ''})`,
  ];
  const date = isoDay(doc.ticket_date);
  if (date) lines.push(`Fecha: ${date}`);
  if (doc.source_presupuesto_folio) {
    lines.push(`Viene del presupuesto ${doc.source_presupuesto_folio.label}`);
  }

  const contact = [doc.client.phone && `Tel. ${doc.client.phone}`, doc.client.email]
    .filter(Boolean)
    .join(' · ');
  lines.push('', `Cliente: ${doc.client.name ?? 'Sin cliente'}${contact ? ` · ${contact}` : ''}`);
  if (doc.client.address) lines.push(`Dirección: ${doc.client.address}`);

  lines.push('', 'Conceptos:');
  if (doc.lines.length === 0) lines.push('- (sin conceptos)');
  for (const line of doc.lines) {
    lines.push(
      `- ${line.name}: ${formatQuantity(line.quantity)} × ${money(line.price)} = ${money(line.subtotal)}`,
    );
    for (const item of line.materials) {
      lines.push(
        `  · ${item.name}: ${formatQuantity(item.quantity)}${item.unit ? ` ${item.unit}` : ''} × ${money(item.price)}`,
      );
    }
  }

  lines.push(
    '',
    `Total: ${money(doc.total)} · Pagado: ${money(doc.paid)} · Saldo: ${money(doc.balance)}`,
  );
  if (doc.work_notes?.trim()) lines.push('', `Notas de trabajo: ${doc.work_notes.trim()}`);
  if (doc.created_by) lines.push(`Creado por: ${doc.created_by.name}`);
  return lines.join('\n');
};

type ClientDetail = Awaited<ReturnType<typeof getAgentClient>>;

const formatClientAddress = (address: ClientDetail['address']): string | null => {
  const street = [
    address.street,
    address.exterior_number ? `#${address.exterior_number}` : null,
    address.interior_number ? `Int. ${address.interior_number}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const parts = [
    street,
    address.neighborhood,
    address.city,
    address.state,
    address.postal_code ? `CP ${address.postal_code}` : null,
  ].filter((part): part is string => Boolean(part?.trim()));
  return parts.length > 0 ? parts.join(', ') : address.text?.trim() || null;
};

export const renderClientText = (detail: ClientDetail): string => {
  const lines = [`Cliente: ${detail.name}`];
  if (detail.phone) lines.push(`Teléfono: ${detail.phone}`);
  if (detail.email) lines.push(`Email: ${detail.email}`);
  if (detail.document) lines.push(`RFC / documento: ${detail.document}`);
  const address = formatClientAddress(detail.address);
  if (address) lines.push(`Dirección: ${address}`);
  if (detail.notes?.trim()) lines.push(`Notas: ${detail.notes.trim()}`);
  lines.push(
    '',
    `Saldo pendiente: ${money(detail.balance.balance_due)} (${detail.balance.due_ticket_count} de ${detail.balance.ticket_count} tickets con saldo)`,
  );
  lines.push('', 'Últimos documentos:');
  if (detail.recent_documents.length === 0) lines.push('- (ninguno)');
  for (const doc of detail.recent_documents) {
    lines.push(`- ${documentTitle(doc)}${isoDay(doc.ticket_date) ? ` (${isoDay(doc.ticket_date)})` : ''}`);
  }
  return lines.join('\n');
};

type ServiceDetail = NonNullable<Awaited<ReturnType<typeof getAgentService>>>;

export const renderServiceText = (detail: ServiceDetail): string => {
  const lines = [`Servicio: ${detail.name}`, `Precio: ${money(detail.price)}`];
  if (detail.description?.trim()) lines.push(`Descripción: ${detail.description.trim()}`);
  lines.push('', 'Materiales por defecto:');
  if (detail.default_materials.length === 0) lines.push('- (ninguno)');
  for (const item of detail.default_materials) {
    lines.push(
      `- ${item.name}: ${formatQuantity(item.quantity)}${item.unit ? ` ${item.unit}` : ''} × ${money(item.price)}`,
    );
  }
  return lines.join('\n');
};

const notFound = () => new McpToolError('not_found', NOT_FOUND_MESSAGE);

/** The company of a live row, so access is checked against it; null when gone. */
const findCompanyOf = async (kind: KnowledgeKind, id: bigint): Promise<number | null> => {
  if (kind === 'doc') {
    const row = await db.query.ticket.findFirst({
      where: and(eq(ticket.id, id), isNull(ticket.deleted_at)),
      columns: { company_id: true },
    });
    return row?.company_id ?? null;
  }
  if (id > BigInt(2_147_483_647)) return null;
  if (kind === 'client') {
    const row = await db.query.client.findFirst({
      where: and(eq(client.id, Number(id)), isNull(client.deleted_at)),
      columns: { company_id: true },
    });
    return row?.company_id ?? null;
  }
  const row = await db.query.service.findFirst({
    where: and(eq(service.id, Number(id)), isNull(service.deleted_at)),
    columns: { company_id: true },
  });
  return row?.company_id ?? null;
};

/**
 * One record by its search id. A row of a company the connection cannot read
 * is `not_found`, the same as a missing one, so ids do not leak existence.
 */
export const fetchKnowledge = async (
  agent: SearchAgent & Partial<AgentContext>,
  rawId: string,
  opts: { issuer: string },
) => {
  const { kind, id } = parseKnowledgeId(rawId);
  const companyId = await findCompanyOf(kind, id);
  if (companyId == null || !(await canRead(agent, companyId, kind))) throw notFound();
  const scoped = { ...agent, companyId } as AgentContext;
  const knowledgeId = formatKnowledgeId(kind, id);

  if (kind === 'doc') {
    const doc = await getAgentDocument(scoped, id, { issuer: opts.issuer });
    return {
      id: knowledgeId,
      title: documentTitle(doc),
      text: renderDocumentText(doc),
      url: doc.urls.app,
      metadata: {
        kind: doc.kind,
        company_id: companyId,
        folio: doc.folio.label,
        payment_status: doc.payment_status,
        presupuesto_status: doc.presupuesto_status,
        total: doc.total,
        paid: doc.paid,
        balance: doc.balance,
        date: isoDay(doc.ticket_date),
        finished: doc.finished,
        client_id: doc.client.id,
        client_name: doc.client.name,
        pdf_url: doc.urls.pdf,
      },
    };
  }

  if (kind === 'client') {
    const detail = await getAgentClient(scoped, Number(id));
    return {
      id: knowledgeId,
      title: clientTitle(detail.name),
      text: renderClientText(detail),
      url: clientUrl(opts.issuer, detail.id),
      metadata: {
        kind: 'client',
        company_id: companyId,
        name: detail.name,
        phone: detail.phone,
        email: detail.email,
        balance: detail.balance.balance_due,
        ticket_count: detail.balance.ticket_count,
      },
    };
  }

  const detail = await getAgentService(scoped, Number(id));
  if (!detail) throw notFound();
  return {
    id: knowledgeId,
    title: serviceTitle(detail.name, detail.price),
    text: renderServiceText(detail),
    url: serviceUrl(opts.issuer, detail.id),
    metadata: {
      kind: 'service',
      company_id: companyId,
      name: detail.name,
      price: detail.price,
      default_material_count: detail.default_materials.length,
    },
  };
};
