# Production Runbook

## Production Target

ZigZag deploys to Vercel with Neon PostgreSQL. Drizzle is the only supported schema, migration, and seed workflow.

## Required Environment

- `DATABASE_URL`: Neon pooled runtime connection string.
- `DIRECT_URL`: Neon direct connection string for migrations.
- `NEXTAUTH_URL`: deployed app URL.
- `NEXTAUTH_SECRET` or `AUTH_SECRET`: secure random secret.
- `NODE_ENV=production`.

Do not enable `ALLOW_MISSING_PERMISSIONS=true` in production.

## Deploy Sequence

1. Confirm `npm run lint`, `npm test -- --runInBand`, `npm run test:e2e`, and `npm run build` pass.
2. Apply migrations with `npm run migrate:deploy`.
3. Deploy the Vercel project from `main`.
4. Visit `/api/health`, `/login`, and `/dashboard`.
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
