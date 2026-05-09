/**
 * Fix SERIAL/BIGSERIAL sequences after rows were inserted with explicit ids.
 * Run: npx tsx scripts/sync-postgres-sequences.ts
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const TABLES_WITH_EXPLICIT_IDS_IN_SEED = [
  'Company',
  'Service',
  'Ticket',
  'ServicesTickets',
  'User',
] as const;

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function main() {
  for (const table of TABLES_WITH_EXPLICIT_IDS_IN_SEED) {
    await db.execute(
      sql.raw(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id')::regclass, (SELECT MAX(id) FROM "${table}"))`,
      ),
    );
    console.log(`Synced sequence for "${table}"`);
  }
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });
