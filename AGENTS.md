# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

ZigZag is a multi-tenant ticket management / invoicing app. The only required service is **PostgreSQL 16** (local) and the **Next.js dev server** (`npm run dev`, port 3069).

### Quick reference

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (port 3069, Turbopack) |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Seed DB | `npm run seed` |
| DB push (dev) | `npx drizzle-kit push --force` |

See `CLAUDE.md` and `README.md` for full command list.

### Non-obvious gotchas

- **Drizzle schema vs migrations drift**: The Drizzle schema (`src/db/schema.ts`) includes columns (e.g. `street`, `status`, `settings` on `Company`; `paid` on `Ticket`) that are **not** covered by the committed migration files in `drizzle/`. For local dev, use `npx drizzle-kit push --force` instead of `npm run db:migrate` to sync the database with the current schema. The `db:migrate` path will leave the DB missing columns and cause seed/runtime failures.
- **PostgreSQL must be started manually**: Run `sudo pg_ctlcluster 16 main start` before any DB commands. The database name is `zigzag`.
- **Seed user passwords**: The seed script uses pre-existing bcrypt hashes whose plaintext is unknown. To log in locally, update a user's password hash in the DB after seeding: `node -e "require('bcryptjs').hash('YOUR_PASSWORD', 10).then(h => console.log(h))"` then `UPDATE "User" SET password = '<hash>' WHERE email = '<email>';`.
- **Jest picks up Playwright files**: The `e2e/` directory contains Playwright tests that Jest tries to run, causing one test-suite failure. This is a known config issue in the repo; the 4 Jest suites (15 tests) pass.
- **ORM is Drizzle, not Prisma**: Despite `CLAUDE.md` referencing Prisma commands and a legacy `prisma/` directory, the active ORM is Drizzle (`src/db/schema.ts`, `drizzle.config.ts`). Use `drizzle-kit` commands, not `prisma` commands.
