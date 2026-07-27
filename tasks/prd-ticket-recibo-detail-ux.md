# Ticket recibo naming, activity diffs, edit return, and calendar highlight

**Published:** #326

## Problem Statement

Operators working tickets see mixed or unhelpful product language and flows. The Spanish UI still calls the PDF document a **Factura** while the business wants **Recibo**. On the ticket detail **Actividad** timeline, soft updates only say that someone updated the ticket, without saying which fields changed. After editing a ticket, soft save and back navigation dump the user on the tickets list instead of returning to that ticket’s detail. In the create wizard, opening the date calendar does not visually show the already selected day (and may not open on that month).

## Solution

Ship one cohesive ticket-module UX pass: rename all user-facing Spanish factura/facturación copy to recibo-oriented wording (including PDF header and concept count), make ticket-detail Actividad show field-level and service-aware change details from existing audit payloads, route edit exits back to ticket detail, and fix the shared calendar so the selected day is highlighted and the correct month is visible.

## User Stories

### Terminology (Factura → Recibo)

1. As a tickets writer, I want the ticket detail invoice section title to say Recibo, so that the product language matches how we talk about the document.
2. As a tickets writer, I want the quick action that generates the PDF to say Generar recibo (or equivalent), so that I am not offered a “factura”.
3. As a tickets writer, I want download/print helper copy that mentioned factura to say recibo, so that the detail page is consistent.
4. As a dashboard user, I want activity feed sentences that mentioned generar la factura to say recibo, so that history matches the new term.
5. As a company admin, I want company form labels such as “Notas al pie de factura” to say recibo, so that settings match operator language.
6. As a company admin, I want onboarding checklist steps that referred to facturas/facturación to use emisión de recibos / recibos PDF wording, so that setup guidance matches the product.
7. As a visitor, I want marketing landing and legal/meta copy that promoted Factura PDF / facturación to promote recibos PDF / emisión de recibos, so that public pages match the product.
8. As a reader of HTML operator guides, I want guide steps and nav that said Factura PDF to say Recibo PDF, so that docs match the app.
9. As a tickets writer, I want the generated PDF header to say Recibo No., so that the printed document matches the UI name.
10. As a tickets writer, I want the PDF service-count line to say N conceptos (without “facturados”), so that the document does not use factura language.
11. As a maintainer, I want English code identifiers, routes, and API paths that use `invoice` to remain unchanged, so that refactors stay scoped to user-facing Spanish.

### Actividad specificity (ticket detail)

12. As a tickets writer, I want an Actividad entry for a soft update to keep a clear title that someone updated the ticket, so that the timeline still scans quickly.
13. As a tickets writer, I want bullet sublines under that entry listing each changed field as “campo: de → a”, so that I can see exactly what changed.
14. As a tickets writer, I want diffs for client name, phone, email, document, ticket date, and total when those values change, so that client and money edits are visible.
15. As a tickets writer, I do not want internal client link id changes called out as their own field, so that Actividad stays user-facing.
16. As a tickets writer, I want service-related updates to name the service when the audit payload includes it, so that line-item edits are understandable.
17. As a tickets writer, I want historical Actividad rows to use the same diff formatting from existing before/after payloads, so that old tickets become clearer without a data migration.
18. As a dashboard user, I want the global activity feed update lines to stay short (ticket reference only), so that the home feed does not become noisy.
19. As a tickets writer, I want payment and finished events to keep their existing amount-aware sentences, so that money events are not regressed by the update-diff work.

### Edit navigation back to detail

20. As a tickets writer, I want “Guardar cambios” on edit to navigate to that ticket’s detail page, so that I land on the ticket I just edited.
21. As a tickets writer, I want mobile back from edit to go to ticket detail, so that I am not forced through the list.
22. As a tickets writer, I want edit breadcrumbs to be Tickets → Ticket #id → Editar, with Ticket #id linking to detail, so that hierarchy matches reality.
23. As a tickets writer, I want an explicit Cancelar or Ver ticket control on edit that goes to detail, so that I can leave without hunting for back.
24. As a tickets writer, I want the services-step “Ticket #id” crumb (and equivalent back) to go to detail, so that mid-wizard navigation can reach the read view.
25. As a tickets writer, I want “Guardar y generar PDF” / finish to continue landing on detail, so that finish behavior stays consistent with soft save.
26. As a tickets writer, I want create → services → edit flow entry points unchanged, so that this work does not redesign the wizard steps.

### Calendar selected day

