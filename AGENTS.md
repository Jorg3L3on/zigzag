# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Next.js with Turbopack on port 3069
npm run build        # Production build
npm run lint         # ESLint

# Database: Drizzle is canonical
npm run db:generate      # Generate SQL migrations from src/db/schema.ts
npm run db:migrate       # Apply pending local migrations
npm run migrate:deploy   # Apply production migrations with DIRECT_URL when set
npm run db:studio        # Open Drizzle Studio
npm run seed             # Seed through scripts/seed.ts

# Testing
npm test                        # Jest unit/integration tests
npm test -- --runInBand         # CI-style Jest run
npm run test:watch              # Watch mode
npm run test:coverage           # Coverage report
npm run test:e2e                # Playwright E2E tests in e2e/
```

> **Database:** PostgreSQL. Use a `postgresql://...` URL in `DATABASE_URL`; production migrations should prefer `DIRECT_URL`. The database name in examples is **`zigzag`**.

## Architecture

### Multi-tenancy
Every resource (Ticket, Client, Service, User, Role, Permission) is scoped by `company_id`. All DB queries must filter by `company_id` explicitly; Drizzle does not enforce this automatically. Users with `company.is_system = true` are super-admins with explicit cross-company access.

### Two data-access layers
- **Server Actions** (`src/actions/`) are the primary way UI pages mutate data.
- **API Routes** (`src/app/api/`) are RESTful endpoints and must call auth helpers themselves.

Several resources have logic in both layers. When editing, be careful not to fix one and miss the other.

### Authentication & session
- NextAuth v5 (beta) uses JWT sessions with a CredentialsProvider.
- Configured in `src/lib/auth.ts`.
- Session types are extended in `src/types/next-auth.d.ts` with `id`, `company_id`, `company_name`, and `company_is_system`.
- `src/proxy.ts` protects `/` and `/dashboard/**` at the routing edge. API routes are excluded from proxy and must call `auth()` or `requireSession()`.

### Company selection
`src/contexts/company-context.tsx` stores the selected company in React state and localStorage. This is separate from the session's `company_id`; system users can switch context between companies.

### BigInt IDs
`Ticket.id` and `User.id` are BigInt in Drizzle. Convert them before JSON responses with `convertBigIntToString()` from `src/lib/utils.ts`, or a route-local transform helper.

### Delete behavior
- **Soft delete** (`deleted_at` timestamp): User, Company, Ticket, Permission, Client, Service.
- **Role** currently has `deleted_at` but is still hard-deleted in some flows; treat this as a schema/model decision to normalize.
- Always filter soft-deleted resources with `deleted_at: null` / `isNull(model.deleted_at)`.

### Error handling
- API routes should use `ok()`, `fail()`, and `requireSession()` from `src/lib/api-helpers.ts`.
- Server actions should use `handleServerActionError()` or the established `{ success, data?, error?, errorType? }` shape.

### Production constraints
- Drizzle is the only schema, migration, and seed workflow.
- PDF files are generated on demand from ticket data; production routes must not accept uploaded PDFs.
- Ticket payments and status changes require immutable audit events in `TicketAuditEvent`.

## Key files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle schema and row types |
| `drizzle/` | SQL migrations applied by Drizzle |
| `drizzle.config.ts` | Drizzle Kit configuration |
| `src/lib/db.ts` | Drizzle database client singleton |
| `src/lib/auth.ts` | NextAuth config, JWT/session callbacks |
| `src/lib/errors.ts` | Error classes and API/action error handlers |
| `src/lib/security.ts` | Input sanitization, rate limiter, permission checks |
| `src/lib/api-helpers.ts` | API response and DB-backed session helpers |
| `src/proxy.ts` | Route protection |
| `src/contexts/company-context.tsx` | Selected company state + localStorage |
| `scripts/seed.ts` | Initial Drizzle seed data |
