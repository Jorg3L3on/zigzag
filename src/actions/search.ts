'use server';

import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { client, service, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { checkPermission, requireActionAuth } from '@/lib/security';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';

export type GlobalSearchResultType = 'ticket' | 'client' | 'service';

export type GlobalSearchResult = {
  type: GlobalSearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const PER_TYPE_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;

/**
 * Cross-resource search scoped to the caller's company. Each resource group is
 * only included when the user holds the corresponding read permission, so the
 * results never leak data the user could not otherwise see.
 */
export async function globalSearch(query: string): Promise<{
  success: boolean;
  data?: GlobalSearchResult[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return { success: true, data: [] };
    }

    const context = await requireActionAuth();
    if (!context.companyId) {
      return { success: true, data: [] };
    }
    const companyId = context.companyId;
    const pattern = `%${trimmed}%`;

    const [canTickets, canClients, canServices] = await Promise.all([
      checkPermission(context.userId, companyId, 'tickets.read'),
      checkPermission(context.userId, companyId, 'clients.read'),
      checkPermission(context.userId, companyId, 'services.read'),
    ]);

    const results: GlobalSearchResult[] = [];

    if (canTickets) {
      const tickets = await db
        .select()
        .from(ticket)
        .where(
          and(
            eq(ticket.company_id, companyId),
            isNull(ticket.deleted_at),
            or(
              ilike(ticket.client_name, pattern),
              ilike(ticket.email, pattern),
              ilike(ticket.document, pattern),
            ),
          ),
        )
        .orderBy(desc(ticket.created_at))
        .limit(PER_TYPE_LIMIT);

      for (const row of tickets) {
        results.push({
          type: 'ticket',
          id: row.id.toString(),
          title: `Ticket #${row.id} · ${row.client_name ?? 'Sin cliente'}`,
          subtitle: row.email ?? null,
          href: `/tickets/${row.id}`,
        });
      }
    }

    if (canClients) {
      const clients = await db
        .select()
        .from(client)
        .where(
          and(
            eq(client.company_id, companyId),
            isNull(client.deleted_at),
            or(
              ilike(client.name, pattern),
              ilike(client.email, pattern),
              ilike(client.phone, pattern),
              ilike(client.document, pattern),
            ),
          ),
        )
        .orderBy(desc(client.created_at))
        .limit(PER_TYPE_LIMIT);

      for (const row of clients) {
        results.push({
          type: 'client',
          id: String(row.id),
          title: row.name,
          subtitle: row.email ?? row.phone ?? null,
          href: `/clients/${row.id}/edit`,
        });
      }
    }

    if (canServices) {
      const services = await db
        .select()
        .from(service)
        .where(
          and(
            eq(service.company_id, companyId),
            isNull(service.deleted_at),
            or(
              ilike(service.name, pattern),
              ilike(service.description, pattern),
            ),
          ),
        )
        .orderBy(desc(service.created_at))
        .limit(PER_TYPE_LIMIT);

      for (const row of services) {
        results.push({
          type: 'service',
          id: String(row.id),
          title: row.name,
          subtitle: row.description ?? null,
          href: `/services/${row.id}/edit`,
        });
      }
    }

    return { success: true, data: results };
  } catch (e) {
    return handleCodedServerActionError('search.global', 'GN001', e);
  }
}
