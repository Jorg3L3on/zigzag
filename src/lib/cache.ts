/**
 * Framework-native caching helpers (no Redis).
 *
 * Built on Next.js' data cache (`unstable_cache`) with tag-based invalidation,
 * plus React `cache()` for per-request deduplication. This gives a read-through
 * cache for hot, staleness-tolerant reads (e.g. dashboard KPIs) keyed and
 * invalidated per company, backed entirely by the framework / Vercel Data Cache.
 *
 * Use `companyCacheTag()` to build a tag, `createCompanyCache()` to wrap a
 * loader, and `invalidateCompanyCache()` (from a mutation) to bust it.
 */
import { revalidateTag, unstable_cache } from 'next/cache';
import { logger } from '@/lib/logger';

/** Cache scopes are coarse, per-company buckets so invalidation stays simple. */
export type CompanyCacheScope = 'dashboard' | 'usage' | 'entitlements';

/** Default time-to-live for cached company reads, in seconds. */
export const DEFAULT_CACHE_TTL_SECONDS = 60;

/**
 * Build the cache tag for a company-scoped read. Pure and deterministic so it
 * can be reused for both caching and invalidation.
 */
export const companyCacheTag = (
  companyId: number | string,
  scope: CompanyCacheScope,
): string => `company:${companyId}:${scope}`;

const stableKeyPart = (value: unknown): string => {
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return String(value);
  }
};

type CompanyLoader<TArgs extends unknown[], TResult> = (
  companyId: number,
  ...args: TArgs
) => Promise<TResult>;

/**
 * Wrap a company-scoped loader in the Next data cache. The returned function has
 * the same signature; results are cached per `(companyId, ...args)` and tagged
 * with `company:{id}:{scope}` so `invalidateCompanyCache` can clear them.
 *
 * Only use this for staleness-tolerant reads (never for auth/entitlement
 * enforcement, which must stay strongly consistent).
 */
export const createCompanyCache = <TArgs extends unknown[], TResult>(
  loader: CompanyLoader<TArgs, TResult>,
  scope: CompanyCacheScope,
  options?: { ttlSeconds?: number },
): CompanyLoader<TArgs, TResult> => {
  const revalidate = options?.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;

  return (companyId: number, ...args: TArgs): Promise<TResult> => {
    const cached = unstable_cache(
      () => loader(companyId, ...args),
      ['company-cache', scope, String(companyId), ...args.map(stableKeyPart)],
      { tags: [companyCacheTag(companyId, scope)], revalidate },
    );
    return cached();
  };
};

/** Invalidate every cached read for a company scope. Call from mutations. */
export const invalidateCompanyCache = (
  companyId: number | string | null | undefined,
  scope: CompanyCacheScope,
): void => {
  if (companyId === null || companyId === undefined) {
    return;
  }
  try {
    // Next 16 `revalidateTag` takes a cache-life profile; `{ expire: 0 }` purges
    // the tag immediately so the next read recomputes. Best-effort: invalidation
    // must never break the mutation that triggered it (e.g. when called outside a
    // request/render context such as a background job).
    revalidateTag(companyCacheTag(companyId, scope), { expire: 0 });
  } catch (error) {
    logger.warn('Cache invalidation failed', { companyId, scope, error });
  }
};
