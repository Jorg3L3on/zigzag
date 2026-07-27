# PRD: Tickets list actions polish

**Feature slug:** `tickets-list-actions-polish`  
**Integration branch:** `feat/tickets-list-actions-polish`

## Problem Statement

From the Tickets list, operators cannot see how much of a ticket is still unpaid (paid amount, balance due, or payment progress). The PDF action is labeled “Ver PDF” and stays disabled for almost every ticket because it depends on a legacy stored `document` URL, even though invoices are generated on demand elsewhere. “Cobrar saldo” only deep-links into ticket detail instead of letting the user register a payment in place, and its name does not match the detail flow (“Registrar pago”). Deleting a ticket from the list soft-deletes successfully but still surfaces a confusing TC008 (“ticket not found”) error toast, and there is no confirmation before delete.

## Solution

Polish the Tickets list so unpaid tickets show payment progress (circular ring without a numeric percent) plus paid and balance-due amounts next to the payment status badge; enable on-demand “Descargar ticket” for every ticket; open an in-list “Registrar pago” dialog (same collect semantics as detail, without payment history) for finished unpaid tickets; remove the obsolete Con/Sin PDF filter; and fix delete with a confirmation dialog, correct optimistic UI, and no false TC008 toast.

## User Stories

1. As a company operator, I want to see which tickets are still unpaid at a glance on the list, so that I can prioritize cobranza.
2. As a company operator, I want unpaid tickets (`Pendiente` and `Pago parcial`) to show how much has been paid, so that I know progress without opening the ticket.
3. As a company operator, I want unpaid tickets to show how much remains por pagar, so that I know the balance due.
4. As a company operator, I want a circular progress ring for payment completion without a percent number inside, so that progress is visual and the row stays uncluttered.
5. As a company operator, I want fully `Saldado` tickets to keep only the status badge (no paid/balance breakdown or ring clutter), so that settled tickets stay clean.
6. As a company operator viewing the desktop table, I want payment progress to live in the Estado column with the badge, so that I do not need extra columns.
7. As a company operator on mobile, I want the same badge + ring + Pagado/Por pagar breakdown on the ticket card, so that desktop and mobile stay consistent.
8. As a company operator, I want the ring color to reflect payment status (e.g. slate for pending, amber for partial), so that status is reinforced visually.
9. As a company operator, I want an accessible name/description on the progress ring (e.g. via `aria-label`), so that screen reader users understand payment progress.
10. As a company operator with tickets.read, I want “Descargar ticket” available for finished tickets, so that I can download the generated invoice PDF.
11. As a company operator with tickets.read, I want “Descargar ticket” available for unfinished tickets as well, so that I can download a ticket PDF before it is finalized.
12. As a company operator, I want “Descargar ticket” to generate the PDF on demand (not depend on a stored document URL), so that the action works for real tickets.
13. As a company operator, I want the old “Ver PDF” label replaced by “Descargar ticket”, so that the action matches what it does.
14. As a company operator, I want download failures to show a clear error toast, so that I know when generation failed.
15. As a company operator, I want the Con PDF / Sin PDF list filter removed, so that I am not filtering on a meaningless legacy document field.
16. As a company operator with tickets.write, I want “Cobrar saldo” renamed to “Registrar pago”, so that list language matches ticket detail.
17. As a company operator, I want “Registrar pago” only for finished tickets that are not `Saldado` (`Pendiente` or `Pago parcial`), so that I cannot start an invalid collect on a draft.
18. As a company operator, I want “Registrar pago” to open a dialog on the list (not navigate away), so that I can collect without leaving the list.
19. As a company operator in that dialog, I want to see Total, Pagado, and Por pagar, so that I know what I am collecting against.
20. As a company operator, I want to enter an abono amount and submit it, so that I can register a partial payment.
21. As a company operator, I want a “Saldar completo” action, so that I can clear the remaining balance in one step.
22. As a company operator, I do not want payment history inside the list dialog, so that the dialog stays fast and focused on collection.
23. As a company operator, I want validation when the abono is zero, negative, or greater than the balance due, so that I do not submit invalid amounts.
24. As a company operator, I want a success toast after a successful payment, so that I know the cobro was recorded.
25. As a company operator, I want the list row to update locally after payment (paid, balance, status, ring, actions) without a full list refetch, so that the UI feels immediate.
26. As a company operator, I want “Registrar pago” to disappear from the row once the ticket becomes `Saldado`, so that actions stay accurate.
27. As a company operator without tickets.write, I want collect and delete actions hidden, so that RBAC is respected.
28. As a company operator, I want a confirmation dialog before deleting a ticket from the list, so that I do not delete by accident.
29. As a company operator, I want a successful delete to remove the row and show a success toast, so that feedback is clear.
30. As a company operator, I want a failed delete to restore the row and show the real error code/message (not a false TC008), so that I trust the UI.
31. As a company operator, I want soft-deleted tickets to leave the active list as today, so that delete behavior stays consistent with trash/soft-delete rules.
32. As a QA engineer, I want component tests for the progress ring, collect dialog, row actions visibility/labels, delete confirm/restore, and removal of the PDF filter, so that regressions are caught.
33. As a developer, I want payment collection from the list to reuse `applyTicketPayment` (Server Action) with ticket audit events unchanged, so that money movements stay audited and tenant-scoped.
34. As a system company user switching company context, I want list payment/PDF/delete actions to continue respecting the selected company and permissions, so that multi-tenancy is not broken.

