import { and, count, eq, isNull } from 'drizzle-orm';
import { company, role } from '@/db/schema';
import {
  buildCompanyOperatorSummary,
  type CompanyOperatorSummary,
} from '@/lib/company-operator-summary';
import {
  loadLastSignInByCompany,
  loadNeverSignedInCount,
  loadPeopleCountByCompany,
  loadSecurityAlertsByCompany,
  loadStatusSinceByCompany,
} from '@/lib/company-operator-facts-loader';
import { normalizeCompanyLifecycleStatus } from '@/lib/company-lifecycle';
import { db } from '@/lib/db';

export const loadCompanyOperatorSummary = async (
  companyId: number,
  now: Date = new Date(),
): Promise<CompanyOperatorSummary | null> => {
  const row = await db.query.company.findFirst({
    where: and(eq(company.id, companyId), isNull(company.deleted_at)),
  });

  if (!row || row.is_system) {
    return null;
  }

  const ids = [companyId];
  const [rolesRow, people, lastSignIn, alerts, statusSince, neverSignedIn] = await Promise.all([
    db
      .select({ total: count() })
      .from(role)
      .where(and(eq(role.company_id, companyId), isNull(role.deleted_at)))
      .then((rows) => rows[0]),
    loadPeopleCountByCompany(ids),
    loadLastSignInByCompany(ids),
    loadSecurityAlertsByCompany(ids, now),
    loadStatusSinceByCompany([
      { id: companyId, status: normalizeCompanyLifecycleStatus(row.status) },
    ]),
    loadNeverSignedInCount(companyId),
  ]);

  return buildCompanyOperatorSummary(
    row,
    Number(rolesRow?.total ?? 0),
    {
      peopleCount: people.get(companyId) ?? 0,
      lastSignInAt: lastSignIn.get(companyId) ?? null,
      alert: alerts.get(companyId) ?? null,
      statusSince: statusSince.get(companyId) ?? null,
    },
    now,
    neverSignedIn,
  );
};
