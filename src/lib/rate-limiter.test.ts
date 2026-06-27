import {
  checkLoginRateLimit,
  checkRateLimit,
  resetRateLimit,
} from '@/lib/rate-limiter';

describe('distributed rate limiter (in-memory fallback)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows up to the limit then blocks within the window', async () => {
    const id = `test-${Math.random()}`;
    const options = { limit: 2, windowMs: 60_000 };

    await expect(checkRateLimit(id, options)).resolves.toBe(true);
    await expect(checkRateLimit(id, options)).resolves.toBe(true);
    await expect(checkRateLimit(id, options)).resolves.toBe(false);
  });

  it('reset clears the counter', async () => {
    const id = `test-${Math.random()}`;
    const options = { limit: 1, windowMs: 60_000 };

    await expect(checkRateLimit(id, options)).resolves.toBe(true);
    await expect(checkRateLimit(id, options)).resolves.toBe(false);

    await resetRateLimit(id);

    await expect(checkRateLimit(id, options)).resolves.toBe(true);
  });

  it('throttles login attempts per email', async () => {
    const email = `user-${Math.random()}@example.com`;
    const ip = '203.0.113.5';

    let lastAllowed = true;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      lastAllowed = await checkLoginRateLimit(email, ip);
    }

    expect(lastAllowed).toBe(false);
  });
});
