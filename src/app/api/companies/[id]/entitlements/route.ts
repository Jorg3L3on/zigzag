import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { loadCompanyPlanContext } from '@/lib/company-effective-limits';
import { getCompanyEntitlementUsage } from '@/lib/company-entitlement-usage';
import {
  ENTITLEMENT_METRICS,
  ENTITLEMENT_METRIC_LABELS,
  evaluateEntitlement,
} from '@/lib/company-entitlements';
import { db } from '@/lib/db';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const companyId = Number.parseInt(id, 10);
    if (Number.isNaN(companyId)) {
      return fail('CO007', 400, 'validation');
    }

    const { unauthorized } = await requireApiPermission(
      'companies.read',
      companyId,
    );
    if (unauthorized) {
      return unauthorized;
    }

    const planContext = await loadCompanyPlanContext(companyId);
    if (!planContext) {
      return fail('CO006', 404, 'validation');
    }

    const usage = await getCompanyEntitlementUsage(companyId);

    return ok({
      plan: planContext.planSlug,
      planLabel: planContext.planLabel,
      planId: planContext.planId,
      usage,
      metrics: ENTITLEMENT_METRICS.map((metric) => {
        const evaluation = evaluateEntitlement(
          planContext.effectiveLimits,
          planContext.planSlug,
          metric,
          usage[metric],
        );
        return {
          metric,
          label: ENTITLEMENT_METRIC_LABELS[metric],
          limit: evaluation.limit,
          catalogLimit: planContext.catalogLimits[metric],
          usage: evaluation.usage,
          allowed: evaluation.allowed,
          isOverridden: planContext.overriddenMetrics.includes(metric),
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return fail('CO002', 500, 'server');
  }
}