## Implementation Decisions

### Integration and delivery
- Feature slug / integration branch: `feat/tickets-list-actions-polish`.
- Deliver as PRD parent + slice issues; slice PRs merge into `feat/tickets-list-actions-polish`; one later PR from that branch to `main` when the epic is done.
- No schema migrations. No new REST mutation endpoints for core ticket mutations (Server Actions remain canonical).

### Module: Ticket payment progress ring (new, deep)
- Pure presentational module: inputs are `total` and `paid` (or a precomputed ratio / payment status).
- Renders a circular progress ring **without** a numeric percent label inside or beside the ring.
- Color follows payment status semantics already used by the payment badge (pending / partial; saldado not shown in unpaid breakdown).
- Expose an accessible name describing payment progress for assistive tech.
- Compute fill from existing payment helpers (`getTicketPaymentStatus` / balance helpers); do not invent a second money model.

### Module: Ticket list payment summary (compose in Estado column / mobile card)
- For tickets that are **not** `Saldado` (`Pendiente` or `Pago parcial`): show existing payment status badge + progress ring + Pagado amount + Por pagar (balance due).
- For `Saldado`: keep badge only (no ring / paid / balance breakdown).
- Desktop: enrich the Estado column; do not add separate Pagado/Por pagar/% columns.
- Mobile: same enrichment under/near the existing badge on the mobile card.
- Use existing currency formatting components for amounts.

### Module: Ticket list collect payment dialog (new, deep)
- Triggered from row actions as **“Registrar pago”** (rename from “Cobrar saldo”).
- Visibility: `tickets.write` + ticket `finished` + payment status is `pending` or `partial` (not `Saldado`).
- Dialog contents: Total / Pagado / Por pagar summary; amount input; register abono; settle full balance. **No** payment history list; no extra fetch of payment rows.
- Mutations via existing `applyTicketPayment` Server Action only (finished tickets; backend already rejects unfinished with validation).
- On success: close dialog, success toast, update the ticket row in list state (`paid` and derived UI). If status becomes `Saldado`, hide “Registrar pago” for that row.
- Prefer local row update over full list refetch.
- Reuse collect validation UX patterns from ticket detail cobranza (amount > 0, not above balance due, error toasts with codes).

### Module: Ticket row actions (orchestrator)
- Replace legacy “Ver PDF” (`document` URL / disabled when null) with **“Descargar ticket”** using on-demand invoice generation (same approach as detail PDF download).
- “Descargar ticket” available for **all** tickets (finished and unfinished), gated by ticket read permission consistent with invoice download RBAC.
- Wire “Registrar pago” to the collect dialog instead of navigating to `#cobranza`.
- Keep Ver detalles / Editar behaviors unless they conflict with the above.
- Delete: open confirmation AlertDialog before calling delete; on confirm, optimistic remove; on failure, restore row + toast with actual error; on success, success toast. Investigate and fix false TC008 after successful soft delete (delete path should not surface “ticket not found” when the ticket was removed correctly).

