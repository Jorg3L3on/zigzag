import './scripts/load-env.cjs';
import { defineConfig } from 'drizzle-kit';
import { enforceSafeDbTarget } from './scripts/db-target-guard.cjs';

// drizzle-kit loads .env (production Neon) before this file, so refuse writes to a remote DB.
enforceSafeDbTarget();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
