# IDOR cross-tenant audit

**Published:** #184

**Status:** In progress

## Problem Statement

Zigzag is a multi-tenant application where every Company-owned resource must be isolated by `company_id`. Drizzle does not enforce tenant scoping automatically — every query, Server Action, and API route must filter explicitly. AGENTS.md documents that some tables still lack strict `company_id` foreign keys, and the current test suite only partially covers cross-tenant denial (authz helpers and a handful of routes). Without systematic IDOR tests, a tenant user from Company B could read, write, or delete resources owned by Company A through a direct HTTP call or Server Action invocation — and we would not know until production.

The user needs provable cross-tenant isolation: every mutating and reading surface must reject cross-tenant access with `403` or `404`, missing schema constraints must be closed, and CI must block merges when a leak is introduced or a route lacks coverage.

## Solution

Run a full IDOR audit as an epic: build reusable cross-tenant test fixtures, add cross-tenant tests for every protected API route and Server Action, fix any leaks discovered, complete remaining `company_id` foreign keys in the schema, and gate CI on the IDOR test suite. System company users retain intentional cross-tenant access when operating with explicit company context; regular tenant users must always fail closed.

Deliverables include a living audit matrix documenting each route/action, its expected cross-tenant behavior, and test file reference. The epic completes when the matrix shows zero leaks and CI enforces the suite on every PR to `main`.

## User Stories

### Tenant isolation (core)

1. As a non-system user in Company A, I want every API route to reject reads of Company B resources with 403 or 404, so that direct HTTP calls cannot bypass the dashboard.
2. As a non-system user in Company A, I want every API route to reject writes against Company B resources with 403 or 404, so that mutations cannot cross tenant boundaries.
3. As a non-system user in Company A, I want every Server Action to reject reads of Company B data, so that action invocation cannot bypass tenant scoping.
4. As a non-system user in Company A, I want every Server Action to reject writes against Company B data, so that mutations stay within my Company.
5. As a non-system user, I want cross-tenant denial to return the established error shape (`AuthorizationError`, `fail()` codes), so that clients handle failures consistently.
6. As a non-system user, I want list endpoints scoped to my Company only, so that enumeration cannot discover other tenants' IDs.
7. As a non-system user, I want resource-by-ID endpoints to deny access when the ID belongs to another Company, so that ID guessing  cannot succeed even when IDs are guessable.

### System company exception

8. As a System company user, I want cross-tenant access only when I provide explicit company context, so that administration is deliberate.
9. As a System company user, I want cross-tenant reads and writes to succeed for the selected Company, so that platform administration remains possible.
10. As a System company user without selected company context, I want company-scoped operations rejected, so that I do not accidentally operate on the wrong tenant.

### Clients & Services

11. As a non-system user, I want `GET/POST /api/clients` scoped to my Company, so that client lists and creates cannot cross tenants.
12. As a non-system user, I want `GET/PATCH/DELETE /api/clients/[id]` to deny Company B client IDs, so that client detail mutations are tenant-safe.
13. As a non-system user, I want client Server Actions (`getClient`, `createClient`, `updateClient`, `deleteClient`, export/import) to deny cross-tenant IDs, so that the action layer matches API behavior.
14. As a non-system user, I want `GET/POST /api/services` scoped to my Company, so that service catalog access is isolated.
15. As a non-system user, I want `GET/PUT/DELETE /api/services/[id]` to deny Company B service IDs, so that service mutations are tenant-safe.
16. As a non-system user, I want service Server Actions to deny cross-tenant IDs, so that bulk import and export stay scoped.

### Tickets

17. As a non-system user, I want `GET /api/tickets/[id]` to deny Company B ticket IDs, so that ticket detail cannot leak.
18. As a non-system user, I want ticket service line routes to deny cross-tenant ticket or service IDs, so that line-item mutations are isolated.
19. As a non-system user, I want `GET /api/tickets/[id]/invoice` to deny cross-tenant tickets, so that PDF generation cannot leak financial data.
20. As a non-system user, I want ticket Server Actions (create, read, update, delete, finish, payment, audit history) to deny cross-tenant IDs, so that the full ticket workflow is tenant-safe.
21. As a non-system user, I want ticket-services Server Actions to deny cross-tenant ticket or service references, so that line items cannot attach to foreign tickets.

### Users, Roles & Permissions

22. As a non-system user, I want `GET/POST /api/users` to list and create only within my Company, so that user administration stays scoped.
23. As a non-system user, I want user Server Actions to deny cross-tenant user IDs on update/delete, so that account changes cannot cross tenants.
24. As a non-system user, I want role Server Actions to deny creating or updating roles for another Company, so that privilege models stay per-tenant.
25. As a non-system user, I want permission Server Actions to deny assigning permissions from another Company to a role, so that RBAC cannot cross tenant boundaries.

### Companies & operator surfaces

26. As a non-system user, I want company operator routes (`export`, `offboard`, `readiness`, `entitlements`, `operator-summary`, `logo`) to deny access to Company B IDs, so that platform operations cannot be triggered by tenants.
27. As a non-system user, I want company Server Actions (export, offboard, lifecycle, entitlements) to deny cross-tenant company IDs, so that sensitive operations remain root-only and context-scoped.
28. As a non-system user, I want `GET/PUT /api/companies` to expose only my own Company on reads and reject cross-tenant updates, so that company metadata stays isolated.

