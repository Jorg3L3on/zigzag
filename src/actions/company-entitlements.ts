'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { company } from '@/db/schema';
import { db } from '@/lib/db';
import { getCompanyEntitlementUsage } from '@/lib/company-entitlement-usage';
import {
  COMPANY_PLAN_LABELS,
  ENTITLEMENT_METRICS,
  ENTITLEMENT_METRIC_LABELS,
  evaluateEntitlement,
  getCompanyPlanId,
  type EntitlementMetric,
} from '@/lib/company-entitlements';
import {
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import { requireActionAuth, requireActionPermission } from '@/lib/security';

export type CompanyEntitlementSnapshot = {
  plan: ReturnType<typeof getCompanyPlanId>;
  planLabel: string;
  usage: Awaited<ReturnType<typeof getCompanyEntitlementUsage>>;
  metrics: Array<{
    metric: EntitlementMetric;
    label: string;
    limit: number | null;
    usage: number;
    allowed: boolean;
  }>;
};

export async function getCompanyEntitlements(companyId: number): Promise<{
  success: boolean;
  data?: CompanyEntitlementSnapshot;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('companies.read', companyId);
    const authContext = await requireActionAuth();

    if (
      !authContext.companyIsSystem &&
      authContext.companyId !== companyId
    ) {
      return buildActionError('AU002');
    }

    const row = await db.query.company.findFirst({
      where: and(eq(company.id, companyId), isNull(company.deleted_at)),
    });

    if (!row) {
      return buildActionError('CO006');
    }

    const plan = getCompanyPlanId(row.settings);
    const usage = await getCompanyEntitlementUsage(companyId);
    const metrics = ENTITLEMENT_METRICS.map((metric) => {
      const evaluation = evaluateEntitlement(plan, metric, usage[metric]);
      return {
        metric,
        label: ENTITLEMENT_METRIC_LABELS[metric],
        limit: evaluation.limit,
        usage: evaluation.usage,
        allowed: evaluation.allowed,
      };
    });

    return {
      success: true,
      data: {
        plan,
        planLabel: COMPANY_PLAN_LABELS[plan],
        usage,
        metrics,
      },
    };
  } catch (error) {
    return handleCodedServerActionError('companies.entitlements', 'CO002', error);
  }
}
