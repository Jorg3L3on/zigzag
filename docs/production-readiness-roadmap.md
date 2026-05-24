# Production Readiness Audit and Roadmap

> **Maintainer notes:** Internal roadmap for project owners, not end-user documentation. See [README.md](../README.md) and [production-runbook.md](production-runbook.md) for deployment guidance.

Date: 2026-05-16

This audit turns the current state of ZigZag into an execution roadmap. The app already has a solid base: Next.js App Router, Drizzle + PostgreSQL, NextAuth credentials auth, tenant-scoped resources, server actions, API routes, unit tests for some pure business logic, CI, and a Vercel/Neon deployment path. It is not production ready yet because several controls are incomplete or inconsistent across the stack.

## Product Decisions

These decisions are now treated as roadmap constraints:

- Drizzle replaces Prisma. Drizzle is the canonical ORM, schema, migration, and seed workflow.
- PDF files are not uploaded. Ticket PDFs/invoices should be generated on demand from database state.
- Ticket payments and ticket status changes need immutable audit trails.
- Production hosting target is Vercel + Neon only. No self-hosted deployment path is required right now.

## Production-Ready Definition

ZigZag is production ready when:

- `npm run lint`, `npm test -- --runInBand`, `npm run build`, and the critical E2E suite pass in CI.
- Every read/write path enforces authentication, authorization, tenant scope, and soft-delete rules.
- There is one canonical database/migration workflow, with a repeatable production migration and rollback process.
- Secrets, environment variables, uploads, logging, and error responses are production safe.
- The system has enough tests and monitoring to detect regressions before customers do.
- Operational docs explain deploys, seeding, admin user creation, and incident response.

## Current Verification Snapshot

- `npm run lint`: passed on 2026-05-16.
- `npm test -- --runInBand`: passed on 2026-05-16. Jest now ignores `e2e/`.
- `npm run test:e2e`: passed on 2026-05-16 with 1 passing unauthenticated test and 1 skipped authenticated test because `E2E_EMAIL`/`E2E_PASSWORD` were not set.
- `npm run build`: passed on 2026-05-16.

## Implementation Update: 2026-05-16

Completed in this pass:

- Split Jest and Playwright test execution in config and CI.
- Removed the production PDF upload route.
- Removed the Prisma workflow files and refreshed repository guidance around Drizzle.
- Added Drizzle migration metadata for existing migrations and a new migration for company structured fields plus `TicketAuditEvent`.
- Added ticket audit writes for creation, updates/service changes, finalization, payments, and deletion.
- Patched high-risk tenant filters in user, role, permission, company, client, ticket, ticket-service, and service API paths.
- Made missing permission definitions fail closed.
- Added basic credential login throttling.
- Added production security headers.
- Added `/api/health` and a production runbook.

Still open:

- Authenticated E2E data setup and full critical-path E2E coverage.
- External error tracking/alerting integration.
- A UI/admin surface for ticket audit history.
- Deeper schema normalization for money storage, required tenant ownership, and role/permission uniqueness.

## P0: Blockers Before Any Real Production Launch

### 1. Fix the test runner split

Evidence:

- Fixed on 2026-05-16. Jest ignores `e2e/`, Playwright remains under `npm run test:e2e`, and CI has separate unit and E2E steps.

Work:

- Update `jest.config.js` to ignore `<rootDir>/e2e/`.
- Keep Playwright under `npm run test:e2e`.
- Add CI step for Playwright separately once test data/auth setup exists.

Acceptance criteria:

- `npm test -- --runInBand` only runs Jest tests.
- `npm run test:e2e` only runs Playwright tests.
- CI clearly reports unit and E2E failures separately.

### 2. Finish the Drizzle-only database migration path

Evidence:

- Runtime code uses Drizzle in `src/lib/db.ts` and `src/db/schema.ts`.
- Fixed on 2026-05-16: Prisma workflow files were removed and README/AGENTS/CLAUDE guidance now points to Drizzle.
- Drizzle migration history now includes the existing ticket payment migrations plus a company/audit migration.
- Fixed on 2026-05-24: stale RAG docs and scripts now point to Drizzle, not Prisma.

Risk:

- Historical database backups may still contain `_prisma_migrations` rows from the pre-Drizzle era. Those are archival data only and are not part of the active workflow.

Work:

- Completed: Drizzle owns schema changes, migration generation, production migration deploys, and seeds.
- Completed: README, AGENTS.md, CLAUDE.md, RAG docs, migration scripts, and seed scripts agree on the Drizzle workflow.

Acceptance criteria:

- Drizzle is the only source of truth for schema and migrations.
- `npm run migrate:deploy` applies the same migrations used by production code.
- Onboarding docs no longer mention conflicting workflows.

### 3. Complete multi-tenant authorization coverage

Evidence:

