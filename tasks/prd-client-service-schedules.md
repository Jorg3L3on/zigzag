# PRD: Client Service Schedules (Recordatorios de servicio)

## Problem Statement

Field-service Companies perform recurring work for the same Client and Service (for example, fumigation every two months). Today Zigzag only records completed Tickets; it does not remember when the next visit is due per Client and per Service. Staff must rely on memory, spreadsheets, or external calendars, which leads to missed follow-ups, uneven revenue, and extra coordination cost.

## Solution

Introduce **Client service schedules**: one active reminder rule per Company + Client + Service pair, with a stored interval and **next due date**. The product **reminds** staff (due soon, overdue, and later schedules)—it does **not** auto-create Tickets or send external notifications in v1.

Staff set or update schedules mainly when **finishing a Ticket** (opt-out for existing pairs, opt-in for new pairs), and manage all schedules on a dedicated **“Recordatorios de servicio”** page (add, edit, pause, delete). A compact **dashboard widget** shows urgent items (due within 14 days and overdue) with a link to the full list. From the management page, staff can open **Ticket create** with Client and Service pre-filled (manual save only).

Spanish product copy; existing RBAC permissions; full **Company** scoping and soft-delete conventions.

## User Stories

1. As a Company user with `tickets.read`, I want a sidebar entry “Recordatorios de servicio”, so that I can open the schedule management page.
2. As a Company user, I want the management page to list all active schedules for my Company, so that I see every Client + Service pair we track.
3. As a Company user, I want to filter schedules by **Próximos** (due within 14 days), **Atrasados**, **Programados** (due later than 14 days), **Pausados**, and **Todos**, so that I can focus on what needs action today.
4. As a Company user, I want each row to show Client name, Service name, interval, last service date, and next due date, so that I understand the cadence at a glance.
5. As a Company user with `tickets.write` or `clients.write`, I want to add a new schedule by choosing Client, Service, interval, and optional dates, so that I can plan reminders without finishing a Ticket first.
6. As a Company user, I want only one schedule per Client + Service pair, so that conflicting reminders do not appear.
7. As a Company user, when I add a schedule for a pair that already exists, I want to edit the existing row instead of creating a duplicate, so that data stays consistent.
8. As a Company user, I want interval presets (1, 2, 3, 6, 12 meses, 1 año) plus **Personalizado** (number + months or days), so that common cadences are fast to enter.
9. As a Company user, I want **Personalizado** to support months and days (not weeks in v1), so that flexible intervals are covered without an overly complex UI.
10. As a Company user, I want to edit interval and dates on the management page, so that I can correct mistakes.
11. As a Company user, I want to **pause** a schedule, so that a Client who asked to wait does not appear in urgent lists.
12. As a Company user, I want to **resume** a paused schedule, so that reminders return when work should restart.
13. As a Company user, I want to optionally record why a schedule is paused, so that my team has context (field optional in v1).
14. As a Company user, I want to soft-delete a schedule with confirmation, so that mistaken entries can be removed.
15. As a Company user finishing a Ticket with `tickets.write`, I want a **Recordatorios** step when marking the Ticket finished, so that the next visit is scheduled in the same workflow.
16. As a Company user, I want each Ticket service line to appear in that step with a checkbox and interval controls, so that I can schedule per Service on the Ticket.
17. As a Company user, I want lines for Client + Service pairs that **already have** a schedule checked by default, so that recurring Customers roll forward with one confirmation.
18. As a Company user, I want lines for **new** Client + Service pairs unchecked by default, so that one-off jobs do not create accidental schedules.
19. As a Company user, I want only checked lines to create or update schedules, so that unchecked lines leave the database unchanged.
20. As a Company user, I want the default **last service** date to be the Ticket’s `ticket_date`, so that the anchor matches when the job was performed.
21. As a Company user, I want to override the last service date when finishing or editing, so that office finish date vs field date can be corrected.
22. As a Company user, I want **next due** computed as last service + interval (calendar months for month intervals), so that “every 2 months” matches business expectations.
23. As a Company user, I want early or late visits to roll **next due** from the confirmed last service date, so that the cadence follows actual work, not an old slot.
24. As a Company user, I want finishing a Ticket to upsert the schedule row for each checked line, so that repeat visits update the same reminder.
25. As a Company user, I want a dashboard widget showing **Próximos** and **Atrasados** counts or rows, so that I see urgency without opening the full page.
26. As a Company user, I want **Ver todos** on the widget to open the management page, so that I can act from the full list.
27. As a Company user, I want **Crear ticket** on management page rows (not on the widget), so that I can start a new Ticket with Client and Service pre-selected while still saving manually.
28. As a Company user, I want paused schedules excluded from Próximos and Atrasados unless I filter **Todos** or **Pausados**, so that paused Clients do not clutter urgent views.
29. As a Company user, I want schedules for soft-deleted Clients or Services auto-paused (or otherwise inactive), so that reminders do not reference deleted catalog rows.
30. As a Company user, I want restoring a Client **not** to auto-unpause schedules, so that reactivation is deliberate.
31. As a system Company user, I want schedules scoped to the selected Company context, so that cross-tenant viewing stays correct.
32. As a tenant user, I want schedules scoped to my Company only, so that other Companies’ data never appears.
33. As a user without `tickets.read`, I want schedule pages and APIs forbidden, so that RBAC stays consistent.
34. As a user without `tickets.write` or `clients.write`, I want create/edit/pause/delete disabled on the management page, so that read-only roles cannot change schedules.
35. As a mobile user, I want the management list as cards below `md`, so that the experience matches Tickets and Clients lists.
36. As a desktop user, I want the management list as a TanStack table, so that sorting and scanning match other dashboard lists.
37. As a Company user, I want month intervals to use calendar-month arithmetic with end-of-month clamping (e.g. Jan 31 + 1 month → Feb 28/29), so that dates are predictable.
38. As a Company user with a Ticket that has no linked Client (`client_id` null), I want the finish flow to explain that schedules require a linked Client (or disable scheduling), so that I am not confused when reminders cannot be saved.
39. As a Company user, I want the same service twice on one Ticket to still produce one schedule for that Client + Service pair, so that duplicate lines do not create duplicate rows.
40. As a developer, I want date math and status bucketing in pure functions, so that due windows and month rollover are unit tested without the database.
41. As a developer, I want schedule mutations in Server Actions with Company scoping and permission checks, so that the feature follows Zigzag’s primary data-access pattern.
42. As a maintainer, I want a Drizzle migration for `ClientServiceSchedule`, so that production deploy uses the standard schema workflow.
43. As a QA engineer, I want tests for interval calculation, 14-day due-soon boundaries, pause behavior, and upsert uniqueness, so that regressions are caught without E2E for every case.