### Module: Tickets list filters
- Remove Con PDF / Sin PDF filter from the filter bar, filter state, filter utilities, chips, and related tests.
- Do not reinterpret the filter as finished/unfinished.

### Module: Delete ticket flow
- Add confirmation before soft delete from the list.
- Preserve soft-delete semantics (`deleted_at`) and company scoping.
- Correct optimistic UI: do not leave the user with a success-looking list and an erroneous TC008 toast.
- Map/display errors from the delete Server Action honestly (expected delete failure catalog is TC005; TC008 must not appear spuriously after a successful delete).

### Unchanged platform rules
- Multi-tenancy: all reads/mutations remain company-scoped; system company users keep explicit cross-company behavior via existing helpers.
- Ticket payments continue to write immutable ticket audit events through existing collect/delete paths.
- BigInt ticket ids: convert safely at UI boundaries as elsewhere in the app.
- PDF generation remains server-side on demand; do not accept uploaded PDFs.

## Testing Decisions

### What makes a good test
- Assert external behavior: what the user sees and which actions are available or invoked.
- Do not assert SVG path internals, CSS class strings as the sole signal, or private helper wiring unless they define a public contract.
- Prefer existing Jest + Testing Library patterns already used for tickets list components.

### Modules with tests
1. **Ticket payment progress ring** — renders for unpaid ratios; no numeric percent text; accessible name present; saldado/unpaid presentation contract as exported.
2. **Ticket list collect payment dialog** — shows summary; validates bad amounts; calls collect action with expected amount for abono and full settle; success closes and notifies parent; errors toast.
3. **Ticket row actions** — labels “Descargar ticket” and “Registrar pago”; collect visible only when finished + unpaid + write; download not blocked by missing `document`.
4. **Delete ticket flow** — confirmation required; optimistic remove on confirm; restore + error toast on failure; success toast on success; no false TC008 when delete succeeds.
5. **Tickets list filters** — PDF filter controls and “with/without document” filtering removed; other filters still work.
6. **Payment summary in list/card (lightweight)** — unpaid rows show Pagado/Por pagar; saldado rows do not.

### Prior art
- Tickets list / mobile card / filter utils tests under the tickets components area.
- PDF download button tests for on-demand download behavior.
- Ticket payment status helpers and detail collect/quick-actions tests for payment semantics and labeling.
- Tickets Server Action tests for `applyTicketPayment` / delete / IDOR (reuse; do not duplicate backend coverage unless the delete TC008 root cause is in the action).

## Out of Scope

- Changing ticket detail cobranza UI beyond shared copy/consistency already implied by reusing collect semantics.
- Showing payment history in the list dialog.
- Restoring or migrating legacy `ticket.document` storage as the primary download mechanism.
- Offline/PWA sync of ticket payment data.
- New permissions beyond existing `tickets.read` / `tickets.write`.
- Schema or migration changes.
- Redesigning the whole tickets list layout, sorting, or non-PDF filters (except removing PDF filter).
- Bulk collect or bulk delete.
- Changing invoice PDF visual design / fintech renderer content.

## Further Notes

- Locked product decisions from design interview: unpaid = `Pendiente` + `Pago parcial`; Estado column enrichment with ring (no percent number); PDF on-demand for all tickets + rename; remove PDF filter; collect dialog without history for finished unpaid only; local row update after pay including hiding collect when saldado; delete confirmation + fix false TC008; epic delivery via PRD/issues on `feat/tickets-list-actions-polish`.
- Suggested slice breakdown for `to-issues`: (1) payment summary + progress ring in list/mobile, (2) Descargar ticket + remove PDF filter, (3) Registrar pago dialog + row action, (4) delete confirmation + TC008 fix.

### Published slices (parent #290)

| Issue | Title | Blocked by |
| ----- | ----- | ---------- |
| #292 | Tickets list: payment summary + progress ring for unpaid tickets | None |
| #293 | Tickets list: Descargar ticket on-demand and remove PDF filter | None |
| #294 | Tickets list: Registrar pago dialog for finished unpaid tickets | #293 (serialize row actions; #292 optional UX) |
| #295 | Tickets list: confirm delete and fix false TC008 toast | #294 |

> Note: creating agent could not apply GitHub labels (`ready-for-agent` / `type:*`) due to token permissions — apply manually if missing.
