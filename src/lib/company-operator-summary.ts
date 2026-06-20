import type { Company, CompanyLifecycleStatus } from '@/db/schema';
import {
  COMPANY_PLAN_LABELS,
  ENTITLEMENT_METRICS,
  ENTITLEMENT_METRIC_LABELS,
  evaluateEntitlement,
  getCompanyPlanId,
  type EntitlementMetric,
  type CompanyPlanId,
  type EntitlementUsage,
} from '@/lib/company-entitlements';
import {
  assessCompanyReadiness,
  type CompanyReadinessAssessment,
} from '@/lib/company-readiness';
import {
  companyAllowsAuthentication,
  companyLifecycleLabel,
  normalizeCompanyLifecycleStatus,
} from '@/lib/company-lifecycle';

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

const metricHref = (metric: EntitlementMetric): string => {
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
  metric: EntitlementMetric;
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
  lifecycle: CompanyLifecycleStatus;
  lifecycleLabel: string;
  allowsAuthentication: boolean;
  plan: CompanyPlanId;
  planLabel: string;
  readiness: CompanyReadinessAssessment;
  roleCount: number;
  metrics: CompanyOperatorMetricSummary[];
  overallPressure: EntitlementPressureLevel;
  editHref: string;
};

export const buildCompanyOperatorSummary = (
  companyRow: Company,
  usage: EntitlementUsage,
  roleCount: number,
): CompanyOperatorSummary => {
  const plan = getCompanyPlanId(companyRow.settings);
  const lifecycle = normalizeCompanyLifecycleStatus(companyRow.status);
  const readiness = assessCompanyReadiness(companyRow);

  const metrics: CompanyOperatorMetricSummary[] = ENTITLEMENT_METRICS.map(
    (metric) => {
      const evaluation = evaluateEntitlement(plan, metric, usage[metric]);
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
    plan,
    planLabel: COMPANY_PLAN_LABELS[plan],
    readiness,
    roleCount,
    metrics,
    overallPressure: worstEntitlementPressure(
      metrics.map((metric) => metric.pressure),
    ),
    editHref: `/companies/${companyRow.id}/edit`,
  };
};