### Audit, dashboard & remaining actions

29. As a non-system user, I want `GET /api/audit/events` to return only events for my Company (or deny), so that audit history cannot leak across tenants.
30. As a non-system user, I want `GET /api/dashboard/report` scoped to my Company, so that analytics cannot expose another tenant's metrics.
31. As a non-system user, I want dashboard Server Actions to deny cross-tenant company IDs, so that metrics widgets stay scoped.
32. As a non-system user, I want client-service-schedule Server Actions to deny cross-tenant client or service IDs, so that schedules stay within the tenant.
33. As a non-system user, I want trash restore actions to deny cross-tenant deleted resource IDs, so that soft-deleted data cannot be restored across tenants.
34. As a non-system user, I want global search to return only my Company's results, so that search cannot discover foreign resources.
35. As a non-system user, I want notifications scoped to my Company, so that notification reads and marks cannot cross tenants.

### Schema & infrastructure

36. As a maintainer, I want all tenant-owned tables to have `company_id` foreign keys to Company, so that the database rejects orphan or mismatched rows at insert time.
37. As a maintainer, I want remaining NOT VALID constraints validated or documented, so that historical data cleanup status is explicit.
38. As a maintainer, I want a cross-tenant test harness with Company A/B fixtures and session mocks, so that new tests are cheap to write and consistent.
39. As a maintainer, I want an IDOR audit matrix listing every route and action with coverage status, so that gaps are visible at a glance.
40. As a maintainer, I want CI to run the IDOR test suite and fail on regressions, so that merges to `main` cannot reintroduce leaks.
41. As a maintainer, I want public routes (health, auth, cron with secret) documented as exempt from cross-tenant tests, so that intentional public surfaces are distinguishable from gaps.

### Outcomes

42. As a security reviewer, I want the final audit output to show zero cross-tenant data leaks, so that the epic acceptance criterion is met.
43. As a product owner, I want Security score to reach 10/10 on tenant isolation, so that go-live confidence is justified.

## Implementation Decisions

- Reuse existing authz primitives: `resolveWritableCompanyId`, `requireSystemUser`, `requireApiPermission`, `requireActionPermission`, `tenantScope`, `assertTenantOwnership`.
- Extend `assertTenantOwnership` usage in code paths that fetch by primary key without an explicit company filter — fix leaks at source, not only in tests.
- Cross-tenant tests use two fixture companies (Company A id=10, Company B id=20) with distinct users holding equivalent permissions; tests assert tenant B session cannot access tenant A resource IDs.
- Expected denial status: `403` when auth/permission denies; `404` when resource not found under tenant scope (prefer not leaking existence — match existing route behavior).
- System company tests are separate: verify allowed cross-tenant access with explicit `company_id` query/body param, and denial without context.
- Schema: add missing FKs for `TicketAuditEvent.company_id`, `GovernanceAuditEvent.company_id`, and any junction tables lacking tenant linkage where applicable. Follow migration `0014` pattern (NOT VALID if needed).
- Public exemptions: `GET /api/health`, NextAuth routes, cron routes with bearer secret — document in audit matrix, no cross-tenant test required.
- `GET /api/realtime` — verify tenant scoping on SSE channel or document as session-scoped.
- Test location: colocated `*.test.ts` next to routes/actions; shared fixtures in `src/test/idor-fixtures.ts` (or similar).
- Audit matrix: `docs/idor-audit-matrix.md` updated each slice; final slice verifies 100% coverage.
- CI: add `npm run test:idor` script targeting IDOR tests; run in existing CI job (unit test step) with optional dedicated coverage check script.

## Testing Decisions

- Tests assert external behavior only: HTTP status + error code for routes; `{ success: false }` or thrown `AuthorizationError` for actions — not internal query shapes.
- Mock `auth()` / `requireApiPermission` where routes are unit-tested in isolation (prior art: `src/app/api/tickets/[id]/route.test.ts`); integration-style tests optional for high-risk paths.
- Each cross-tenant test names the scenario: `"denies Company B user reading Company A <resource>"`.
- Prior art: `src/lib/idor.test.ts`, `src/lib/security.test.ts`, `src/lib/tenant.test.ts`, `src/app/api/tickets/[location/[id]/route.test.ts`.
- Coverage gate: audit matrix script or test meta-suite fails if a route/action file lacks a `cross-tenant` or `IDOR` describe block (final slice).
- No E2E required for this epic — unit/integration tests sufficient unless a leak only reproduces in browser (fix and add unit test).

## Out of Scope

- Penetration testing or external security audit vendor engagement.
- Rate limiting, CSRF, or injection testing (separate security workstreams).
- UI-level IDOR (hiding buttons) — server enforcement is authoritative.
- Changing the System company administration model.
- Validating NOT VALID FK constraints on production data (document manual step only).
- Service worker / PWA offline tenant isolation.

## Further Notes

- Epic integration branch: `feat/idor-cross-tenant-audit`.
- Slice order: foundation → domain surfaces (clients/services, tickets, users/RBAC, companies/operator, remaining) → CI gate and zero-leak sign-off.
- Any leak found during a slice must be fixed in that slice before merge — do not defer fixes to a later "hardening" slice.
- Link to SECURITY.md cross-tenant scope statement and AGENTS.md multi-tenancy section when updating docs.
