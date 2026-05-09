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

const pool =
  globalForPool.pool ??
  new Pool({
    connectionString,
    // IPv4; supported by `pg` at runtime but omitted from `PoolConfig` typings.
    family: 4,
  } as ConstructorParameters<typeof Pool>[0]);

if (process.env.NODE_ENV !== 'production') {
  globalForPool.pool = pool;
}

export const db = drizzle(pool, { schema });
