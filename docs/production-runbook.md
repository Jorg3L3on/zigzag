# Production Runbook

## Production Target

ZigZag deploys to Vercel with Neon PostgreSQL. Drizzle is the only supported schema, migration, and seed workflow.

## Required Environment

- `DATABASE_URL`: Neon pooled runtime connection string.
- `DIRECT_URL`: Neon direct connection string for migrations.
- `NEXTAUTH_URL`: deployed app URL.
- `NEXTAUTH_SECRET` or `AUTH_SECRET`: secure random secret.
- `NODE_ENV=production`.

## Git branches and Vercel

**Production Branch = `main`** (default). Merging to `main` deploys production.

Slice work uses a **feature integration branch** (`feat/<feature-slug>`) so incomplete PRDs do not hit prod. See [agents/deployment.md](agents/deployment.md).

| Branch | Role |
| ------ | ---- |
| `feat/<feature-slug>` | Slice PRs merge here (Vercel previews) |
| `main` | Production; merge the feature branch when the PRD is complete |

## Deploy Sequence (production)

1. Confirm `npm run lint`, `npm test -- --runInBand`, `npm run test:e2e`, and `npm run build` pass on the feature branch (or `main` after merge).
2. Apply migrations with `npm run migrate:deploy` against the **production** database if schema changed.
3. Merge **`feat/<feature-slug>` → `main`** (one production deploy for the whole feature).
4. Visit production `/api/health`, `/login`, and `/dashboard`.
5. Run one CRUD smoke test for clients, services, and tickets.

## Rollback

1. Roll back the Vercel deployment to the previous successful build.
2. If a migration caused the incident, restore the latest Neon backup or apply a reviewed forward-fix migration.
3. Re-run `/api/health` and the CRUD smoke test.

## Incident Response

1. Check Vercel logs for request errors and `[HEALTH_CHECK]`, `[auth]`, or route-specific log prefixes.
2. Check Neon availability, connection limits, and recent migration history.
3. Disable affected credentials or users if auth abuse is suspected.
4. Preserve ticket/payment audit data; do not edit or delete `TicketAuditEvent` rows during triage.
