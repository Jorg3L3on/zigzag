/**
 * Loads env files with the same precedence as Next.js: `.env.local` (gitignored,
 * e.g. a local database copy) wins over `.env`. dotenv never overrides variables
 * already set in the process, so CI and explicit `DATABASE_URL=...` still win.
 *
 * Import it for its side effect, before anything that reads process.env:
 *   import './scripts/load-env.cjs';
 */
require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });
