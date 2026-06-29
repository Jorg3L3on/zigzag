/**
 * Feature flags. Resolution order:
 *   1. Environment override `FLAG_<NAME>` ("true"/"false") — useful for CI,
 *      local toggles, and kill switches without a PostHog round-trip.
 *   2. PostHog feature flag for the given user (free tier).
 *   3. `defaultValue` (fail-safe) when neither is set.
 */
import { isFeatureEnabled } from '@/lib/analytics';

const envKey = (flag: string): string =>
  `FLAG_${flag.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

export const isFlagEnabled = async (
  flag: string,
  distinctId: string,
  defaultValue = false,
): Promise<boolean> => {
  const override = process.env[envKey(flag)];
  if (override === 'true') {
    return true;
  }
  if (override === 'false') {
    return false;
  }
  return isFeatureEnabled(flag, distinctId, defaultValue);
};
