import { and, eq, isNull } from 'drizzle-orm';

import { company, plan, type Plan } from '@/db/schema';
import { db } from '@/lib/db';
import {
  COMPANY_PLAN_IDS,
  ENTITLEMENT_METRICS,
  type CompanyPlanId,
  type EntitlementLimits,
  type EntitlementMetric,
} from '@/lib/company-entitlements';
import { resolveEffectiveLimits } from '@/lib/effective-plan-limits';

export type LoadedCompanyPlanContext = {
  companyId: number;
  isSystem: boolean;
  planId: number;
  planSlug: CompanyPlanId;
  planLabel: string;
  catalogLimits: EntitlementLimits;
  effectiveLimits: EntitlementLimits;
  overriddenMetrics: EntitlementMetric[];
};

export const normalizePlanSlug = (slug: string | null | undefined): CompanyPlanId => {
  if (slug && COMPANY_PLAN_IDS.includes(slug as CompanyPlanId)) {
    return slug as CompanyPlanId;
  }
  return 'standard';
};

const buildContextFromPlanRow = (
  companyId: number,
  isSystem: boolean,
  planId: number,
  planRow: Plan | null | undefined,
  overrides: Parameters<typeof resolveEffectiveLimits>[1],
): LoadedCompanyPlanContext => {
  const planSlug = normalizePlanSlug(planRow?.slug);
  const catalogLimits = resolveEffectiveLimits(planRow?.limits ?? null, null);
  const effectiveLimits = resolveEffectiveLimits(planRow?.limits ?? null, overrides);
  const overriddenMetrics = ENTITLEMENT_METRICS.filter((metric) =>
    Object.prototype.hasOwnProperty.call(overrides ?? {}, metric),
  );

  return {
    companyId,
    isSystem,
    planId,
    planSlug,
    planLabel: planRow?.name ?? 'Standard',
    catalogLimits,
    effectiveLimits,
    overriddenMetrics,
  };
};

export const loadCompanyPlanContext = async (
  companyId: number,
): Promise<LoadedCompanyPlanContext | null> => {
  const row = await db.query.company.findFirst({
    where: and(eq(company.id, companyId), isNull(company.deleted_at)),
    with: { plan: true },
  });

  if (!row) {
    return null;
  }

  if (!row.plan) {
    const fallbackPlan = await db.query.plan.findFirst({
      where: eq(plan.slug, 'standard'),
    });
    return buildContextFromPlanRow(
      row.id,
      row.is_system,
      row.plan_id,
      fallbackPlan,
      row.entitlement_limit_overrides,
    );
  }

  return buildContextFromPlanRow(
    row.id,
    row.is_system,
    row.plan_id,
    row.plan,
    row.entitlement_limit_overrides,
  );
};
