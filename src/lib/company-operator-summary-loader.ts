import { and, count, eq, isNull } from 'drizzle-orm';
import { company, role } from '@/db/schema';
import { getCompanyEntitlementUsage } from '@/lib/company-entitlement-usage';
import {
  buildCompanyOperatorSummary,
  type CompanyOperatorSummary,
} from '@/lib/company-operator-summary';
import { db } from '@/lib/db';

export const loadCompanyOperatorSummary = async (
  companyId: number,
): Promise<CompanyOperatorSummary | null> => {
  const row = await db.query.company.findFirst({
    where: and(eq(company.id, companyId), isNull(company.deleted_at)),
    with: { plan: true },
  });

  if (!row || row.is_system) {
    return null;
  }

  const [usage, [rolesRow]] = await Promise.all([
    getCompanyEntitlementUsage(companyId),
    db
      .select({ total: count() })
      .from(role)
      .where(and(eq(role.company_id, companyId), isNull(role.deleted_at))),
  ]);

  return buildCompanyOperatorSummary(
    row,
    usage,
    Number(rolesRow?.total ?? 0),
  );
};
