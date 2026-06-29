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
npm run test:e2e                # Playwright E2E (prod build on port 3070; PLAYWRIGHT_USE_DEV=1 for turbopack dev)
npm run lighthouse:mobile       # Lighthouse mobile baseline (prod server on 3070; needs E2E creds)
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

### Mobile & responsive UI
- Dashboard lists use **TanStack Table** on desktop and **card layout** below `md` (768px). See [.cursor/rules/lists-and-responsive-tables.mdc](.cursor/rules/lists-and-responsive-tables.mdc).
- Breakpoint constant: `MOBILE_BREAKPOINT_PX` in `src/lib/breakpoints.ts`; hook: `src/hooks/use-mobile.tsx`.
- Sidebar renders as a **sheet** on narrow viewports (`src/components/ui/sidebar.tsx`).
- **PWA (v1):** `src/app/manifest.ts` — `start_url` `/dashboard`, icons under `public/icons/`. No service worker or offline sync in v1.
- Mobile initiative PRDs and status: [tasks/INDEX.md](tasks/INDEX.md), [tasks/prd-mobile-program-decisions.md](tasks/prd-mobile-program-decisions.md). Manual release checklist: [tasks/mobile-release-checklist.md](tasks/mobile-release-checklist.md). E2E: `npm run test:e2e` (desktop + `mobile-chrome` Pixel 5); mobile-only: `npm run test:e2e:mobile`.

### PDF invoices
- Generated on demand on the server: `GET /api/tickets/[id]/invoice`.
- Payload: `src/lib/fintech-invoice-payload.ts`; renderer: `src/lib/fintech-invoice-renderer.ts`.
- UI download: `src/components/pdf-download-button.tsx` (must not accept uploaded PDFs in production).

### BigInt IDs
`Ticket.id` and `User.id` are BigInt in Drizzle. Convert them before JSON responses with `convertBigIntToString()` from `src/lib/utils.ts`, or a route-local transform helper.

### Delete behavior
- **Soft delete** (`deleted_at` timestamp): User, Company, Ticket, Permission, Client, Service.
- **Role** currently has `deleted_at` but is still hard-deleted in some flows; treat this as a schema/model decision to normalize.
- Always filter soft-deleted resources with `deleted_at: null` / `isNull(model.deleted_at)`.

### Error handling
- API routes should use `ok()`, `fail()`, `requireSession()`, and `requireApiPermission()` from `src/lib/api-helpers.ts` where RBAC applies.
- Server actions should use `handleServerActionError()` or the established `{ success, data?, error?, errorType? }` shape.
- User-facing codes: `src/lib/error-catalog.ts` (55 codes).

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

## Agent skills

Configuration for PRD/issue skills (`start-work`, `prd`, `to-prd`, `to-issues`, `implement-issue`, `fix-bug`, `ship-feature`, `release`, `validate-issues`). Full workflow: [docs/agents/workflow.md](docs/agents/workflow.md). **Vercel:** [docs/agents/deployment.md](docs/agents/deployment.md) — slice PRs merge to `feat/<slug>`; **`main` stays production** (one merge when PRD is done).

### Issue tracker

GitHub Issues on **Jorg3L3on/zigzag** via the `gh` CLI. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

Canonical roles map 1:1 to GitHub labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) plus optional `type:*` labels. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Single-context: **AGENTS.md** (this file) is the primary domain/architecture reference; optional `CONTEXT.md` and `docs/adr/` later. See [docs/agents/domain.md](docs/agents/domain.md).

Dashboard list pages (TanStack table + mobile cards): [.cursor/rules/lists-and-responsive-tables.mdc](.cursor/rules/lists-and-responsive-tables.mdc).

### Deployment (Vercel)

**`main` = production.** Slice PRs merge to **`feat/<feature-slug>`** (previews). One PR **`feat/…` → `main`** when the PRD ships. See [docs/agents/deployment.md](docs/agents/deployment.md).

## Cursor Cloud specific instructions

### Services overview

ZigZag is a multi-tenant ticket management / invoicing app. The only required service is **PostgreSQL 16** (local) and the **Next.js dev server** (`npm run dev`, port 3069).

### Non-obvious gotchas

- **PostgreSQL must be started manually**: Run `sudo pg_ctlcluster 16 main start` before any DB commands. The database name is `zigzag`.
- **Seed user passwords**: The seed script uses pre-existing bcrypt hashes whose plaintext is unknown. To log in locally, update a user's password hash in the DB after seeding: `node -e "require('bcryptjs').hash('YOUR_PASSWORD', 10).then(h => console.log(h))"` then `UPDATE "User" SET password = '<hash>' WHERE email = '<email>';`.
- **DB setup sequence**: After starting PostgreSQL, run `npm run db:migrate` then `npm run seed`. Use `npx drizzle-kit push --force` only if migrations fail to apply cleanly.