27. As a tickets writer, I want the create-wizard date calendar to highlight the currently selected day when opened, so that I can confirm the date at a glance.
28. As a tickets writer, I want the calendar to open on the month of the selected date, so that a past selection is not hidden off-screen.
29. As a tickets writer, I want the same highlight and month behavior on other shared calendar consumers (edit, filters, schedules), so that the picker is consistent app-wide.
30. As a maintainer, I want the shared Calendar primitive aligned with the installed DayPicker major version classNames, so that selected/today styles actually apply.

### Quality and delivery

31. As a maintainer, I want unit tests for the audit timeline diff formatter, so that field and service copy cannot silently regress.
32. As a maintainer, I want unit coverage for Calendar selected/today styling hooks and selected-month defaulting, so that the highlight bug cannot return unnoticed.
33. As a maintainer, I want existing PDF payload tests updated for Recibo No. and conceptos wording, so that document copy stays locked.
34. As a maintainer, I want critical UI/e2e matchers that looked for “Generar factura” updated to recibo language, so that CI matches the new copy.
35. As a reviewer, I want this delivered as one PR to main, so that the four related UX fixes ship together without a multi-slice epic.

## Implementation Decisions

- **Delivery:** Single PR into `main` (small UX cluster). No `feat/<slug>` integration branch and no multi-issue epic unless maintainers later split it.
- **Terminology module:** Sweep all user-facing Spanish that uses factura/facturas and process wording facturación toward recibo/recibos and phrases such as emisión de recibos / recibos PDF. Include ticket UI, company settings/onboarding, marketing, legal/meta, and HTML guides. Do not invent a fake verb “recibación”.
- **PDF copy:** Document title/header uses Recibo No.; service-count uses N conceptos (drop “facturados”). Keep English `invoice` route, helpers, and code identifiers.
- **Audit timeline diff (deep module):** Extend or extract a pure formatter used by ticket detail Actividad. For `updated` events, title remains an “updated the ticket” style line; attach bullet sublines comparing before/after for client_name, client_tel, email, document, ticket_date, and total. Omit client_id. For service-line / servicesChanged payloads, include the service name when present. Re-render historical events from existing JSON payloads; no schema or migration changes. Do not enrich the dashboard activity feed with the same verbosity.
- **Edit exit navigation:** Soft save redirects to ticket detail. Mobile back and breadcrumbs use Tickets → Ticket #id → Editar with parent/back to detail. Add Cancelar or Ver ticket → detail. Services step Ticket #id crumb/back → detail. Create wizard step order unchanged.
- **Shared Calendar:** Fix DayPicker v9 classNames (selected/today/etc.) on the shared Calendar primitive; default visible month from the selected date when opening. Apply globally to all consumers of that primitive.
- **No schema/API contract changes** for audit storage, ticket mutations, or invoice download URL shape.

## Testing Decisions

- Good tests assert external behavior (formatted Spanish strings, navigation targets, visible calendar selection semantics), not private helper structure.
- **Must test:** ticket audit timeline diff formatter (field diffs, omitted client_id, service name when present, historical before/after). Prior art: existing ticket audit display unit tests.
- **Should test:** shared Calendar selected/today class application and selected-month defaulting; PDF payload string assertions for Recibo No. / conceptos. Prior art: fintech invoice payload tests; UI component tests where Calendar is already covered.
- **Light / update only:** terminology spot-checks and e2e matchers that currently expect “Generar factura”; no heavy new e2e suite required for edit→detail unless a cheap path already exists.
- **Skip heavy e2e** for the full marketing/docs copy sweep.

## Out of Scope

- Item 4 from the original operator list (never specified) — intentionally excluded.
- Renaming English code, API routes, or database columns from `invoice` to `receipt`/`recibo`.
- Changing dashboard global activity feed update verbosity.
- Redesigning the create → services → edit wizard into a different step model.
- New TicketAuditEvent types or migrations; forensic full line-item price/qty dumps beyond naming the service.
- Offline/PWA behavior, RBAC changes, or PDF layout redesign beyond the agreed Spanish strings.

## Further Notes

- Domain vocabulary: keep **Ticket**, **Ticket audit event**, **Company**, **Server Action**, and **API route** terms from domain docs; user-facing document name becomes **Recibo** while code may still say invoice.
- Aligns with existing production rule that PDFs are generated on demand from ticket data (no upload path).
- Grill-me decisions locked with the requester: terminology scope D; PDF option A; facturación → B; Actividad B with sublines on detail only; fields C + layout 2 + services ii; edit exits 1–4; shared calendar fix; packaging A.
