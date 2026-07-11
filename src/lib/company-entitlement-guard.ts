import { loadCompanyPlanContext } from '@/lib/company-effective-limits';
import { getEntitlementUsageForMetric } from '@/lib/company-entitlement-usage';
import {
  entitlementDeniedMessage,
  evaluateEntitlement,
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
  const planContext = await loadCompanyPlanContext(companyId);

  if (!planContext) {
    throw new CompanyEntitlementExceededError(
      'La empresa no existe o no está disponible.',
    );
  }

  if (planContext.isSystem) {
    return;
  }

  const usage = await getEntitlementUsageForMetric(companyId, metric);
  const evaluation = evaluateEntitlement(
    planContext.effectiveLimits,
    planContext.planSlug,
    metric,
    usage,
  );

  if (!evaluation.allowed) {
    throw new CompanyEntitlementExceededError(
      entitlementDeniedMessage(evaluation),
    );
  }
};
