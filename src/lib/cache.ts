import { unstable_cache } from 'next/cache';

// Cache configuration
const CACHE_TTL = 60 * 5; // 5 minutes
const CACHE_TAG_PREFIX = 'tickets';

export function createCacheKey(
  prefix: string,
  params: Record<string, string | number | boolean>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${params[key]}`)
    .join('|');
  return `${CACHE_TAG_PREFIX}:${prefix}:${sortedParams}`;
}

export function createCacheTag(prefix: string, id?: string | number): string {
  return id
    ? `${CACHE_TAG_PREFIX}:${prefix}:${id}`
    : `${CACHE_TAG_PREFIX}:${prefix}`;
}

// Generic cached function wrapper
export function withCache<T>(
  fn: () => Promise<T>,
  cacheKey: string,
  tags: string[] = [],
  ttl: number = CACHE_TTL,
) {
  return unstable_cache(
    async () => {
      return await fn();
    },
    [cacheKey],
    {
      tags,
      revalidate: ttl,
    },
  );
}

// Cache invalidation helpers
export const cacheTags = {
  dashboard: (companyId: number) => createCacheTag('dashboard', companyId),
  tickets: (companyId: number) => createCacheTag('tickets', companyId),
  clients: (companyId: number) => createCacheTag('clients', companyId),
  services: (companyId: number) => createCacheTag('services', companyId),
  users: (companyId: number) => createCacheTag('users', companyId),
  companies: () => createCacheTag('companies'),
} as const;
