/**
 * Production-only service worker registration helpers.
 *
 * Cache strategy (see `src/app/sw.ts`):
 * - Precache / cache-first: `_next/static`, fonts, icons, offline shell page
 * - Network-only: `/api/**`, auth, Server Actions, RSC flight requests
 * - Navigations: network-first with offline fallback to `/offline`
 */

export const SERWIST_SW_URL = '/serwist/sw.js';
export const SERWIST_SCOPE = '/';

export type ServiceWorkerRegistrationEnv = {
  nodeEnv: string | undefined;
  /** Set in Playwright / CI to avoid SW cache leaking across E2E tests. */
  disableServiceWorker?: string | undefined;
};

/**
 * Register the PWA service worker only in production builds.
 * Dev / Turbopack HMR must not register a SW (aggressive caching breaks HMR).
 * Playwright sets `NEXT_PUBLIC_DISABLE_SERVICE_WORKER=1` so tests stay isolated.
 */
export const shouldRegisterServiceWorker = (
  env: ServiceWorkerRegistrationEnv = {
    nodeEnv: process.env.NODE_ENV,
    disableServiceWorker: process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER,
  },
): boolean => {
  if (env.disableServiceWorker === '1' || env.disableServiceWorker === 'true') {
    return false;
  }

  return env.nodeEnv === 'production';
};
