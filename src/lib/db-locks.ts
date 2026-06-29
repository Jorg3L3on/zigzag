/**
 * Postgres advisory locks (no Redis) for serializing concurrent mutations.
 *
 * `pg_advisory_xact_lock` takes a transaction-scoped lock that is automatically
 * released on COMMIT/ROLLBACK, so it can only be used inside a transaction. We
 * key ticket-level locks on a stable namespace plus the ticket id to prevent
 * races such as double payment collection.
 */
import { sql } from 'drizzle-orm';

/** Drizzle transaction shape we need: anything with an `execute(sql)` method. */
export type AdvisoryLockExecutor = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

/**
 * Namespace classifier for two-int advisory locks. Keeps unrelated lock
 * families (tickets, exports, ...) from colliding on the same key space.
 */
export const ADVISORY_LOCK_NAMESPACE = {
  ticketPayment: 1,
} as const;

export type AdvisoryLockNamespace =
  (typeof ADVISORY_LOCK_NAMESPACE)[keyof typeof ADVISORY_LOCK_NAMESPACE];

/**
 * Fold a bigint id into the signed 32-bit range Postgres advisory locks accept
 * for their second key. Deterministic so the same id always maps to the same
 * lock key.
 */
export const toLockKey = (id: bigint | number): number => {
  const asBig = typeof id === 'bigint' ? id : BigInt(Math.trunc(id));
  const mod = Number(((asBig % 2147483647n) + 2147483647n) % 2147483647n);
  return mod;
};

/**
 * Acquire a transaction-scoped advisory lock. Blocks until the lock is granted;
 * released automatically when the surrounding transaction ends.
 */
export const acquireAdvisoryLock = async (
  tx: AdvisoryLockExecutor,
  namespace: AdvisoryLockNamespace,
  id: bigint | number,
): Promise<void> => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${namespace}, ${toLockKey(id)})`);
};
