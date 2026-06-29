import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const globalForPool = globalThis as unknown as {
  pool: Pool | undefined;
};

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Pool sizing for serverless. Each Vercel function instance keeps its own pool,
 * so the per-instance `max` must stay small to avoid exhausting Postgres
 * connections under concurrency. Point `DATABASE_URL` at a pooled endpoint
 * (PgBouncer / Neon pooler) in production; `DB_POOL_MAX` overrides the ceiling.
 */
const isProduction = process.env.NODE_ENV === 'production';
const poolMax = toInt(process.env.DB_POOL_MAX, isProduction ? 5 : 10);

const pool =
  globalForPool.pool ??
  new Pool({
    connectionString,
    max: poolMax,
    idleTimeoutMillis: toInt(process.env.DB_POOL_IDLE_MS, 10_000),
    connectionTimeoutMillis: toInt(process.env.DB_POOL_CONNECT_MS, 10_000),
    // IPv4; supported by `pg` at runtime but omitted from `PoolConfig` typings.
    family: 4,
  } as ConstructorParameters<typeof Pool>[0]);

if (process.env.NODE_ENV !== 'production') {
  globalForPool.pool = pool;
}

export const db = drizzle(pool, { schema });
