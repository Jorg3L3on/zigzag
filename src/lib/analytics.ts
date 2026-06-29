/**
 * Server-side product analytics and feature flags via PostHog (free tier).
 *
 * Disabled and no-op when `POSTHOG_KEY` is not configured, so the app runs
 * identically without it. Use `captureServerEvent` for backend events and
 * `isFeatureEnabled` to gate functionality behind a flag.
 */
import { PostHog } from 'posthog-node';
import { logger } from '@/lib/logger';

let client: PostHog | null = null;
let resolved = false;

const getClient = (): PostHog | null => {
  if (resolved) {
    return client;
  }
  resolved = true;

  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return null;
  }

  const host =
    process.env.POSTHOG_HOST ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST ??
    'https://us.i.posthog.com';

  client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  return client;
};

/** Record a backend analytics event. Safe no-op when PostHog is unconfigured. */
export const captureServerEvent = async (
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> => {
  const ph = getClient();
  if (!ph) {
    return;
  }
  try {
    ph.capture({ distinctId, event, properties });
    await ph.flush();
  } catch (error) {
    logger.warn('PostHog capture failed', { event, error });
  }
};

/**
 * Resolve a feature flag for a user. Returns `defaultValue` when PostHog is
 * unconfigured or the lookup fails, so flags fail safe.
 */
export const isFeatureEnabled = async (
  flag: string,
  distinctId: string,
  defaultValue = false,
): Promise<boolean> => {
  const ph = getClient();
  if (!ph) {
    return defaultValue;
  }
  try {
    const result = await ph.isFeatureEnabled(flag, distinctId);
    return result ?? defaultValue;
  } catch (error) {
    logger.warn('PostHog flag lookup failed', { flag, error });
    return defaultValue;
  }
};
