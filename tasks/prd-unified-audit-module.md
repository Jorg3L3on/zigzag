# PRD: Unified audit module

**Status:** Published — GitHub issue [#127](https://github.com/Jorg3L3on/zigzag/issues/127)

**Evidence:** `TicketAuditEvent` and `GovernanceAuditEvent` in schema; `recordTicketAudit` in ticket Server Actions; `recordGovernanceAudit` in governance-audit library; partial coverage documented in production-readiness roadmap and RBAC audit matrix.

## Problem Statement

Zigzag records some operational history today, but that history is split across two domain-specific audit tables with no unified read model, no system-wide console, and large gaps in coverage. A System company operator cannot answer basic accountability questions—who signed in, who was denied access, who changed a Client, who generated an invoice—in one place. Ticket payments and governance changes are logged in separate shapes, authentication and permission failures are not logged at all, and Client and Service mutations are invisible to audit.

The user needs a single, append-only audit trail that records who did what, when, from which Company, on which resource, and with what result, visible only to System company users.

## Solution

Introduce a unified audit module built around one canonical append-only event store, a single recording API used by all mutation and security paths, and a System company-only dashboard for searching and inspecting events. Existing Ticket and governance audit writes continue during a transition period via dual-write so no history is lost; historical rows are backfilled into the unified store. The module covers authentication, authorization failures, CRUD across tenant resources, Ticket financial events, invoice and export generation, and company offboarding—without exposing the audit console to non-system users.

## User Stories

1. As a System company user, I want a single audit log across all Companies, so that I can investigate platform activity without querying multiple tables or logs.
2. As a System company user, I want to see who performed each action, so that I can attribute changes to a specific User.
3. As a System company user, I want to see which Company the actor belonged to at the time of the action, so that I can distinguish root cross-tenant operations from tenant-user activity.
4. As a System company user, I want to see which Company owned the affected resource, so that I can filter and investigate tenant-specific incidents.
5. As a System company user, I want to see when each event occurred, so that I can reconstruct timelines during support or compliance review.
6. As a System company user, I want to see what resource type and resource identifier were affected, so that I can drill into a specific Ticket, Client, User, or Company.
7. As a System company user, I want to see whether each attempt succeeded, was denied, or failed, so that I can detect unauthorized access patterns and failed logins.
8. As a System company user, I want to filter audit events by target Company, so that I can focus on one tenant without noise from others.
9. As a System company user, I want to filter audit events by actor User, so that I can review everything a specific administrator did.
10. As a System company user, I want to filter audit events by resource type, so that I can review only Tickets, Clients, authentication events, etc.
11. As a System company user, I want to filter audit events by action type, so that I can find all deletions, permission denials, or payment collections quickly.
12. As a System company user, I want to filter audit events by result (success, denied, failed), so that I can prioritize security-relevant outcomes.
13. As a System company user, I want to filter audit events by date range, so that I can investigate incidents within a known window.
14. As a System company user, I want paginated results with stable ordering, so that large tenants do not overwhelm the UI or API.
15. As a System company user, I want to expand an event to view structured payload details, so that I can see before/after values and contextual metadata without raw database access.
16. As a System company user, I want successful sign-in events recorded, so that I know when Users authenticate.
17. As a System company user, I want failed sign-in attempts recorded, so that I can detect brute-force or credential-stuffing patterns.
18. As a System company user, I want sign-out events recorded, so that session lifecycle is traceable.
19. As a System company user, I want Ticket creation recorded in the unified log, so that new work items appear in the global audit trail.
20. As a System company user, I want Ticket updates recorded in the unified log, so that field and service changes are traceable.
21. As a System company user, I want Ticket soft-deletion recorded in the unified log, so that removals are not silent.
22. As a System company user, I want Ticket finalization recorded in the unified log, so that status transitions are visible.
23. As a System company user, I want Ticket payment collection recorded in the unified log, so that financial changes remain accountable alongside existing Ticket audit requirements.
24. As a System company user, I want Client creation, update, and soft-deletion recorded, so that catalog changes are traceable.
25. As a System company user, I want Service creation, update, and soft-deletion recorded, so that catalog changes are traceable.
26. As a System company user, I want Company creation, update, and soft-deletion recorded, so that tenant lifecycle is traceable.
27. As a System company user, I want Company logo upload and removal recorded, so that branding changes are traceable.
28. As a System company user, I want Company export generation recorded, so that data portability actions are traceable.
29. As a System company user, I want Company offboarding recorded, so that destructive tenant operations are traceable.
30. As a System company user, I want User creation, update, and soft-deletion recorded, so that account administration is traceable.
31. As a System company user, I want Role creation, update, and deletion recorded, so that privilege structure changes are traceable.
32. As a System company user, I want Role permission changes recorded, so that access grants and revocations are traceable.
33. As a System company user, I want Permission creation, update, and deletion recorded, so that the permission catalog is traceable.
34. As a System company user, I want Permission assignment to and removal from Roles recorded, so that RBAC wiring is traceable.
35. As a System company user, I want permission-denied attempts recorded when a User lacks required access, so that probing or misconfiguration is visible.
36. As a System company user, I want invoice PDF generation recorded, so that document downloads are traceable.
37. As a System company user, I want dashboard report PDF generation recorded, so that export-style reads are traceable.
38. As a System company user, I want audit navigation visible only in my dashboard sidebar, so that regular tenant Users are not exposed to platform-wide history.
39. As a non-system user, I want the audit API and pages blocked, so that I cannot read other Companies' activity.
40. As a non-system user, I want my actions to still be recorded in the unified log, so that System company operators can investigate tenant behavior even though I cannot see the log myself.
41. As an implementer, I want one recording function with a stable input contract, so that new features add audit coverage consistently.
42. As an implementer, I want a closed catalog of resource types, actions, and results, so that event names stay consistent across Server Actions and API routes.
43. As an implementer, I want payload sanitization to strip secrets (passwords, tokens), so that audit storage does not become a credential leak vector.
44. As an implementer, I want BigInt and Date values normalized in payloads, so that JSON storage and API responses remain stable.
45. As an implementer, I want dual-write from existing Ticket and governance recorders during migration, so that legacy tables and the unified store stay aligned.
46. As an implementer, I want a backfill path for existing Ticket and governance audit rows, so that historical data appears in the unified console.
47. As an implementer, I want audit recording to run in the same database transaction as the business mutation when feasible, so that events are not orphaned from the changes they describe.
48. As an implementer, I want audit write failures logged server-side without blocking primary business operations in v1, so that a broken audit insert does not prevent Ticket payment or User updates.
49. As an implementer, I want Server Actions and API routes that perform the same mutation to both record audit events, so that direct HTTP calls cannot bypass accountability.
50. As a maintainer, I want append-only semantics documented and enforced in application code, so that audit rows are never updated or deleted through normal flows.
51. As a maintainer, I want indexes supporting common query filters, so that the System audit console remains usable as volume grows.
52. As a maintainer, I want regression tests proving System-only read access, so that future changes do not expose the audit log to tenant Users.
53. As a maintainer, I want regression tests proving representative mutations create audit rows, so that instrumentation cannot be removed silently.
54. As a product owner, I want the audit list to follow existing dashboard list patterns (desktop table, mobile cards), so that the feature feels consistent with Tickets, Clients, and Companies lists.
55. As a product owner, I want deep links from an audit row to the related resource where possible, so that investigation requires fewer manual lookups.
56. As a System company user investigating a Ticket, I want to filter unified audit events by Ticket resource id, so that I see all related activity in one view.
57. As a System company user, I want cross-company root actions flagged in payload metadata, so that I can distinguish acting-as-root from acting within the root Company tenant.
58. As a System company user, I want failed login events to avoid storing raw passwords, so that security review does not introduce new risk.
59. As a System company user, I want throttled login attempts distinguished from invalid credentials in failed login payloads, so that I can tell abuse from typos.
60. As a maintainer, I want company export bundles to continue including legacy audit tables until explicitly migrated, so that portability workflows remain complete during transition.

## Implementation Decisions

### Canonical audit store

- Add a new append-only `AuditEvent` table (name may follow existing PascalCase table naming in Drizzle) as the unified write and read target.
- Core columns: `occurred_at`, `actor_user_id` (nullable for anonymous failed login), `actor_company_id` (nullable), `target_company_id` (nullable), `resource_type`, `resource_id` (text), `action`, `result`, `source`, `payload` (jsonb), optional `request_meta` (jsonb for route, method, ip, user_agent when available).
- `result` is a closed enum: `success`, `denied`, `failed`.
- `source` is a closed enum: `auth`, `action`, `api`.
- Index for time-ordered listing, target Company + time, actor User + time, and resource type + resource id.

### Deep module: audit recorder

- Single entry point (e.g. `recordAuditEvent`) accepts actor context, target Company, resource identity, action, result, source, payload, and optional request metadata.
- Validates action and resource type against a closed catalog module.
- Reuses existing sanitization patterns: strip password and remember_token from User snapshots; normalize BigInt and Date via shared JSON helper (consolidate duplicate helpers currently split between ticket and governance paths).
- Supports participating in an open Drizzle transaction when the caller already has one.
- On insert failure: log structured server error; do not throw to callers in v1 (business operation completes).

### Deep module: audit catalog

- Closed lists of `resource_type`, `action`, and `result` values documented in one module.
- Initial resource types: `auth`, `ticket`, `client`, `service`, `company`, `user`, `role`, `permission`, `invoice`, `export`, `report`, `security`.
- Initial actions include: `signed_in`, `signed_out`, `sign_in_failed`, `created`, `updated`, `deleted`, `finished`, `payment_collected`, `logo_uploaded`, `logo_removed`, `permissions_changed`, `permission_assigned`, `permission_removed`, `export_generated`, `offboarded`, `generated`, `permission_denied`.
- Catalog is the single source of truth for valid event names; recorder rejects or no-ops unknown combinations in development/test.

### Migration and dual-write

- Keep `TicketAuditEvent` and `GovernanceAuditEvent` during transition; refactor their recorders to delegate to the unified recorder (dual-write).
- Provide a one-time backfill script copying historical rows from both legacy tables into `AuditEvent` with mapped resource types and actions.
- Map legacy ticket event types directly; map governance resource types and event types directly; set `source` to a legacy marker or `action`/`api` based on best available inference.
- Company export bundles continue to include legacy audit tables until a later explicit migration removes them.

### Instrumentation points

- **Authentication:** Record success and sign-out via NextAuth events/callbacks; record failed attempts inside credentials authorize (invalid password, missing user, throttled, inactive Company) without storing passwords.
- **Permission denied:** Central hook in API permission helper and equivalent Server Action permission checks; record `security.permission_denied` with permission name, error code, route/method when available; include actor when session exists.
- **Tickets:** Existing events (created, updated, deleted, finished, payment_collected) dual-written to unified store.
- **Governance:** Existing company, user, role, permission, export, offboard events dual-written.
- **Clients and Services:** Add recording on create, update, soft-delete in Server Actions and matching API routes.
- **Invoice PDF:** Record successful generation on ticket invoice API route after authorization passes.
- **Dashboard report PDF:** Record successful generation on dashboard report API route after authorization passes.

### Access control

- Read access restricted to System company users via existing `requireSystemUser` pattern (session `company_is_system` validated against persisted Company data on API reads).
- No dedicated `audit.read` permission in v1; System company membership is the sole gate for UI and API.
- Write access only through server-side recorder; no public create/update/delete API for audit rows.

### Query API and UI

- `GET` audit events API for System company users only; supports filters: target Company, actor User, resource type, resource id, action, result, date range; keyset or cursor pagination; default sort newest first.
- Dashboard page at a dedicated audit route; sidebar entry visible only when `company_is_system` is true.
- Desktop: TanStack Table; mobile: card layout per existing list conventions.
- Row expansion shows formatted payload; sensitive keys redacted in display layer as well as storage.

### Payload conventions

- Mutations: `{ before, after, actor, cross_company, ...extra }` aligned with existing governance payload shape.
- Auth failed: `{ reason, email_or_hash }` — store normalized email or HMAC of email with server secret; never password.
- Permission denied: `{ permission, error_code, route, method }`.
- Payments: preserve existing payment amount structure in payload.

### Request metadata (optional v1)

- Capture ip and user_agent where easily available (API routes, auth flows); omit if middleware wiring is deferred without blocking the rest of the module.

## Testing Decisions

- Tests assert external behavior: given an authenticated System company user, listing audit events succeeds; given a non-system user, listing returns forbidden; given a mutation or denied access, a corresponding audit row exists with expected action, result, resource, and sanitized payload.
- Do not test internal call graphs of the recorder; test that representative flows produce correct rows.
- Unit-test the audit catalog validation and payload sanitization (BigInt, Date, password stripping).
- Unit-test the recorder insert shape and non-throwing failure behavior.
- Integration-test dual-write: ticket finish and governance user update create both legacy and unified rows.
- Integration-test auth failed and success produce unified rows without secrets in payload.
- Integration-test permission denied on a protected API route produces a denied result row.
- Integration-test Client/Service CRUD via Server Action and API both audit.
- Integration-test invoice and dashboard report generation audit on success.
- Access tests: System-only API and page guard; prior art from `security.test.ts`, `api-helpers.test.ts`, and RBAC coverage tests.
- Backfill script: smoke test on fixture data counts and sample mapped rows.
- Use Jest with `--runInBand` for database-touching tests; follow existing action and API test patterns.

## Out of Scope

- Tenant-visible audit history on Ticket detail or Company settings for non-system users.
- Real-time streaming, webhooks, or SIEM integrations.
- Audit event editing, deletion, or admin "purge" UI.
- Database triggers or PostgreSQL RLS for append-only enforcement at the DB layer (application-level append-only only in v1).
- New `audit.read` permission and role assignment UI.
- Capturing full request/response bodies for all API calls.
- Audit of read-only list/page views except invoice and dashboard report generation explicitly listed above.
- Replacing NextAuth, Drizzle, or migration workflow.
- External error tracking (Sentry) as a substitute for this product audit log.
- Automatic retention expiry job (document policy only in v1; implement purge later).
- Service worker / offline audit buffering for PWA.

## Further Notes

- Aligns with AGENTS.md production constraint that Ticket payments and status changes require immutable audit events; unified module extends that accountability model platform-wide without weakening Ticket audit requirements.
- Cross-company root actions should set `cross_company: true` in payload when actor is System company and target Company differs from actor Company, matching existing governance audit payload convention.
- After ship, update the RBAC audit matrix developer doc to include the audit read API and page guards.
- Feature integration branch: `feat/unified-audit`; slice PRs merge there; one PR to `main` when complete per deployment docs.
- Spanish UI copy for the audit dashboard should follow existing dashboard terminology (Usuario, Empresa, Ticket, etc.).
