import { and, count, eq, gte, isNull } from 'drizzle-orm';
import { client, service, ticket, user } from '@/db/schema';
import { db } from '@/lib/db';
import type { EntitlementMetric, EntitlementUsage } from '@/lib/company-entitlements';

const startOfUtcMonth = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

export const getCompanyEntitlementUsage = async (
  companyId: number,
): Promise<EntitlementUsage> => {
  const monthStart = startOfUtcMonth();

  const [[usersRow], [clientsRow], [servicesRow], [ticketsRow]] =
    await Promise.all([
      db
        .select({ total: count() })
        .from(user)
        .where(
          and(eq(user.company_id, companyId), isNull(user.deleted_at)),
        ),
      db
        .select({ total: count() })
        .from(client)
        .where(
          and(eq(client.company_id, companyId), isNull(client.deleted_at)),
        ),
      db
        .select({ total: count() })
        .from(service)
        .where(
          and(eq(service.company_id, companyId), isNull(service.deleted_at)),
        ),
      db
        .select({ total: count() })
        .from(ticket)
        .where(
          and(
            eq(ticket.company_id, companyId),
            isNull(ticket.deleted_at),
            gte(ticket.created_at, monthStart),
          ),
        ),
    ]);

  return {
    users: Number(usersRow?.total ?? 0),
    clients: Number(clientsRow?.total ?? 0),
    services: Number(servicesRow?.total ?? 0),
    tickets_month: Number(ticketsRow?.total ?? 0),
  };
};

export const getEntitlementUsageForMetric = async (
  companyId: number,
  metric: EntitlementMetric,
): Promise<number> => {
  const usage = await getCompanyEntitlementUsage(companyId);
  return usage[metric];
};
