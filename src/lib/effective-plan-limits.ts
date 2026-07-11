import type {
  EntitlementLimitOverridesJson,
  PlanLimitsJson,
} from '@/db/schema';

import {
  ENTITLEMENT_METRICS,
  type EntitlementLimits,
} from '@/lib/company-entitlements';
import { STANDARD_FALLBACK_LIMITS } from '@/lib/plan-limit-fallbacks';

export const resolveEffectiveLimits = (
  planLimits: PlanLimitsJson | null | undefined,
  overrides: EntitlementLimitOverridesJson | null | undefined,
): EntitlementLimits => {
  const base = planLimits ?? STANDARD_FALLBACK_LIMITS;

  return ENTITLEMENT_METRICS.reduce<EntitlementLimits>((limits, metric) => {
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, metric)) {
      limits[metric] = overrides[metric] ?? null;
      return limits;
    }

    limits[metric] = base[metric] ?? null;
    return limits;
  }, {} as EntitlementLimits);
};
