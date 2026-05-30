import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { db } from '@/lib/db';
import { getEntitlementUsageForMetric } from '@/lib/company-entitlement-usage';
import {
  entitlementDeniedMessage,
  evaluateEntitlement,
  getCompanyPlanId,
  type EntitlementMetric,
} from '@/lib/company-entitlements';
import { AppError } from '@/lib/errors';

export class CompanyEntitlementExceededError extends AppError {
  constructor(message: string) {
    super(message, 403, true, 'CO011');
  }
}

export const assertCompanyEntitlementAllows = async (
  companyId: number,
  metric: EntitlementMetric,
): Promise<void> => {
  const row = await db.query.company.findFirst({
    where: and(eq(company.id, companyId), isNull(company.deleted_at)),
  });

  if (!row) {
    throw new CompanyEntitlementExceededError(
      'La empresa no existe o no está disponible.',
    );
  }

  if (row.is_system) {
    return;
  }

  const plan = getCompanyPlanId(row.settings);
  const usage = await getEntitlementUsageForMetric(companyId, metric);
  const evaluation = evaluateEntitlement(plan, metric, usage);

  if (!evaluation.allowed) {
    throw new CompanyEntitlementExceededError(
      entitlementDeniedMessage(evaluation),
    );
  }
};
