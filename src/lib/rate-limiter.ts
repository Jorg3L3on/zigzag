/**
 * Rate limiting.
 *
 * Production runs on Vercel serverless where process memory is per-instance and
 * short-lived, so an in-memory map cannot enforce limits across requests. When
 * an Upstash Redis / Vercel KV REST endpoint is configured this module uses it
 * (fixed window via INCR + EXPIRE); otherwise it falls back to an in-memory
 * limiter suitable for local development and tests.
 *
 * Supported env vars (either pair works):
 *   - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   - KV_REST_API_URL + KV_REST_API_TOKEN  (Vercel KV)
 */

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

type RedisRestConfig = {
  url: string;
  token: string;
};

const getRedisRestConfig = (): RedisRestConfig | null => {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return null;
  }
  return { url: url.replace(/\/$/, ''), token };
};

const redisCommand = async (
  config: RedisRestConfig,
  command: (string | number)[],
): Promise<{ result: unknown } | null> => {
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as { result: unknown };
  } catch {
    return null;
  }
};

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

/**
 * Returns true if the identifier is within the rate limit for this call.
 * Distributed when Redis/KV is configured, in-memory otherwise.
 */
export const checkRateLimit = async (
  identifier: string,
  options: RateLimitOptions,
): Promise<boolean> => {
  const config = getRedisRestConfig();
  if (!config) {
    return getFallbackLimiter(options).isAllowed(identifier);
  }

  const key = `ratelimit:${identifier}`;
  const windowSeconds = Math.ceil(options.windowMs / 1000);

  const incr = await redisCommand(config, ['INCR', key]);
  if (!incr) {
    // If Redis is unreachable, fail open to the in-memory limiter rather than
    // locking everyone out.
    return getFallbackLimiter(options).isAllowed(identifier);
  }

  const count = Number(incr.result ?? 0);
  if (count === 1) {
    await redisCommand(config, ['EXPIRE', key, windowSeconds]);
  }

  return count <= options.limit;
};

/** Clears any stored counter for the identifier (e.g. after a success). */
export const resetRateLimit = async (identifier: string): Promise<void> => {
  const config = getRedisRestConfig();
  if (!config) {
    getFallbackLimiter({ limit: 0, windowMs: 0 });
    for (const limiter of fallbackLimiters.values()) {
      limiter.reset(identifier);
    }
    return;
  }
  await redisCommand(config, ['DEL', `ratelimit:${identifier}`]);
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

export const resetLoginRateLimit = async (email: string): Promise<void> => {
  await resetRateLimit(`login:email:${email}`);
};
