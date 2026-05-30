import type { CompanySettingsJson } from '@/db/schema';

export const COMPANY_PLAN_IDS = ['starter', 'standard', 'enterprise'] as const;

export type CompanyPlanId = (typeof COMPANY_PLAN_IDS)[number];

export const ENTITLEMENT_METRICS = [
  'users',
  'clients',
  'services',
  'tickets_month',
] as const;

export type EntitlementMetric = (typeof ENTITLEMENT_METRICS)[number];

export type EntitlementLimits = Record<EntitlementMetric, number | null>;

export type EntitlementUsage = Record<EntitlementMetric, number>;

export type EntitlementEvaluation = {
  plan: CompanyPlanId;
  metric: EntitlementMetric;
  limit: number | null;
  usage: number;
  allowed: boolean;
};

const PLAN_LIMITS: Record<CompanyPlanId, EntitlementLimits> = {
  starter: {
    users: 3,
    clients: 25,
    services: 25,
    tickets_month: 50,
  },
  standard: {
    users: 15,
    clients: 200,
    services: 200,
    tickets_month: 500,
  },
  enterprise: {
    users: null,
    clients: null,
    services: null,
    tickets_month: null,
  },
};

export const COMPANY_PLAN_LABELS: Record<CompanyPlanId, string> = {
  starter: 'Starter',
  standard: 'Standard',
  enterprise: 'Enterprise',
};

export const ENTITLEMENT_METRIC_LABELS: Record<EntitlementMetric, string> = {
  users: 'usuarios',
  clients: 'clientes',
  services: 'servicios',
  tickets_month: 'tickets este mes',
};

export const getCompanyPlanId = (
  settings: CompanySettingsJson | null | undefined,
): CompanyPlanId => {
  const plan = settings?.plan;
  if (plan && COMPANY_PLAN_IDS.includes(plan)) {
    return plan;
  }
  return 'standard';
};

export const getPlanLimits = (plan: CompanyPlanId): EntitlementLimits =>
  PLAN_LIMITS[plan];

export const evaluateEntitlement = (
  plan: CompanyPlanId,
  metric: EntitlementMetric,
  usage: number,
): EntitlementEvaluation => {
  const limit = PLAN_LIMITS[plan][metric];
  const allowed = limit === null || usage < limit;

  return {
    plan,
    metric,
    limit,
    usage,
    allowed,
  };
};

export const entitlementDeniedMessage = (
  evaluation: EntitlementEvaluation,
): string => {
  if (evaluation.allowed || evaluation.limit === null) {
    return '';
  }

  const metricLabel = ENTITLEMENT_METRIC_LABELS[evaluation.metric];
  const planLabel = COMPANY_PLAN_LABELS[evaluation.plan];

  return `Límite del plan ${planLabel} alcanzado: máximo ${evaluation.limit} ${metricLabel} (actual: ${evaluation.usage}).`;
};