## Implementation Decisions

### Product rules (from design review)

- **v1 behavior:** Reminders only—no auto-created Tickets, no email, WhatsApp, or push.
- **Hybrid configuration (phased):**
  - **v1 required:** Per **Client + Service** row; set/update on **Ticket finish** and **management page**.
  - **v1.1 optional:** Default interval on **Service** catalog to pre-fill forms (not required for launch).
  - **v1.1 optional:** “Servicios programados” section on Client detail (read/edit link).
- **Uniqueness:** At most one non-deleted schedule per `(company_id, client_id, service_id)`; all writes **upsert**.
- **Anchor date:** Default `last_service_at` from Ticket `ticket_date`; staff may override on finish and management UI. `next_due_at = last_service_at + interval` (roll forward from actual service after early/late visits).
- **Interval UI:** Presets 1, 2, 3, 6, 12 months, 1 year; **Personalizado** with `interval_value` + `interval_unit` (`month` | `day` only in v1).
- **Reminder buckets (derived, not stored):**
  - **Próximos:** `today ≤ next_due_at ≤ today + 14 days` (fixed 14-day window in v1).
  - **Atrasados:** `next_due_at < today`.
  - **Programados:** `next_due_at > today + 14 days`.
  - **Pausados:** `paused_at` set; excluded from Próximos/Atrasados unless filter includes them.
- **Ticket finish UX:** Per service line—checked by default if an active schedule exists for that Client + Service; unchecked for new pairs. Only checked lines upsert. Integrate with existing **finish Ticket** flow (today tied to finishing and PDF generation on the Ticket edit path).
- **Tickets without `client_id`:** Do not create schedules until a Client is linked; show clear Spanish messaging in the finish UI.
- **Navigation:** New sidebar item “Recordatorios de servicio”; route such as `/dashboard/service-schedules`. Dashboard widget for Próximos + Atrasados with link to full page. **Crear ticket** deep link only on management page (query params on Ticket create for `clientId` and `serviceId`).
- **Lifecycle:** Pause/resume via `paused_at`; soft-delete schedules; when Client or Service is soft-deleted, auto-pause related schedules; restoring Client does not auto-unpause.
- **Permissions (no new permission names in v1):** View lists/widget with `tickets.read`; upsert on finish with `tickets.write`; management mutations with `tickets.write` **or** `clients.write`.

### Deep modules to build or modify

1. **Schedule date math (pure, testable)**  
   Encapsulates adding calendar months (with end-of-month clamp), adding days, and computing `next_due_at` from `last_service_at`, `interval_value`, and `interval_unit`. No I/O.

2. **Schedule list bucketing (pure, testable)**  
   Given `next_due_at`, `paused_at`, and “today”, classifies rows into Próximos / Atrasados / Programados / Pausados for filters and widget. Fixed `DUE_SOON_DAYS = 14`.

3. **ClientServiceSchedule persistence**  
   Drizzle table and relations on Company, Client, Service. Unique partial index on `(company_id, client_id, service_id)` for active rows. Columns: `interval_value`, `interval_unit`, `last_service_at`, `next_due_at`, `paused_at`, optional `pause_reason`, audit timestamps, `deleted_at`.