- Tenant scope is enforced in many server actions through `requireActionPermission`.
- Some read actions still return cross-company data after only a permission check, for example `getUsers()` and `getRoles()` list all records.
- API routes and server actions do not share one authorization helper, so behavior can drift.
- Missing permission definitions now fail closed; seed data must include every permission name used in code.

Work:

- Create a tenant authorization checklist for every action and API route.
- Make system-user cross-company access explicit and audited.
- Ensure non-system users can only read/write their own company data.
- Add tests for system user, regular user, wrong company, deleted company/resource, and missing permission.

Acceptance criteria:

- Every DB query involving tenant data has a company filter or an explicit documented system-user exception.
- Cross-company reads/writes are covered by tests.
- Missing permission definitions fail closed in production.

### 4. Remove PDF uploads and generate PDFs on demand

Evidence:

- Fixed on 2026-05-16: `/api/upload` was removed. Ticket PDFs are generated from ticket data by existing PDF export UI.

Work:

- Remove `/api/upload` if it is no longer used.
- Remove any UI paths that upload PDF documents.
- Ensure ticket PDF/invoice generation uses authoritative ticket, company, client, service, payment, and audit data.
- Keep generated PDFs stateless and on demand unless a future business requirement requires persisted signed documents.

Acceptance criteria:

- No production route accepts PDF uploads.
- PDF generation works after deployment without filesystem persistence.
- A user cannot generate or view another tenant's ticket PDF.

### 5. Make production auth and session handling stricter

Evidence:

- Proxy route protection checks only whether a session cookie exists, not whether the session is valid.
- API routes correctly call auth themselves, but page protection can show a protected route request path to stale/invalid cookie holders until server code redirects/fails.
- Credentials auth now has basic per-email throttling.
- `requireSession()` now validates active user/company state against the database.
- Password reset/change flows, auth audit events, and admin lifecycle docs remain open.

Work:

- Decide whether proxy should validate auth or stay lightweight with server-side page guards.
- Add login throttling per email/IP.
- Add password reset/change flows and minimum password rules.
- Add auth audit events for login success/failure, user creation, role changes, and company switching.

Acceptance criteria:

- Stale cookies do not grant access to protected data or protected UI states.
- Repeated credential attacks are rate limited.
- Admin/user lifecycle is documented and tested.

## P1: High-Impact Production Hardening

### 6. Standardize API and server-action error handling

Evidence:

- `handleApiError()` and `handleServerActionError()` exist but are not consistently used.
- Some routes return generic `500`, some leak raw `error.message`, and some server actions hand-roll response shapes.

Work:

- Define one error response contract.
- Use `fail()` / typed action responses consistently.
- Log detailed errors server-side, return safe messages client-side.
- Add request IDs/correlation IDs for debugging production incidents.

Acceptance criteria:

- API clients can rely on one response shape.
- User-facing errors are safe and localized.
- Logs contain enough context to debug without exposing secrets.

### 7. Add production security headers and platform config

Evidence:

- Fixed on 2026-05-16: security headers are configured in `next.config.ts`.

Work:

