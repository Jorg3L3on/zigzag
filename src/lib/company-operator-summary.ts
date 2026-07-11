import type { Company, Plan } from '@/db/schema';
import {
  ENTITLEMENT_METRICS,
  ENTITLEMENT_METRIC_LABELS,
  evaluateEntitlement,
  type CompanyPlanId,
  type EntitlementUsage,
} from '@/lib/company-entitlements';
import { resolveEffectiveLimits } from '@/lib/effective-plan-limits';
import {
  assessCompanyReadiness,
  type CompanyReadinessAssessment,
} from '@/lib/company-readiness';
import {
  companyAllowsAuthentication,
  companyLifecycleLabel,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';
import { normalizePlanSlug } from '@/lib/company-effective-limits';

export type EntitlementPressureLevel =
  | 'ok'
  | 'near_limit'
  | 'at_limit'
  | 'unlimited';

const PRESSURE_RANK: Record<EntitlementPressureLevel, number> = {
  at_limit: 3,
  near_limit: 2,
  ok: 1,
  unlimited: 0,
};

export const getEntitlementPressure = (
  limit: number | null,
  usage: number,
): EntitlementPressureLevel => {
  if (limit === null) {
    return 'unlimited';
  }
  if (limit <= 0) {
    return usage > 0 ? 'at_limit' : 'ok';
  }
  const ratio = usage / limit;
  if (ratio >= 1) {
    return 'at_limit';
  }
  if (ratio >= 0.8) {
    return 'near_limit';
  }
  return 'ok';
};

export const worstEntitlementPressure = (
  levels: EntitlementPressureLevel[],
): EntitlementPressureLevel => {
  if (levels.length === 0) {
    return 'ok';
  }
  return levels.reduce((worst, current) =>
    PRESSURE_RANK[current] > PRESSURE_RANK[worst] ? current : worst,
  );
};

const metricHref = (metric: (typeof ENTITLEMENT_METRICS)[number]): string => {
  switch (metric) {
    case 'users':
      return '/users';
    case 'clients':
      return '/clients';
    case 'services':
      return '/services';
    case 'tickets_month':
      return '/tickets';
    default:
      return '/dashboard';
  }
};

export type CompanyOperatorMetricSummary = {
  metric: (typeof ENTITLEMENT_METRICS)[number];
  label: string;
  usage: number;
  limit: number | null;
  allowed: boolean;
  pressure: EntitlementPressureLevel;
  href: string;
};

export type CompanyOperatorSummary = {
  companyId: number;
  name: string;
  email: string;
  phone: string;
  lifecycle: ReturnType<typeof normalizeCompanyLifecycleStatus>;
  lifecycleLabel: string;
  allowsAuthentication: boolean;
  plan: CompanyPlanId;
  planLabel: string;
  planId: number;
  readiness: CompanyReadinessAssessment;
  roleCount: number;
  metrics: CompanyOperatorMetricSummary[];
  overallPressure: EntitlementPressureLevel;
  editHref: string;
};

type CompanyWithPlan = Company & { plan?: Plan | null };

export const buildCompanyOperatorSummary = (
  companyRow: CompanyWithPlan,
  usage: EntitlementUsage,
  roleCount: number,
): CompanyOperatorSummary => {
  const planSlug = normalizePlanSlug(companyRow.plan?.slug);
  const planLabel = companyRow.plan?.name ?? 'Standard';
  const effectiveLimits = resolveEffectiveLimits(
    companyRow.plan?.limits ?? null,
    companyRow.entitlement_limit_overrides,
  );
  const lifecycle = normalizeCompanyLifecycleStatus(companyRow.status);
  const readiness = assessCompanyReadiness(companyRow);

  const metrics: CompanyOperatorMetricSummary[] = ENTITLEMENT_METRICS.map(
    (metric) => {
      const evaluation = evaluateEntitlement(
        effectiveLimits,
        planSlug,
        metric,
        usage[metric],
      );
      return {
        metric,
        label: ENTITLEMENT_METRIC_LABELS[metric],
        usage: evaluation.usage,
        limit: evaluation.limit,
        allowed: evaluation.allowed,
        pressure: getEntitlementPressure(evaluation.limit, evaluation.usage),
        href: metricHref(metric),
      };
    },
  );

  return {
    companyId: companyRow.id,
    name: companyRow.name,
    email: companyRow.email,
    phone: companyRow.phone,
    lifecycle,
    lifecycleLabel: companyLifecycleLabel(companyRow.status),
    allowsAuthentication: companyAllowsAuthentication(companyRow.status),
    plan: planSlug,
    planLabel,
    planId: companyRow.plan_id,
    readiness,
    roleCount,
    metrics,
    overallPressure: worstEntitlementPressure(
      metrics.map((metric) => metric.pressure),
    ),
    editHref: `/companies/${companyRow.id}/edit`,
  };
};
