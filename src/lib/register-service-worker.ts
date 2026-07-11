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
};

/**
 * Register the PWA service worker only in production builds.
 * Dev / Turbopack HMR must not register a SW (aggressive caching breaks HMR).
 */
export const shouldRegisterServiceWorker = (
  env: ServiceWorkerRegistrationEnv = {
    nodeEnv: process.env.NODE_ENV,
  },
): boolean => env.nodeEnv === 'production';
