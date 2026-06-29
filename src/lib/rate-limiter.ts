/**
 * Rate limiting (no Redis).
 *
 * Production runs on Vercel serverless where process memory is per-instance and
 * short-lived, so an in-memory map cannot enforce limits across requests. The
 * distributed backend is Postgres (a fixed-window counter in the `RateLimit`
 * table); an in-memory limiter is kept as a fallback for local development and
 * tests, and as a fail-open path if the database is briefly unreachable.
 *
 * The Postgres backend is used when `NODE_ENV === 'production'` or when
 * `RATE_LIMIT_BACKEND=postgres` is set; otherwise the in-memory limiter is used.
 */
import { logger } from '@/lib/logger';

/** In-memory fixed-window limiter. Used as a fallback and in tests. */
export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> =
    new Map();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number = 100, windowMs: number = 15 * 60 * 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetTime) {
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.limit) {
      return false;
    }

    record.count++;
    return true;
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

// Fallback limiters are cached per window so repeated calls share state.
const fallbackLimiters = new Map<string, RateLimiter>();
const getFallbackLimiter = (options: RateLimitOptions): RateLimiter => {
  const key = `${options.limit}:${options.windowMs}`;
  let limiter = fallbackLimiters.get(key);
  if (!limiter) {
    limiter = new RateLimiter(options.limit, options.windowMs);
    fallbackLimiters.set(key, limiter);
  }
  return limiter;
};

const shouldUsePostgres = (): boolean =>
  process.env.RATE_LIMIT_BACKEND === 'postgres' ||
  process.env.NODE_ENV === 'production';

/**
 * Returns true if the identifier is within the rate limit for this call.
 * Distributed via Postgres when enabled, in-memory otherwise (and as a
 * fail-open fallback if the database call fails).
 */
export const checkRateLimit = async (
  identifier: string,
  options: RateLimitOptions,
): Promise<boolean> => {
  if (!shouldUsePostgres()) {
    return getFallbackLimiter(options).isAllowed(identifier);
  }

  try {
    const { checkRateLimitPg } = await import('@/lib/rate-limit-store');
    return await checkRateLimitPg(identifier, options);
  } catch (error) {
    // Fail open to the in-memory limiter rather than locking everyone out.
    logger.warn('Rate limit store unavailable; using in-memory fallback', {
      error,
    });
    return getFallbackLimiter(options).isAllowed(identifier);
  }
};

/** Clears any stored counter for the identifier (e.g. after a success). */
export const resetRateLimit = async (identifier: string): Promise<void> => {
  for (const limiter of fallbackLimiters.values()) {
    limiter.reset(identifier);
  }
  if (!shouldUsePostgres()) {
    return;
  }
  try {
    const { resetRateLimitPg } = await import('@/lib/rate-limit-store');
    await resetRateLimitPg(identifier);
  } catch (error) {
    logger.warn('Rate limit reset failed', { error });
  }
};

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * Login throttling keyed by both email and client IP, so a single attacker IP
 * cannot spray many accounts and a single account cannot be brute forced.
 */
export const checkLoginRateLimit = async (
  email: string,
  ip: string | null,
): Promise<boolean> => {
  const options: RateLimitOptions = {
    limit: LOGIN_LIMIT,
    windowMs: LOGIN_WINDOW_MS,
  };
  const emailAllowed = await checkRateLimit(`login:email:${email}`, options);
  const ipAllowed = ip
    ? await checkRateLimit(`login:ip:${ip}`, {
        // Allow more attempts per IP than per account (shared NAT, offices).
        limit: LOGIN_LIMIT * 6,
        windowMs: LOGIN_WINDOW_MS,
      })
    : true;
  return emailAllowed && ipAllowed;
};

/**
 * Clear login counters after a successful sign-in. Resets both the per-email and
 * per-IP keys so a legitimate high-volume source (shared office NAT, automated
 * test runner) is not locked out by the per-IP cap after repeated good logins.
 */
export const resetLoginRateLimit = async (
  email: string,
  ip?: string | null,
): Promise<void> => {
  await resetRateLimit(`login:email:${email}`);
  if (ip) {
    await resetRateLimit(`login:ip:${ip}`);
  }
};
