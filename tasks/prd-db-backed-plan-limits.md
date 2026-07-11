# PRD: DB-backed plan limits (entitlements)

**Status:** Published — GitHub issue [#211](https://github.com/Jorg3L3on/zigzag/issues/211)
**Roadmap item:** 1.3 — Move plan limits from code to DB  
**Integration branch:** `feat/db-backed-plan-limits`

## Problem Statement

Zigzag enforces Company resource limits (Users, Clients, Services, Tickets this month) through a hardcoded `PLAN_LIMITS` map keyed by plan slug stored in `Company.settings.plan` JSON. Changing a limit requires a code deploy. System company operators can assign starter / standard / enterprise in the Company form, but limits themselves are not data — they are constants in application code.

This blocks operational flexibility: promotional overrides, per-Customer limit adjustments, grace periods, and future billing integration all need limits to live in the database. Entitlement enforcement, usage calculation, operator console summaries, and the entitlements API already exist — they just read from the wrong source of truth.

## Solution

Introduce a first-class **Plan** catalog in PostgreSQL. Each Company gets a `plan_id` foreign key instead of `settings.plan`. Plan rows store the canonical limit JSON for starter, standard, and enterprise (seeded from today's hardcoded values). System company operators assign a Plan to a Company from the operator console and Company edit flows; optional per-Company limit overrides allow adjusting individual metrics without creating a new Plan row.

All entitlement reads — guard checks, snapshots, API responses, operator summaries — resolve **effective limits** from the database (plan limits merged with Company overrides). Remove the hardcoded `PLAN_LIMITS` object. Migrate existing Companies from `settings.plan` to the matching Plan FK during deployment.

## User Stories

### Plan catalog

1. As a System company user, I want plan limits stored in the database, so that limit changes do not require a deploy.
2. As a System company user, I want starter, standard, and enterprise plans seeded with today's limits, so that existing behavior is preserved after migration.
3. As a tenant user, I want my Company's effective limits to remain stable after migration, so that I am not unexpectedly blocked from creating resources.
4. As an implementer, I want Plan rows identified by a stable slug (`starter`, `standard`, `enterprise`), so that migrations and seeds can reference them deterministically.
5. As an implementer, I want unlimited metrics represented as `null` in limit JSON, so that enterprise semantics stay unchanged.

### Company assignment

6. As a System company user, I want to assign a Plan to a Company from the Company edit form, so that commercial tier is explicit and persisted on the Company row.
7. As a System company user, I want Companies without a legacy `settings.plan` to default to the standard Plan, so that missing data does not break enforcement.
8. As a System company user, I want the operator console Company overview to show the assigned Plan name from the database, so that plan pressure reflects the live catalog.
9. As a System company user, I want to change a Company's Plan from the operator console, so that support can upgrade a tenant without hunting through unrelated settings.
10. As a tenant user, I want the commercial Plan selector hidden on my own Company settings page, so that I cannot self-assign a higher tier.
11. As a System company user, I want Plan assignment changes restricted to System company users with Company write permission, so that tenant admins cannot escalate limits.

### Per-Company overrides

12. As a System company user, I want to override individual limit metrics for a specific Company, so that I can grant a promotional bump without editing the global Plan row.
13. As a System company user, I want overrides to merge on top of the assigned Plan limits, so that only changed metrics differ from the catalog default.
14. As a System company user, I want to clear an override and fall back to the Plan default, so that temporary promotions can be reversed cleanly.
15. As a System company user, I want override edits visible in the operator console entitlement panel, so that support knows whether limits come from Plan or override.
16. As an implementer, I want override shape to match entitlement metrics (`users`, `clients`, `services`, `tickets_month`), so that the resolver stays simple.

### Enforcement

17. As a tenant user creating a Client, I want entitlement denial when my Company is at its effective Client limit, so that plan boundaries are enforced consistently.
18. As a tenant user creating a Service, I want the same enforcement behavior as today, so that the migration is transparent.
19. As a tenant user creating a Ticket, I want monthly ticket limits enforced against effective limits, so that billing tiers remain meaningful.
20. As a System company user operating on a System Company, I want entitlement checks skipped for the platform tenant, so that internal operations are not blocked by limits.
21. As a tenant user blocked by a limit, I want the existing CO011 error and Spanish denial message, so that UX stays consistent.
22. As a tenant user importing Clients or Services in bulk, I want the import to stop at the first limit breach, so that partial over-limit imports cannot occur.
23. As a tenant user, I want entitlement notices on create flows to reflect effective limits from the database, so that UI warnings match enforcement.

### Reads and APIs

24. As a System company user, I want `getCompanyEntitlements` to return plan name and limits from the database, so that dashboard and console panels stay accurate.
25. As a System company user, I want `GET /api/companies/[id]/entitlements` to use the same resolver as Server Actions, so that REST and UI cannot drift.
26. As a System company user, I want Companies list plan badges to use the assigned Plan label, so that list views match operator detail.
27. As an implementer, I want effective-limit resolution cached briefly per Company where reads are hot, so that list pages do not N+1 the Plan table on every row.

### Migration and cleanup

28. As a deployer, I want a Drizzle migration that creates the Plan table and Company `plan_id` FK, so that production schema matches code.
29. As a deployer, I want a data migration that maps each Company's `settings.plan` slug to the corresponding Plan row, so that no manual backfill is required.
30. As a deployer, I want Companies with missing or invalid `settings.plan` to receive the standard Plan, so that migration is safe for legacy rows.
31. As an implementer, I want `settings.plan` removed from the typed Company settings shape after backfill, so that the JSON field is not a second source of truth.
32. As an implementer, I want the hardcoded `PLAN_LIMITS` constant deleted, so that future limits cannot accidentally read stale code.

### Observability and audit

33. As a System company user, I want Plan assignment changes to emit a governance audit event, so that commercial changes are traceable.
34. As a System company user, I want entitlement override changes to emit a governance audit event, so that promotional adjustments are auditable.

### Testing and safety

35. As a maintainer, I want cross-tenant IDOR coverage preserved on entitlements reads, so that the schema change does not weaken isolation.
36. As a maintainer, I want unit tests for effective-limit resolution covering Plan-only, Plan + override, unlimited enterprise, and missing Plan fallback, so that regressions are caught without UI tests.
37. As a maintainer, I want entitlement guard integration tests to load limits from seeded Plan rows, so that create paths prove DB-backed enforcement.

## Implementation Decisions

### Schema

- Add a **`Plan`** table with: serial `id`, unique text `slug` (`starter` | `standard` | `enterprise`), display `name`, JSONB `limits` matching today's four metrics (`users`, `clients`, `services`, `tickets_month` with `number | null`), and `created_at`.
- Add to **`Company`**: nullable-then-NOT NULL `plan_id` FK → `Plan.id` after backfill; optional JSONB `entitlement_limit_overrides` for per-metric overrides (same shape as limits, partial allowed).
- Remove `plan` from **`CompanySettingsJson`** once backfill completes. Do not store plan slug in settings JSON anymore.

Limit JSON shape (decision-rich):

```typescript
type EntitlementLimits = {
  users: number | null;
  clients: number | null;
  services: number | null;
  tickets_month: number | null;
};
// null metric = unlimited (enterprise semantics unchanged)
```

### Deep modules

1. **Plan catalog loader** — Load Plan by id or slug; list active catalog plans for System company selectors. Small interface, rarely changes.
2. **Effective limits resolver** — Input: `plan_id`, optional `entitlement_limit_overrides`, optional fallback slug. Output: `EntitlementLimits` + plan metadata. Pure merge logic (override wins per key when present). This is the main testable core; all enforcement and snapshots call it.
3. **Company plan assignment** — Server Actions for System company: set `plan_id`, set/clear overrides. Validates Plan exists, metrics are non-negative integers or null, and actor has System company + `companies.write`.
4. **Entitlement enforcement adapter** — Refactor existing guard to load Company row, call resolver, then reuse existing `evaluateEntitlement` / usage modules. Usage counting stays unchanged.

### Seed and migration

- Seed three Plan rows with limits copied from current hardcoded values (starter 3/25/25/50, standard 15/200/200/500, enterprise all null).
- Migration steps: create Plan table → seed plans in SQL or follow-up seed script → add `plan_id` + overrides column → backfill from `settings->>'plan'` → set NOT NULL on `plan_id` where safe → strip `plan` key from settings in application reads (optional cleanup migration to remove keys from JSON).
- Default slug when missing/invalid: **`standard`**.

### UI

- **Company form (System company):** Replace `settings.plan` select with Plan catalog select bound to `plan_id`. Keep hidden for tenant self-service edit (`isSelfService`).
- **Operator console Company overview:** Show assigned Plan; add edit control for Plan assignment and per-metric override fields (inline or small dialog). Reuse existing entitlement usage cards; limits column reads effective limits from resolver output.
- **Companies list:** Plan badge reads Plan name via join or snapshot field, not `getCompanyPlanId(settings)`.

### Caching

- Extend existing short-TTL Company cache pattern (`src/lib/cache.ts`) for resolved entitlements or Plan row lookups where operator list renders many Companies. Invalidate on Plan assignment or override mutation.

### Authorization

- Plan catalog reads: System company for management UI; tenant-safe read of **own** Company's effective limits only (existing entitlements action rules).
- Plan assignment and override writes: System company + `companies.write` on target Company id.
- Do not expose Plan CRUD for creating arbitrary new plans in v1 — only seed-defined plans plus per-Company overrides.

### Error handling

- Keep **CO011** for entitlement exceeded. Keep Spanish messages from `entitlementDeniedMessage`.
- New validation errors for invalid override values use existing validation / Company error codes where applicable.

## Testing Decisions

- Test **observable behavior**: effective limits returned, create denied at limit, create allowed under limit, System company bypass — not internal SQL call order.
- **Unit-test the effective limits resolver** extensively: plan only, each override metric, null/unlimited, invalid/missing plan fallback, empty overrides object.
- **Unit-test Plan catalog loader** with seeded fixtures (or mocked db query layer consistent with other action tests).
- **Update `company-entitlements.test.ts`** to source limits from resolver fixtures instead of hardcoded map assumptions.
- **Update entitlement guard tests** (or action tests that mock guard) to prove DB-backed limits block creates — follow prior art in `clients-actions.test.ts`, `tickets-actions.test.ts`, `services-actions.test.ts`.
- **Migration test / script smoke:** verify backfill maps `settings.plan` slugs to correct `plan_id` counts in dev.
- **IDOR:** retain existing cross-tenant tests on `/api/companies/[id]/entitlements` and `getCompanyEntitlements`.
- **Operator / form tests:** Plan select renders for System company; override save calls assignment action; tenant self-service form does not expose Plan selector.
- Reuse patterns from `company-entitlements.test.ts`, `company-operator-summary.test.ts`, `companies-actions.test.ts`, and operator console component tests.

## Out of Scope

- Stripe, subscription lifecycle, invoicing, or automated plan upgrades/downgrades.
- Self-serve signup or public plan selection.
- Admin UI to create/edit/delete Plan catalog rows beyond the three seeded tiers (no generic Plan editor in v1).
- Grace periods, trial windows, or time-bound overrides (overrides are static until changed).
- Historical limit versioning or "what was the limit at time of create" audit replay.
- Changing entitlement metrics (still the existing four: users, clients, services, tickets_month).
- Billing email notifications when approaching limits.

## Further Notes

- Depends on existing entitlement guard, usage calculator, operator console, and Company lifecycle — no parallel enforcement path.
- After shipping, update execution plan task **1.3** to Done and note evidence: schema migration, removed `PLAN_LIMITS`, operator override UI.
- Future billing PRD can reference `Plan.slug` and `Company.plan_id` without another migration.
- Spanish UI labels for plans remain Starter / Standard / Enterprise unless product requests localized tier names.
