import type { PostHog } from 'posthog-js';

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let clientPromise: Promise<PostHog | null> | null = null;

export const isClientAnalyticsEnabled = (): boolean => Boolean(posthogKey);

/**
 * Load and initialise posthog-js once, after the page is interactive. The
 * library is ~80 kB gzipped, so it is imported lazily instead of shipping in
 * the root layout chunk of every route (ZIG-I20-5).
 */
export const loadPosthog = (): Promise<PostHog | null> => {
  if (!posthogKey || typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  if (!clientPromise) {
    clientPromise = import('posthog-js').then(({ default: posthog }) => {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        capture_pageview: false,
        capture_pageleave: true,
        persistence: 'localStorage+cookie',
      });
      return posthog;
    });
  }
  return clientPromise;
};

/** Install funnel of the PWA (ZIG-I21-4). Names are fixed: dashboards use them. */
export const PWA_INSTALL_EVENTS = {
  prompt: 'pwa_install_prompt',
  accepted: 'pwa_install_accepted',
  dismissed: 'pwa_install_dismissed',
  installed: 'pwa_installed',
} as const;

export type PwaInstallSurface = 'banner' | 'account';

/** Capture a client event; a no-op without `NEXT_PUBLIC_POSTHOG_KEY`. Never throws. */
export const trackClientEvent = (
  event: string,
  properties?: Record<string, unknown>,
): void => {
  if (!posthogKey) return;
  void loadPosthog()
    .then((client) => client?.capture(event, properties))
    .catch(() => {
      // Analytics never breaks the app.
    });
};
