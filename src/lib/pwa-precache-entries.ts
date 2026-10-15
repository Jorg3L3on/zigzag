/**
 * URLs the service worker precaches on top of what `@serwist/turbopack` already
 * collects on its own (every file under `public/` and the Next static chunks,
 * each with a content-hash revision).
 *
 * Never list a file that lives under `public/` here. Serwist refuses a precache
 * manifest that names the same URL twice with different revisions
 * (`add-to-cache-list-conflicting-entries`), and it throws while the worker
 * script evaluates, so the worker never installs: no push subscriptions, no
 * offline shell (ZIG-15, production 2026-10-15). `pwa-precache-entries.test.ts`
 * guards this list against `public/`.
 */
export const ADDITIONAL_PRECACHE_URLS = [
  '/offline',
  '/favicon.ico',
  '/manifest.webmanifest',
] as const;

export type AdditionalPrecacheEntry = {
  url: (typeof ADDITIONAL_PRECACHE_URLS)[number];
  revision: string;
};

/** The entries for one build, all stamped with the same revision (git SHA). */
export const additionalPrecacheEntries = (
  revision: string,
): AdditionalPrecacheEntry[] =>
  ADDITIONAL_PRECACHE_URLS.map((url) => ({ url, revision }));