4. **Schedule Server Actions**  
   Authenticated CRUD: list (with filter + search by Client name), get by id, upsert (single pair), pause, resume, soft-delete. Enforce `company_id`, soft-delete filters on joined Client/Service, and permissions above. Upsert used by finish flow and management page.

5. **Catalog delete hooks**  
   When Client or Service soft-delete runs in existing actions, pause or soft-delete related schedules in the same transaction or immediately after (consistent with soft-delete patterns in AGENTS.md).

6. **Ticket finish integration**  
   After successful finish (or as part of the finish confirmation UI before submit): load existing schedules for Ticket’s `client_id` and service ids on lines; render Recordatorios block; on confirm call batch upsert for checked lines. Requires `client_id` on Ticket.

7. **Management page UI**  
   Server-rendered page gated on `tickets.read`; client component for table/cards, filters, dialogs for add/edit, pause/resume, delete confirm. TanStack table desktop; cards mobile (`md` breakpoint). Row action: Crear ticket → Ticket create with prefill.

8. **Dashboard widget**  
   Server component or client fetch of truncated Próximos + Atrasados lists/counts for effective Company; link “Ver todos”. No Crear ticket on widget.

9. **Ticket create prefill**  
   Extend Ticket create page to read optional query params and pre-select Client and add Service line (behavior only; no server-side Ticket creation).

### Schema change

New table **`ClientServiceSchedule`** (name in DB may follow Drizzle convention `ClientServiceSchedule`):

```typescript
// Decision-rich shape (not full migration)
{
  id: serial PK
  company_id: integer NOT NULL
  client_id: integer NOT NULL  // FK Client
  service_id: integer NOT NULL  // FK Service
  interval_value: integer NOT NULL  // e.g. 2
  interval_unit: 'month' | 'day' NOT NULL
  last_service_at: timestamp nullable
  next_due_at: timestamp NOT NULL
  paused_at: timestamp nullable
  pause_reason: text nullable
  created_at, updated_at, deleted_at
}
// UNIQUE (company_id, client_id, service_id) WHERE deleted_at IS NULL
```

Indexes on `company_id`, `next_due_at`, and `client_id` for list queries.

### API surface

- **v1:** Server Actions only (no new public REST requirement unless parity with Clients is mandated later).
- List payload includes denormalized Client and Service names for display; filter soft-deleted Client/Service out of default views.

### Multi-tenancy and security

- Every query filters by effective `company_id` (session or system-Company context).
- Join Client and Service with `deleted_at IS NULL` for display; inactive schedules when catalog row deleted.
- No new permissions in seed for v1; document which roles need `tickets.write` / `clients.write` for admins.

## Testing Decisions

- **Principle:** Test observable behavior of pure modules (dates, buckets) and Server Action contracts (permission denied, wrong company, upsert overwrite, pause excludes from Próximos)—not implementation details of React components.
- **Modules under test:**
  - Schedule date math (month rollover, day intervals, next due from last service).
  - Schedule list bucketing (14-day window, overdue, paused exclusion).
  - Upsert/uniqueness logic if extracted; otherwise integration-style action tests with mocked DB where the repo already does so.
- **Prior art:** `dashboard-metrics.test.ts`, `dashboard-kpi.test.ts`, `ticket-financials.test.ts` for pure helpers; action tests patterns in existing ticket/client test files if present.
- **UI:** Rely on manual QA for finish dialog and management page; optional Playwright smoke in a later slice.
- **Do not pixel-test** dashboard widget; assert bucket counts or row ids in unit/integration tests where loader is testable.

## Out of Scope

- Auto-created or draft Tickets when due.
- Email, SMS, WhatsApp, or push notifications.
- Per-Company configurable due-soon window (fixed 14 days in v1).
- Week-based interval unit.
- Multiple concurrent schedules per same Client + Service (e.g. two sites)—would need a location dimension.
- Immutable audit history table for schedule changes (optional later; Ticket audit does not replace schedule history).
- New RBAC permission names (`service_schedules.read` / `.write`).
- Service catalog `default_interval` (v1.1).
- Client detail “Servicios programados” section (v1.1 unless bundled in a slice).
- Cron job or background worker (reminders computed on read).
- Changes to Ticket payment or finish audit event types beyond documenting finish + schedule in same user flow.

## Further Notes

- **Suggested slices for `to-issues`:** (1) migration + pure date/bucket modules + actions, (2) management page, (3) Ticket finish Recordatorios UI + upsert, (4) dashboard widget + Ticket create prefill, (5) optional Service default interval + Client detail section.
- **Feature branch:** `feat/client-service-schedules` per deployment docs.
- **Spanish copy examples:** “Recordatorios de servicio”, “Próximos”, “Atrasados”, “Programados”, “Pausados”, “Programar recordatorios”, “Crear ticket”.
- Finishing today often runs through Ticket edit + PDF; schedule UI must not block PDF generation unexpectedly—prefer confirm/save schedules in the same transaction as finish or immediately after successful finish with clear error handling if schedule save fails.
