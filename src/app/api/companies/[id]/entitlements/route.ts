import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { getCompanyEntitlementUsage } from '@/lib/company-entitlement-usage';
import {
  COMPANY_PLAN_LABELS,
  ENTITLEMENT_METRICS,
  ENTITLEMENT_METRIC_LABELS,
  evaluateEntitlement,
  getCompanyPlanId,
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

    const row = await db.query.company.findFirst({
      where: and(eq(company.id, companyId), isNull(company.deleted_at)),
    });

    if (!row) {
      return fail('CO006', 404, 'validation');
    }

    const plan = getCompanyPlanId(row.settings);
    const usage = await getCompanyEntitlementUsage(companyId);

    return ok({
      plan,
      planLabel: COMPANY_PLAN_LABELS[plan],
      usage,
      metrics: ENTITLEMENT_METRICS.map((metric) => {
        const evaluation = evaluateEntitlement(plan, metric, usage[metric]);
        return {
          metric,
          label: ENTITLEMENT_METRIC_LABELS[metric],
          limit: evaluation.limit,
          usage: evaluation.usage,
          allowed: evaluation.allowed,
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return fail('CO002', 500, 'server');
  }
}
