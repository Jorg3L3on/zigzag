import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { client, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { summarizeClientBalance } from '@/lib/client-detail';
import { afterCursor, clampListLimit, toLikePattern, toPage } from '@/lib/mcp/cursor';
import { documentSummaryColumns, mapDocumentSummary } from '@/lib/mcp/domain/documents';
import { McpToolError } from '@/lib/mcp/tool-helpers';
import type { AgentContext } from '@/lib/server/resolve-agent-context';

/** Client reads for the MCP connector (ZIG-I23-4). */

export const RECENT_DOCUMENTS_LIMIT = 10;

/** Minimal fields only: no phone or address in lists (Q2 on ZIG-I23). */
export const listAgentClients = async (
  agent: AgentContext,
  input: { query?: string; limit?: number; cursor?: string },
) => {
  const limit = clampListLimit(input.limit);
  const conditions = [eq(client.company_id, agent.companyId), isNull(client.deleted_at)];
  if (input.query) {
    const pattern = toLikePattern(input.query);
    conditions.push(
      or(
        ilike(client.name, pattern),
        ilike(client.email, pattern),
        ilike(client.document, pattern),
        ilike(client.phone, pattern),
      )!,
    );
  }
  const keyset = afterCursor({ createdAt: client.created_at, id: client.id }, input.cursor);
  if (keyset) conditions.push(keyset);

  const rows = await db
    .select({
      id: client.id,
      name: client.name,
      email: client.email,
      document: client.document,
      company_id: client.company_id,
      created_at: client.created_at,
    })
    .from(client)
    .where(and(...conditions))
    .orderBy(desc(client.created_at), desc(client.id))
    .limit(limit + 1);

  const { items, nextCursor } = toPage(rows, limit);
  return { clients: items, next_cursor: nextCursor };
};

/** Full client record: contact fields, balance and the last documents. */
export const getAgentClient = async (agent: AgentContext, clientId: number) => {
  const row = await db.query.client.findFirst({
    where: and(
      eq(client.id, clientId),
      eq(client.company_id, agent.companyId),
      isNull(client.deleted_at),
    ),
  });
  if (!row) {
    throw new McpToolError('not_found', 'Cliente no encontrado');
  }

  const documents = await db.query.ticket.findMany({
    where: and(
      eq(ticket.client_id, clientId),
      eq(ticket.company_id, agent.companyId),
      isNull(ticket.deleted_at),
    ),
    orderBy: [desc(ticket.created_at), desc(ticket.id)],
    columns: documentSummaryColumns,
  });

  const balance = summarizeClientBalance(documents);

  return {
    id: row.id,
    name: row.name,
    document: row.document,
    notes: row.notes,
    phone: row.phone,
    email: row.email,
    address: {
      street: row.street,
      exterior_number: row.exterior_number,
      interior_number: row.interior_number,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
      postal_code: row.postal_code,
      country: row.country,
      text: row.address,
    },
    balance: {
      balance_due: balance.balanceDue,
      due_ticket_count: balance.dueTicketCount,
      ticket_count: balance.ticketCount,
    },
    recent_documents: documents
      .slice(0, RECENT_DOCUMENTS_LIMIT)
      .map((doc) => mapDocumentSummary(doc)),
    company_id: row.company_id,
    created_at: row.created_at,
  };
};
