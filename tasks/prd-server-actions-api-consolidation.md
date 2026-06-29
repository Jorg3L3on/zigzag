# PRD: Server Actions vs API routes consolidation

**Status:** Draft  
**Integration branch:** `feat/server-actions-api-consolidation`  
**Roadmap item:** 1.2 — Consolidate Server Actions vs API routes (pick one per resource)  
**Impact:** API consistency 6 → 9

## Problem Statement

Zigzag mutations for core resources (Tickets, Clients, Services, Users, Companies) exist in both `src/actions/` (Server Actions) and `src/app/api/` (REST routes). A bug fixed in one layer can remain in the other, doubling IDOR attack surface, test burden, and maintenance cost. Some UI pages still call REST for reads and writes (e.g. Services edit uses `fetch` to `/api/services` for create/update) while other flows use Server Actions exclusively.

## Solution

Establish **Server Actions as the canonical mutation path** for all UI-driven changes. Retain API routes only where an external or non-React consumer genuinely needs them: cron jobs, webhooks, health checks, NextAuth, binary/streaming downloads (PDF invoices, dashboard report PDF, company export bundles), and realtime endpoints. Remove duplicate mutation handlers from REST routes once UI and tests are migrated. Document the policy in AGENTS.md and update the RBAC audit matrix.

## User Stories

1. As a developer, I want each core resource to have exactly one mutation path, so that fixes and RBAC checks cannot drift between layers.
2. As a developer, I want UI pages to use Server Actions for create/update/delete, so that the dashboard follows one data-access pattern.
3. As a security reviewer, I want duplicate REST mutation routes removed, so that IDOR surface area is halved for tenant-owned resources.
4. As a developer, I want API routes reserved for cron/webhook/streaming consumers, so that the purpose of each route is obvious.
5. As a developer, I want AGENTS.md to document the canonical pattern, so that new features do not reintroduce duplication.
6. As a non-system user, I want Client mutations via Server Actions only, so that REST cannot bypass dashboard RBAC for Clients.
7. As a non-system user, I want Service mutations via Server Actions only, so that the Services edit page no longer posts to `/api/services`.
8. As a non-system user, I want Ticket and ticket-service mutations via Server Actions only, so that line-item changes cannot bypass action-layer audit hooks.
9. As a non-system user, I want User mutations via Server Actions only, so that account management has a single enforcement path.
10. As a System company user, I want Company lifecycle mutations via Server Actions only, so that operator flows match the RBAC matrix.
11. As a developer, I want RBAC coverage tests updated when routes are removed, so that CI fails if a new duplicate path appears.
12. As a developer, I want existing unit and integration tests to pass after consolidation, so that RBAC regressions are caught before merge.
13. As a developer, I want the RBAC audit matrix to list only intentional API surfaces, so that documentation matches production routes.
14. As a developer, I want UI read paths migrated off REST where Server Actions already exist, so that edit pages do not mix patterns unnecessarily.
15. As a developer, I want ticket invoice PDF generation to remain on `GET /api/tickets/[id]/invoice`, so that browser download semantics stay unchanged.
16. As a developer, I want dashboard report PDF to remain on `GET /api/dashboard/report`, so that export behavior is preserved.
17. As a developer, I want cron notification/job routes unchanged, so that scheduled work is not broken.
18. As a developer, I want company export/logo/offboard operator routes evaluated explicitly, so that each is either migrated to Server Actions or documented as a kept API exception with rationale.
19. As a QA engineer, I want IDOR tests moved or retained on kept routes only, so that cross-tenant coverage is not lost.
20. As a developer, I want dead route files and tests removed after migration, so that the repo has no orphaned mutation handlers.

## Implementation Decisions

### Canonical policy

- **Mutations (create, update, delete, finish, payment, soft-delete):** Server Actions only for UI and in-app server callers.
- **Reads in dashboard:** Prefer Server Actions; REST GET may remain temporarily for streaming/binary or be removed when an action exists.
- **Kept API routes (non-exhaustive):** `auth`, `health`, `cron/*`, `realtime`, ticket invoice PDF, dashboard report PDF, company export bundle (binary download), audit events list (System company read API until migrated).

### Deep modules

1. **Mutation policy module (docs + static test):** Extend `rbac-coverage.test.ts` or add a small test that asserts no duplicate HTTP mutation exports exist for consolidated resources.
2. **Per-resource migration:** Each slice migrates UI callers, deletes REST mutation handlers, updates matrix and tests.

### Per-resource scope

| Resource | Remove REST mutations | Migrate UI off REST | Keep REST reads (if any) |
| -------- | --------------------- | ------------------- | ------------------------ |
| Clients | POST, PATCH, DELETE | Edit/list if using fetch | Optional GET until reads migrated |
| Services | POST, PUT, DELETE | Services edit page (known) | Optional GET until reads migrated |
| Tickets | None on ticket root if read-only | Ticket edit fetch | GET ticket detail optional |
| Ticket services | POST, PUT, DELETE on nested routes | Ticket services UI if using fetch | GET list optional |
| Users | POST (create) | N/A if already action-only | GET list for sidebar/legacy |
| Companies | POST, PUT on collection route | Sidebar company list if needed | Operator sub-routes reviewed per slice |

### Order

Clients → Services → Tickets/ticket-services → Users → Companies → docs/matrix cleanup.

## Testing Decisions

- Test **observable behavior**: permission denied, wrong company, success shapes — not internal routing.
- Reuse IDOR fixture patterns from `src/app/api/*/route.test.ts` and action tests under `src/lib/*-actions.test.ts`.
- After removing a route, delete or relocate its route tests; add action tests if coverage gap.
- Run `npm run lint`, `npm test -- --runInBand`, `npm run build` per slice.
- Verify `rbac-coverage.test.ts` still passes and reflects removed surfaces.

## Out of Scope

- New public REST API for external integrators.
- Roles and Permissions REST routes (not listed in acceptance criteria; follow same pattern only if duplicate mutations exist).
- Audit module completion PRD (separate epic).
- Full IDOR audit epic (#184) — but do not remove IDOR tests without equivalent action coverage.
- Migrating `GET /api/audit/events` to Server Actions (separate if desired).

## Further Notes

- AGENTS.md already warns about dual layers; this PRD makes Server Actions canonical and removes duplicates.
- `src/app/(app)/services/[id]/edit/page.tsx` is a known REST mutation caller to fix early.
- Company operator routes (logo upload, offboard) may stay REST if they use multipart/streaming; document each exception.
