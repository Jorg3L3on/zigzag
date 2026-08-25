import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { client, company, servicesTickets, ticket, user } from '@/db/schema';
import { db } from '@/lib/db';
import {
  mapAgentTicketDetail,
  mapAgentTicketSummary,
} from '@/lib/mcp/serialize-ticket';
import { recordTicketAudit } from '@/lib/ticket-audit';
import type { AgentContext } from '@/lib/server/resolve-agent-context';
import { resolveAccessibleCompanyIds } from '@/lib/server/resolve-agent-context';

export const listAgentCompanies = async (agent: Pick<AgentContext, 'userId' | 'allowedCompanyIds'>) => {
  const accessibleIds = await resolveAccessibleCompanyIds(
    agent.userId,
    agent.allowedCompanyIds,
  );
  if (accessibleIds.length === 0) return [];

  return db
    .select({
      id: company.id,
      name: company.name,
      status: company.status,
    })
    .from(company)
    .where(and(inArray(company.id, accessibleIds), isNull(company.deleted_at)))
    .orderBy(company.name);
};

export const listAgentTickets = async (
  agent: AgentContext,
  input: { limit?: number; finished?: boolean | null },
) => {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const conditions = [
    eq(ticket.company_id, agent.companyId),
    isNull(ticket.deleted_at),
    eq(ticket.document_kind, 'ticket'),
  ];
  if (input.finished != null) {
    conditions.push(eq(ticket.finished, input.finished));
  }

  const rows = await db.query.ticket.findMany({
    where: and(...conditions),
    orderBy: [desc(ticket.created_at)],
    limit,
    columns: {
      id: true,
      client_id: true,
      client_name: true,
      ticket_date: true,
      total: true,
      paid: true,
      finished: true,
      company_id: true,
      created_at: true,
    },
  });

  return rows.map(mapAgentTicketSummary);
};

export const getAgentTicket = async (agent: AgentContext, ticketId: bigint) => {
  const row = await db.query.ticket.findFirst({
    where: and(
      eq(ticket.id, ticketId),
      eq(ticket.company_id, agent.companyId),
      isNull(ticket.deleted_at),
      eq(ticket.document_kind, 'ticket'),
    ),
    with: {
      services_tickets: {
        where: isNull(servicesTickets.deleted_at),
        columns: {
          id: true,
          service_id: true,
          quantity: true,
          price: true,
        },
      },
    },
  });

  if (!row) {
    throw new Error('Ticket no encontrado');
  }

  return mapAgentTicketDetail(row);
};

export const createAgentTicket = async (
  agent: AgentContext,
  input: {
    client_name: string;
    client_tel: string;
    client_id?: number;
    email?: string;
    ticket_date?: Date;
  },
) => {
  const values = {
    client_id: input.client_id,
    client_name: input.client_name,
    client_tel: input.client_tel,
    email: input.email ?? null,
    ticket_date: input.ticket_date ?? new Date(),
    company_id: agent.companyId,
    userId: agent.userId,
    document_kind: 'ticket' as const,
  };

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(ticket).values(values).returning();
    const userRow = await db.query.user.findFirst({
      where: eq(user.id, agent.userId),
      with: { company: true },
    });
    await recordTicketAudit(
      tx,
      {
        userId: String(agent.userId),
        companyId: agent.companyId,
        companyIsSystem: userRow?.company?.is_system ?? false,
      },
      row.id,
      agent.companyId,
      'created',
      { ticket: row },
    );
    return row;
  });

  return mapAgentTicketSummary(created);
};

export const updateAgentTicketStatus = async (
  agent: AgentContext,
  ticketId: bigint,
  finished: boolean,
) => {
  const existing = await db.query.ticket.findFirst({
    where: and(
      eq(ticket.id, ticketId),
      eq(ticket.company_id, agent.companyId),
      isNull(ticket.deleted_at),
      eq(ticket.document_kind, 'ticket'),
    ),
  });
  if (!existing) {
    throw new Error('Ticket no encontrado');
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(ticket)
      .set({ finished, updated_at: new Date() })
      .where(
        and(
          eq(ticket.id, ticketId),
          eq(ticket.company_id, agent.companyId),
          isNull(ticket.deleted_at),
        ),
      )
      .returning();

    const userRow = await db.query.user.findFirst({
      where: eq(user.id, agent.userId),
      with: { company: true },
    });

    await recordTicketAudit(
      tx,
      {
        userId: String(agent.userId),
        companyId: agent.companyId,
        companyIsSystem: userRow?.company?.is_system ?? false,
      },
      ticketId,
      agent.companyId,
      'updated',
      { before: existing, after: row, statusChanged: true, finished },
    );
    return row;
  });

  return mapAgentTicketSummary(updated);
};

export const listAgentClients = async (
  agent: AgentContext,
  input: { limit?: number },
) => {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  return db.query.client.findMany({
    where: and(
      eq(client.company_id, agent.companyId),
      isNull(client.deleted_at),
    ),
    orderBy: [desc(client.created_at)],
    limit,
    columns: {
      id: true,
      name: true,
      email: true,
      document: true,
      company_id: true,
      created_at: true,
    },
  });
};

export const listSelectableCompaniesForUser = async (userId: bigint) => {
  const userRow = await db.query.user.findFirst({
    where: and(eq(user.id, userId), isNull(user.deleted_at)),
    with: { company: true },
  });
  if (!userRow?.company || userRow.company.deleted_at) return [];

  if (userRow.company.is_system) {
    return db
      .select({ id: company.id, name: company.name })
      .from(company)
      .where(isNull(company.deleted_at))
      .orderBy(company.name);
  }

  if (userRow.company_id == null) return [];
  const own = await db.query.company.findFirst({
    where: and(eq(company.id, userRow.company_id), isNull(company.deleted_at)),
    columns: { id: true, name: true },
  });
  return own ? [own] : [];
};