- Add headers for `X-Frame-Options` or CSP `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a carefully tested Content Security Policy.
- Confirm cookie names/options for production domains.
- Decide whether to self-host fonts to avoid build-time Google Fonts dependency.

Acceptance criteria:

- Security headers are present on app responses.
- CSP works with Next, inline styles/scripts, PDF generation, and third-party assets.
- Production build does not depend on fragile external font fetches unless intentionally accepted.

### 8. Expand automated tests around risky workflows

Current coverage:

- Unit tests exist for utilities, security helper behavior, dashboard metrics, and ticket financials.
- E2E coverage is minimal and authenticated tests are skipped unless `E2E_EMAIL`/`E2E_PASSWORD` are set.

Needed tests:

- Auth: login, invalid login, logout, stale session.
- Tenant boundaries: users from company A cannot access company B resources.
- CRUD: clients, services, tickets, companies, users, roles, permissions.
- Ticket financials: create/update/finalize/payment flows end to end.
- BigInt serialization in API routes.
- Soft-delete filtering everywhere.
- On-demand PDF generation authorization and rendering.
- Immutable ticket audit trail behavior for payments and status changes.

Acceptance criteria:

- CI blocks merges on unit/integration failures.
- E2E suite covers the critical customer path: login, select company, create client, create service, create ticket, finalize ticket, collect payment.

### 9. Add observability

Evidence:

- Errors are mostly `console.error`.
- No structured logging, metrics, uptime checks, or error tracking are configured.

Work:

- Add structured server logging.
- Add error tracking such as Sentry or equivalent.
- Add uptime checks for `/login`, `/dashboard`, and a lightweight API health endpoint.
- Add database connection/pool visibility.

Acceptance criteria:

- Production errors are visible without tailing Vercel logs manually.
- Alerts exist for repeated 500s, auth failures, and database connectivity issues.

### 10. Add immutable ticket audit trails

Evidence:

- Fixed partly on 2026-05-16: `TicketAuditEvent` was added and ticket creation, updates/service changes, finalization, payments, and deletion now write audit events.
- An admin/user-facing audit history view remains open.

Work:

- Add a ticket audit/event table through Drizzle migrations.
- Record events for ticket creation, service changes, finalization, payment collection, status changes, and deletion.
- Include actor user id, company id, ticket id, event type, timestamp, and a structured payload with before/after values where useful.
- Ensure audit events are append-only in application code.
- Decide whether database permissions/triggers are needed to prevent edits/deletes at the database level.

Acceptance criteria:

- Every payment and ticket status transition creates an audit event.
- Existing payment records are never mutated to rewrite history; adjustments are represented as new events/records.
- Ticket detail views or admin tools can inspect audit history.
- Tests prove audit events are created and cannot be bypassed by normal actions/API routes.

## P2: Product and Operational Polish

### 11. Normalize data model decisions

Issues to settle:

- Some resources are soft deleted, some are hard deleted.
- `company_id` is nullable on many tenant-owned models, but production multi-tenancy generally wants required ownership.
- `Role.name` and `Permission.name` are globally unique, which can conflict with per-company roles/permissions.
- Money uses floating point numbers.
- Ticket audit events need durable schema support.

Work:

- Decide per model whether deletion is soft or hard, then align code and docs.
- Make tenant-owned `company_id` required where possible.
- Consider compound uniqueness such as `(company_id, name)` for roles and permissions.
- Consider decimal/cents storage for money.

Acceptance criteria:

- Schema constraints match business rules.
- Runtime checks are backed by database constraints where possible.

### 12. Align docs with current implementation

Evidence:

- README.md, AGENTS.md, and CLAUDE.md now describe Next.js 16, `src/proxy.ts`, and Drizzle.
- Optional RAG docs are synchronized for Drizzle and still carry a stale-doc notice because they are secondary context.

Work:

- Update README, AGENTS.md, deployment docs, and architecture docs.
- Add an operator runbook.
- Add a production launch checklist.

Acceptance criteria:

- A new developer can set up, test, migrate, and deploy without asking which docs are current.

### 13. Improve performance and scalability posture

Work:

- Add pagination to all potentially large tables.
- Avoid loading all users/roles/companies when not needed.
- Review dashboard metrics queries and indexes.
- Use cache helpers only where invalidation is correct and tenant-safe.
- Add database indexes for common filters/searches.

Acceptance criteria:

- Lists remain responsive with realistic production data volume.
- Dashboard query cost is known and acceptable.

### 14. Accessibility and UX production pass

Work:

- Verify keyboard navigation for dialogs, tables, forms, and menus.
- Ensure labels and error messages are accessible.
- Add loading, empty, and offline states to critical flows.
- Test mobile layouts for tables and ticket creation.

Acceptance criteria:

- Core workflows are usable with keyboard and screen reader basics.
- No critical text/layout overlap at mobile and desktop sizes.

## Recommended Execution Order

1. Fix Jest/Playwright split so CI becomes meaningful.
2. Keep the Drizzle-only database path verified as schema changes land.
3. Audit and patch tenant/RBAC gaps in actions and API routes.
4. Remove PDF uploads and verify on-demand PDF generation.
5. Add immutable ticket audit trails.
6. Add missing tests for auth, tenancy, and ticket/payment workflows.
7. Add security headers, auth throttling, and production-safe errors.
8. Add observability and runbooks.
9. Normalize schema constraints and money handling.
10. Expand performance, accessibility, and UX polish.

## Suggested Milestones

### Milestone 1: Trust the Build

- Fix test configuration.
- Make CI green.
- Confirm production build in CI.
- Keep README/AGENTS.md aligned around the Drizzle-only DB workflow.

### Milestone 2: Trust Tenant Boundaries

- Complete route/action authorization matrix.
- Patch cross-company list/read gaps.
- Add tenant isolation tests.
- Fail closed on missing permissions.

### Milestone 3: Trust Production Data

- Canonical migrations.
- Remove upload route and make PDF generation stateless.
- Seed/admin creation guardrails.

### Milestone 4: Trust Operations

- Error tracking.
- Structured logs.
- Health checks.
- Security headers.
- Incident and deploy runbooks.

### Milestone 5: Trust Customer Workflows

- Full critical-path E2E coverage.
- Ticket/payment regression tests.
- Accessibility and responsive QA.
- Performance pass on dashboard and lists.

## Open Questions

- Should regular company admins be allowed to manage users/roles inside only their own company, or is that system-only by design?

Resolved:

- Drizzle replaces Prisma.
- PDF uploads are not allowed; PDFs are generated on demand.
- Ticket payments and status changes need immutable audit trails.
- Production target is Vercel + Neon only.
