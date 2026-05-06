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
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPool.pool = pool;
}

export const db = drizzle(pool, { schema });
