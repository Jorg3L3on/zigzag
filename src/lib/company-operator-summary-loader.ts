import { and, count, eq, isNull } from 'drizzle-orm';
import { company, role } from '@/db/schema';
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
  });

  if (!row || row.is_system) {
    return null;
  }

  const [rolesRow] = await db
    .select({ total: count() })
    .from(role)
    .where(and(eq(role.company_id, companyId), isNull(role.deleted_at)));

  return buildCompanyOperatorSummary(row, Number(rolesRow?.total ?? 0));
};
