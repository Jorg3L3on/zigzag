# PRD: Technician day view (Día del técnico)

**Status:** ❌ Not applied  
**GitHub:** [#372](https://github.com/Jorg3L3on/zigzag/issues/372)  
**Related:** [`prd-native-feel-bottom-tabs.md`](./prd-native-feel-bottom-tabs.md) (Inicio → `/dashboard`)  
**Suggested order:** After or with bottom tabs; builds the “Inicio” value for field staff

## Problem Statement

Field technicians and operators open ZigZag on phones to do today’s work, but `/dashboard` is an analytics home (KPIs, charts, attention chips) and Tickets is a full registry. There is no **day-oriented work queue**: unfinished Tickets for today, overdue unfinished work, quick call/collect/finish paths, and a layout that feels like “my jobs” rather than “admin reports.” The planned bottom tab **Inicio** still points at the analytics dashboard, so installing the PWA does not give technicians a natural daily home.

## Solution

Add a **Trabajo de hoy** (technician day) experience optimized for mobile operators: a prioritized list of Tickets that need action today—unfinished Tickets dated today, overdue unfinished Tickets (ticket_date before today), and optionally outstanding finished Tickets with saldo for collection—each with Client, Services summary, phone, payment badge, and primary CTAs (Abrir / Terminar path / Cobrar / Llamar). Embed this as the prominent module on `/dashboard` for the operator persona (and available as a focused view), so **Inicio** becomes useful for field work even before broader dashboard redesign. No assignee/routing engine in v1 (Ticket has no first-class assignee); Company-wide day queue is acceptable.

## User Stories

1. As a Company operator with `tickets.read`, I want a Trabajo de hoy section on the dashboard, so that my first screen shows actionable jobs.
2. As a Company operator, I want Trabajo de hoy to list unfinished Tickets with `ticket_date` equal to today (Company timezone/day boundary consistent with existing helpers), so that today’s jobs are visible.
3. As a Company operator, I want overdue unfinished Tickets (`ticket_date` before today, still `finished = false`) included and visually marked Atrasado, so that slipped work is not forgotten.
4. As a Company operator, I want a clear empty state when there is no unfinished work for today/overdue, so that I know I am clear.
5. As a Company operator, I want each card to show Client name, ticket date, finished state, payment badge, saldo if > 0, and primary phone, so that I can act without opening detail first.
6. As a Company operator, I want a short services summary on each card when line items exist, so that I know what work was sold.
7. As a Company operator with `tickets.write`, I want a primary CTA to open the Ticket edit/detail finish path, so that I can complete work.
8. As a Company operator with `tickets.write`, I want Cobrar on finished cards with saldo > 0, so that collections happen in the field.
9. As a Company operator, I want Llamar via `tel:` when phone exists, so that I can contact the Client.
10. As a Company operator, I want optional WhatsApp deep link with a short “en camino / visita de hoy” style message, so that I can notify the Client without a vendor API.
11. As a Company operator, I want sort order overdue first, then today’s unfinished by ticket date/id, so that urgency is automatic.
12. As a Company operator, I want a toggle or chip to include/exclude “por cobrar” finished Tickets with saldo in the day view, so that collection stops can be layered on without drowning job cards (default: jobs-first — unfinished only).
13. As a mobile user, I want Trabajo de hoy as stacked cards with large tap targets, so that it works one-handed.
14. As a desktop user, I want the same module usable (table or wider cards) on the dashboard, so that office staff can help dispatch.
15. As a system Company user, I want the day view scoped to selected Company context, so that tenant isolation holds.
16. As a tenant user, I want only my Company’s Tickets, so that other tenants never appear.
17. As a user without `tickets.read`, I want the module hidden and routes forbidden, so that RBAC holds.
18. As a user without `tickets.write`, I want finish/collect actions hidden, so that read-only roles only browse.
19. As a Company operator, I want counts in the section header (hoy / atrasados), so that workload is scannable.
20. As a Company operator, I want a Ver todos link to `/tickets?finished=no` (and Cobranza when that ships), so that I can escape to full lists.
21. As a developer, I want a dedicated Server Action or query helper for day-view Tickets with server-side filters on `finished` and date bounds, so that we do not download the entire Ticket list to the client.
22. As a developer, I want day-boundary helpers unit-tested, so that “today” is stable across timezones documented for the product (use existing Company/local date conventions if any; otherwise document UTC-date vs local decision).
23. As a QA engineer, I want unit tests for inclusion rules (today, overdue, exclude finished by default), so that CI locks behavior.
24. As a QA engineer, I want component tests for empty state and CTA gating, so that UI permissions stay correct.
25. As a product owner aligning with bottom tabs, I want Inicio (`/dashboard`) to show Trabajo de hoy above or instead of heavy charts for the operator persona, so that field staff benefit immediately.
26. As an owner persona, I want analytics KPIs to remain available on the same dashboard (below or alongside), so that owners are not forced into a technician-only home.
27. As a Company operator offline after a prior online visit, I want the day view to fail gracefully with the offline banner and any future list snapshot strategy—not pretend jobs are complete—so that we do not invent offline writes here.
28. As a Company operator, I want pull-to-refresh or an explicit Actualizar control if native-feel chrome ships, so that the day queue can refresh on demand.
29. As a screen reader user, I want the section labeled “Trabajo de hoy” with list semantics, so that cards are announced coherently.
30. As a Company operator, I want soft-deleted Tickets excluded, so that the queue stays clean.
31. As a maintainer, I want Spanish copy only in UI strings, so that the feature matches the product language.
32. As a developer, I want reuse of payment badges, collect dialog, and phone link components, so that Cobranza/Tickets patterns stay consistent.
33. As a Company operator, I want creating a Ticket from reminders to show up in Trabajo de hoy when its ticket_date is today, so that the action loop feeds the day view.
34. As a product owner, I want v1 to explicitly skip technician assignment, map routing, and GPS, so that scope stays shippable.
35. As a Company operator, I want Needs Attention “Tickets por finalizar” to remain coherent with Trabajo de hoy counts, so that dashboard signals do not contradict each other.
36. As a QA engineer, I want an optional Playwright mobile smoke that loads dashboard and sees the Trabajo de hoy heading when authenticated, so that wiring is verified.

## Implementation Decisions

### Modules to build or modify

| Module | Role |
| ------ | ---- |
| **Day-queue query** | Server Action: Company-scoped Tickets for today + overdue unfinished; optional saldo add-on; returns DTOs for cards |
| **Day-boundary helper** | Pure date helpers for “today” / “before today” aligned with schedule/dashboard conventions |
| **Trabajo de hoy UI** | Dashboard module + mobile cards + desktop variant; header counts; chips |
| **Persona composition** | Adjust operator dashboard composition to prioritize this module near the top |
| **CTA wiring** | Reuse edit/detail, collect payment, tel/WhatsApp helpers |
| **Bottom tabs alignment** | No change to tab targets required if Inicio stays `/dashboard`; document that this PRD makes Inicio valuable |

### Architectural decisions

- **No assignee field** in v1 — queue is Company-wide.
- **No new Ticket status enum** — continue using `finished` boolean + payment derivation.
- **Server-side filtering** required for performance (avoid shipping all Tickets to the client).
- Prefer extending Ticket list actions with date/finished params over a one-off raw SQL path; keep Drizzle + `company_id` + `deleted_at IS NULL`.
- **Default chip:** unfinished only (hoy + atrasados). “Por cobrar” is opt-in overlay, or link out to Cobranza once that PRD ships.
- Offline: no new write queue; read failure shows existing network error/offline banner.
- Spanish UI; existing RBAC.
- Do not replace the entire analytics dashboard for owner persona.

### Schema changes

- None required for v1.
- Future (out of scope): `assignee_user_id`, route/zone on Client.

## Testing Decisions

- Behavior-focused tests for inclusion/exclusion and sorting; RBAC on action visibility; Company scoping on the query.
- **Unit-test:** day-boundary helper, queue ranking.
- **Action tests:** scoped query returns only company rows; soft-deleted excluded; finished excluded by default.
- **Component tests:** empty state; write CTAs gated.
- **Prior art:** dashboard attention links, tickets list finished chips, payment collect dialogs, mobile card lists.

## Out of Scope

- Technician assignment / dispatch board
- Map view, GPS tracking, route optimization
- Calendar sync (Google/Outlook)
- Offline completion sync
- Changing bottom tab destinations away from `/dashboard`
- Replacing owner analytics KPIs
- Native apps

## Further Notes

- Feature slug: `feat/technician-day-view`.
- Operator dashboard already has a section titled toward “Trabajo de hoy” for schedules/activity — rename/replace carefully so schedules widget and Ticket day queue are not confused (e.g. “Visitas de hoy” vs “Tickets de hoy” if both remain).
- Pairs naturally with reminder action loop (jobs appear after crear ticket) and Cobranza (por cobrar chip / link).
