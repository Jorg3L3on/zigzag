# PRD: Presupuesto to Ticket conversion

**Status:** ❌ Not applied  
**GitHub:** [#373](https://github.com/Jorg3L3on/zigzag/issues/373); slices [#386](https://github.com/Jorg3L3on/zigzag/issues/386)–[#390](https://github.com/Jorg3L3on/zigzag/issues/390)  
**Suggested order:** After Cobranza and day-view foundations; introduces a new commercial document state on Ticket

## Problem Statement

Service Companies often quote work before performing it. ZigZag only models Tickets that are either en proceso or finalizados, with payment and invoice semantics aimed at executed work. Staff currently create “fake” Tickets as informal quotes, which pollutes active-work counts, Cobranza, Trabajo de hoy, and revenue metrics—or they keep quotes in WhatsApp/notebooks outside the system. There is no first-class **Presupuesto** that can be shared as a PDF and later converted into a real Ticket without re-typing Client and Services.

## Solution

Introduce a Ticket **document kind** (or equivalent status flag) distinguishing **Presupuesto** from **Trabajo** (normal Ticket). Users create presupuestos with Client and Service lines, download/share a Presupuesto PDF (fintech visual language, clearly labeled as quote—not invoice), optionally set an expiry date, and convert an accepted presupuesto into a working Ticket in one action that copies Client, lines, and totals into an unfinished Ticket while retaining auditability of the conversion. Presupuestos are excluded from Cobranza, Trabajo de hoy unfinished queues, and revenue/cash KPIs until converted (or explicitly marked accepted and converted).

## User Stories

1. As a Company user with `tickets.write`, I want to create a Presupuesto from a dedicated entry point, so that quotes are not mixed with jobs by accident.
2. As a Company user, I want presupuesto create to capture Client and Service lines like Ticket create, so that I do not learn a second catalog UX.
3. As a Company user, I want an optional expiry date on a Presupuesto, so that old quotes can be marked vencido.
4. As a Company user with `tickets.read`, I want a Presupuestos list (or Tickets filter `tipo=presupuesto`), so that I can find open quotes.
5. As a Company user, I want each presupuesto row to show Client, date, total, expiry, and estado (Borrador/Enviado/Aceptado/Vencido/Convertido/Cancelado as applicable to v1), so that pipeline health is visible.
6. As a Company user with `tickets.write`, I want to edit an open Presupuesto before conversion, so that I can adjust lines and prices.
7. As a Company user with `tickets.read`, I want to download a Presupuesto PDF labeled “Presupuesto” (not Factura/Recibo), so that Clients are not sent an invoice for unaccepted work.
8. As a Company user, I want to share the Presupuesto PDF via the same share/download helper pattern as invoices, so that mobile sharing works.
9. As a Company user with `tickets.write`, I want Convertir a ticket on an accepted/open Presupuesto, so that won work becomes an unfinished Ticket without re-entry.
10. As a Company user, I want conversion to copy Client snapshot fields and Service lines (quantity/price) onto the new Ticket, so that commercial terms carry over.
11. As a Company user, I want the resulting Ticket to start unfinished with paid = 0, so that cobro happens after work.
12. As a Company user, I want conversion to be blocked if the Presupuesto is already converted or canceled, so that duplicates are rare.
13. As a Company user, I want a Ticket audit event (or equivalent immutable link) recording presupuesto→ticket conversion, so that disputes can be traced.
14. As a Company user, I want the Presupuesto to show it was converted and link to the resulting Ticket id, so that I can navigate both ways.
15. As a Company user, I want presupuestos excluded from revenue, efectivo cobrado, and saldo por cobrar KPIs, so that quotes do not inflate finance metrics.
16. As a Company user, I want presupuestos excluded from Trabajo de hoy unfinished job queues, so that quotes are not dispatched as jobs.
17. As a Company user, I want presupuestos excluded from Cobranza, so that nobody tries to collect on a quote.
18. As a Company user, I want service schedules finish-upsert to ignore presupuestos (only real finished Tickets), so that reminders stay tied to performed work.
19. As a Company user with `tickets.write`, I want to cancel a Presupuesto, so that lost deals leave the open pipeline.
20. As a Company user, I want vencido state when expiry date is before today and not converted, so that stale quotes are obvious (computed or materialized).
21. As a system Company user, I want presupuestos scoped to selected Company context, so that tenant isolation holds.
22. As a tenant user, I want only my Company’s presupuestos, so that cross-tenant leakage is impossible.
23. As a user without `tickets.read`, I want presupuesto routes forbidden, so that RBAC matches Tickets.
24. As a user without `tickets.write`, I want create/edit/convert/cancel disabled, so that read-only roles cannot mutate.
25. As a mobile user, I want presupuestos as cards below `md`, so that lists match Tickets.
26. As a desktop user, I want a TanStack table for presupuestos, so that scanning matches other lists.
27. As a Company user, I want Spanish copy (Presupuesto, Convertir a ticket, Vencido), so that the feature matches product language.
28. As a developer, I want conversion in a Server Action transaction that creates the Ticket + lines and marks the source converted, so that partial failure does not orphan data.
29. As a developer, I want PDF payload/renderer to accept a document kind so quotes cannot accidentally use invoice legalese, so that Client communication stays correct.
30. As a QA engineer, I want unit tests proving KPI/day-view/cobranza queries exclude presupuestos, so that metric pollution cannot regress.
31. As a QA engineer, I want conversion tests for happy path, double-convert rejection, and Company scoping, so that money/work integrity holds.
32. As a QA engineer, I want PDF tests or payload snapshots asserting “Presupuesto” labeling, so that invoice/quote confusion is caught.
33. As a Company user, I want optional WhatsApp share of presupuesto PDF or a text summary with total, so that quoting on mobile matches how shops already sell (client-side share / wa.me — no Business API).
34. As a Company user, I want soft-delete on presupuestos consistent with Tickets, so that deletion conventions stay unified.
35. As a maintainer, I want guides updated to explain quote→job conversion, so that operators adopt the pipeline.
36. As a product owner, I want v1 to skip Client e-signature acceptance and public magic links, so that scope stays inside authenticated staff workflows (portal can come later).
37. As a Company user, I want ticket list default filters to hide presupuestos unless I choose the Presupuestos view/filter, so that job lists stay operational.
38. As a developer, I want BigInt Ticket ids converted for JSON via existing helpers, so that API/action responses stay safe.
39. As a Company user, I want prices on converted lines to remain editable on the Ticket before finish, so that field changes are still possible after win.
40. As a Company user, I want creating a normal Ticket to remain the default “Nuevo ticket” path, so that shops that do not quote are not slowed down.

## Implementation Decisions

### Modules to build or modify

| Module | Role |
| ------ | ---- |
| **Schema: Ticket document kind** | Add a durable discriminator on Ticket (recommended: `document_kind` enum/text: `ticket` \| `presupuesto`) plus optional `expires_at`, `converted_from_ticket_id` / `converted_to_ticket_id` (or single link + status) |
| **Presupuesto Server Actions** | Create/update/list/cancel/convert with Company scope, soft delete, RBAC |
| **Conversion transaction** | Deep module: validate source → insert Ticket + ServicesTickets → mark source converted → write TicketAuditEvent(s) |
| **Query filters** | Default Ticket lists, dashboard aggregations, Cobranza, day view, schedule finish flows exclude `presupuesto` unless explicitly querying quotes |
| **Presupuesto PDF** | Extend fintech payload/renderer with quote labeling; route can reuse invoice endpoint with kind check or dedicated action |
| **Presupuestos UI** | List + create/edit + detail actions (PDF, convert, cancel); Spanish copy |
| **Navigation** | Sidebar entry or Tickets sub-nav “Presupuestos” |

### Architectural decisions

- **Recommended model:** same `Ticket` table with `document_kind` rather than a parallel table — Shared Client/Services lines, less duplication, one RBAC surface. Conversion creates a **new** Ticket row (kind `ticket`) and marks the presupuesto converted (keeps quote history immutable).
- **Do not** allow `applyTicketPayment` / finish-for-revenue on `document_kind = presupuesto`.
- **Audit:** conversion must write immutable TicketAuditEvent on both sides or clearly on the new Ticket referencing source id.
- **PDF:** must not say Factura/Recibo for presupuestos; visual language can match fintech invoices with a Presupuesto title.
- **Metrics:** all finance aggregations filter `document_kind = ticket` (or null→ticket for backfill).
- **Migration:** existing rows backfilled as `ticket`.
- **Server Actions** canonical; no duplicate REST CRUD.
- Spanish UI; multi-tenant filters mandatory.
- Client portal acceptance / magic link explicitly later.

### Schema changes

- Add `document_kind` (not null, default `ticket`) on Ticket.
- Add nullable `expires_at` for presupuestos.
- Add nullable `converted_to_ticket_id` on presupuesto rows and/or `converted_from_ticket_id` on resulting tickets (choose one primary link + inverse query).
- Indexes: `(company_id, document_kind, deleted_at)` for list performance.
- Drizzle migration via canonical workflow.

## Testing Decisions

- Behavior tests over internals: exclusion from KPIs/Cobranza/day view; conversion copies lines; double convert fails; PDF kind labeling; RBAC; Company IDOR.
- **Unit-test:** conversion mapper (lines/totals), expiry/vencido helper, query predicate helpers.
- **Action tests:** create presupuesto, convert, cancel, cross-company denial.
- **PDF/payload tests:** title/document type field.
- **Prior art:** ticket create/finish/payment action tests, fintech invoice payload tests, IDOR matrices for tickets.

## Out of Scope

- Client-facing public quote approval portal
- E-signatures
- Automatic conversion via WhatsApp replies
- Multi-currency
- Versioned quote revisions beyond edit-before-convert
- Changing payment gateway / installment plans
- Inventory reservation against quotes
- Offline quote sync

## Further Notes

- Feature slug: `feat/presupuesto-to-ticket`.
- Coordinate with Cobranza and technician day view so those PRDs filter `document_kind` once this ships (call out dependency in slice issues).
- If Cobranza/day-view ship first, they should use a shared “isWorkTicket” predicate that today returns true for all rows and later respects `document_kind`.
- Domain terms: Ticket, Client, Service, Company, Server Action, Ticket audit event, soft delete.
