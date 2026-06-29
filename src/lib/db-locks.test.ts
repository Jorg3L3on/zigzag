import { acquireAdvisoryLock, ADVISORY_LOCK_NAMESPACE, toLockKey } from '@/lib/db-locks';

describe('db advisory locks', () => {
  it('maps ids into the signed 32-bit range', () => {
    expect(toLockKey(0)).toBe(0);
    expect(toLockKey(42)).toBe(42);
    expect(toLockKey(42n)).toBe(42);

    const big = 9_000_000_000_000n; // larger than int32
    const key = toLockKey(big);
    expect(key).toBeGreaterThanOrEqual(0);
    expect(key).toBeLessThan(2147483647);
  });

  it('is deterministic for the same id', () => {
    expect(toLockKey(123456789n)).toBe(toLockKey(123456789n));
    expect(toLockKey(123456789)).toBe(toLockKey(123456789n));
  });

  it('executes pg_advisory_xact_lock with namespace and key', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    await acquireAdvisoryLock(
      { execute },
      ADVISORY_LOCK_NAMESPACE.ticketPayment,
      99n,
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
