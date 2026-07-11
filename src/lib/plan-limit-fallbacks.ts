import type { EntitlementLimits } from '@/lib/company-entitlements';

/** Matches seeded standard plan limits; used only when Plan row is missing. */
export const STANDARD_FALLBACK_LIMITS: EntitlementLimits = {
  users: 15,
  clients: 200,
  services: 200,
  tickets_month: 500,
};
