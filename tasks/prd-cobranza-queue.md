# PRD: Cobranza queue and WhatsApp balance share

**Status:** ❌ Not applied  
**GitHub:** [#370](https://github.com/Jorg3L3on/zigzag/issues/370)  
**Suggested order:** First among business-growth PRDs (highest cash-flow ROI)

## Problem Statement

Company owners and front-desk staff cannot see at a glance who still owes money. Saldo por cobrar appears as a dashboard KPI, and Tickets can be filtered by payment status, but there is no dedicated cobranza workflow: no overdue aging, no one-place list optimized for “collect today,” and no fast way to message a Client their pending balance over WhatsApp. Staff hunt unfinished payment states across the Tickets list, open each Ticket, and manually compose messages—slow on mobile and easy to miss aging balances.

## Solution

Ship a **Cobranza** surface scoped to Tickets with saldo pendiente greater than zero. Staff see outstanding balances sorted by urgency (oldest / largest first), filter by payment status and aging, and act from each row: register a payment (existing flow), open the Ticket, download or share the invoice PDF (existing), and **Compartir por WhatsApp** via a client-side `wa.me` deep link with a Spanish message that includes Client name, Ticket reference, and saldo. Reuse existing payment status helpers, list patterns, and RBAC. No WhatsApp Business API, no SMS vendor, and no offline write queue.

## User Stories

1. As a Company user with `tickets.read`, I want a Cobranza page in the sidebar, so that I can open collections work without hunting the Tickets list.
2. As a Company user, I want Cobranza to list only non-deleted Tickets whose saldo pendiente is greater than zero, so that paid Tickets do not clutter the queue.
3. As a Company user, I want each row to show Client name, Ticket date or id, total, paid, saldo, payment status badge, and days since ticket date (or since last payment if available), so that I can prioritize who to call.
4. As a Company user, I want the default sort to put the most urgent balances first (pending before partial, then older ticket dates, then larger saldo), so that collections start with the hardest cases.
5. As a Company user, I want filters for Pendiente, Pago parcial, and Todos (outstanding only), so that I can focus on never-paid vs partial payers.
6. As a Company user, I want aging filters (por ejemplo Todos, 0–14 días, 15–30 días, más de 30 días) based on ticket date, so that I can chase overdue balances.
7. As a Company user, I want client name search on Cobranza, so that I can find one debtor quickly.
8. As a Company user with `tickets.write`, I want Registrar pago from a Cobranza row, so that I can collect without leaving the queue.
9. As a Company user with `tickets.read`, I want Ver ticket from a Cobranza row, so that I can inspect line items and payment history.
10. As a Company user with `tickets.read`, I want Descargar / Compartir PDF from a Cobranza row using the existing invoice delivery helper, so that I can send the formal invoice.
11. As a Company user with `tickets.read`, I want Compartir por WhatsApp on a Cobranza row, so that I can open WhatsApp with a prefilled balance reminder.
12. As a Company user, I want WhatsApp share to use the Ticket’s client phone (`client_tel`) when present, so that the message targets the contact on the Ticket.
13. As a Company user, when the Ticket has no usable phone, I want WhatsApp share disabled or explained, so that I am not sent to a broken `wa.me` link.
14. As a Company user, I want the WhatsApp message to include Company-facing Spanish copy with Client name, Ticket identifier, saldo formateado, and a short pay reminder, so that the Client understands what they owe.
15. As a Company user, I want phone numbers normalized for `wa.me` (digits, optional country code handling documented), so that Mexican numbers work when possible without a paid lookup API.
16. As a mobile user, I want Cobranza as cards below `md`, so that the experience matches Tickets and Clients lists.
17. As a desktop user, I want Cobranza as a TanStack table from the same row model, so that sorting and scanning match other dashboard lists.
18. As a Company user, I want a summary strip showing count of outstanding Tickets and sum of saldo por cobrar for the current filter, so that I see portfolio pressure at a glance.
19. As a Company user, I want the dashboard “Saldo por cobrar” KPI or Needs Attention pending/partial links to deep-link into Cobranza (or Cobranza with matching filter), so that analytics lead into action.
20. As a system Company user, I want Cobranza scoped to the selected Company context, so that cross-tenant viewing stays explicit.
21. As a tenant user, I want Cobranza scoped to my Company only, so that other Companies’ Tickets never appear.
22. As a user without `tickets.read`, I want Cobranza routes and actions forbidden, so that RBAC stays consistent.
23. As a user without `tickets.write`, I want Registrar pago hidden or disabled on Cobranza, so that read-only roles cannot collect.
24. As a Company user, I want unfinished and finished Tickets with saldo both included when saldo > 0, so that I can collect after work is done (primary case) and still see rare unfinished balances if they exist.
25. As a Company user, I want payment status badges to reuse Saldado / Pago parcial / Pendiente labels and colors from Tickets, so that status language stays consistent.
26. As a screen reader user, I want Cobranza filters and row actions labeled accessibly, so that collections work is operable without a pointer.
27. As a Company user on a phone, I want WhatsApp to open in the same user gesture as the button click, so that mobile browsers do not block the navigation.
28. As a developer, I want saldo and payment status derived only from existing `getTicketBalanceDue` / `getTicketPaymentStatus` helpers, so that Cobranza cannot drift from Tickets or dashboard KPIs.
29. As a developer, I want a pure helper that builds the WhatsApp URL and message text from Ticket + phone inputs, so that formatting is unit-tested without the browser.
30. As a developer, I want Cobranza reads via Server Actions (canonical UI path), so that we do not add duplicate REST list endpoints for this UI.
31. As a maintainer, I want Spanish product copy throughout Cobranza, so that the feature matches the rest of the dashboard.
32. As a QA engineer, I want Jest coverage for aging buckets, default sort, WhatsApp URL builder, and empty/no-phone cases, so that regressions fail in CI.
33. As a QA engineer, I want a Playwright smoke that opens Cobranza and asserts an outstanding row action is visible when seed data has saldo, so that the page is wired in production builds.
34. As a Company user, I want empty Cobranza state copy that celebrates “No hay saldos pendientes” when the queue is empty, so that a healthy Company is clear.
35. As a Company user, after a successful payment that zeros the saldo, I want the Ticket to disappear from Cobranza on refresh, so that the queue stays truthful.
36. As a product owner, I want README / guides to mention Cobranza briefly when the feature ships, so that operators discover the workflow.

## Implementation Decisions

### Modules to build or modify

| Module | Role |
| ------ | ---- |
| **Cobranza query / list action** | Company-scoped Server Action returning Tickets with saldo > 0, payment status, aging fields, summary totals |
| **Aging + sort helpers** | Pure functions: days outstanding, aging bucket, default urgency sort — deep module, heavily unit-tested |
| **WhatsApp deep-link helper** | Pure `buildWhatsAppBalanceShare({ phone, clientName, ticketLabel, balance, companyName? })` → `{ href, message }` or null if phone invalid — extends phone-link utilities without paid APIs |
| **Cobranza list UI** | Page + TanStack columns + mobile cards + filters + summary strip; reuse Tripled list shell and payment badge components |
| **Row actions** | Wire existing collect-payment dialog, ticket navigation, invoice fetch/share, new WhatsApp action |
| **Navigation** | Sidebar entry “Cobranza”; optional dashboard KPI / Needs Attention href updates to Cobranza |
| **RBAC** | `tickets.read` for page; `tickets.write` for collect |

### Architectural decisions

- **No schema change** in v1: saldo remains `total − paid` via existing helpers; `TicketPayment` history unchanged.
- **No WhatsApp Business API**, templates, or server-side send — client opens `https://wa.me/<digits>?text=<encoded>`.
- **Phone source:** prefer Ticket `client_tel`; optionally fall back to Client.phone if Ticket tel missing (document choice in implementation: Ticket-first).
- **Include finished and unfinished** Tickets with saldo > 0; primary UX copy assumes finished + pending collection (existing collect payment already requires finished for abonos — keep that rule; if unfinished with saldo appears, only Ver/PDF/WhatsApp, not Registrar pago, unless product already allows otherwise).
- **Server Actions** for list reads; do not add a Cobranza REST list route.
- **Company scoping** and soft-delete filters mandatory on every query.
- **Spanish UI**; currency formatting matches Tickets (`es-MX` / existing formatters).
- Thin vertical slice: list + filters + summary + WhatsApp + reuse collect/PDF. Optional Cobranza PDF export of the queue is **out of scope** for v1 (dashboard PDF already covers portfolio snapshot).

### Schema changes

- None required for v1.

## Testing Decisions

- Prefer tests of **external behavior**: given Ticket totals/paid/dates/phones, assert inclusion, aging bucket, sort order, WhatsApp href/message, and RBAC denial.
- Do not assert implementation details of React table internals.
- **Unit-test:** aging helpers, urgency sort, WhatsApp builder (valid MX-ish numbers, missing phone, encoding), balance filter (tolerance edge via existing payment helpers).
- **Component tests:** Cobranza list empty state; WhatsApp control disabled without phone; collect action gated by `tickets.write`.
- **Prior art:** `ticket-payment-status` tests, tickets list payment actions tests, `phone-links` / ClientPhoneLink patterns, dashboard outstanding balance aggregation tests.
- **E2E (optional smoke):** mobile or desktop open Cobranza when authenticated seed has outstanding Ticket.

## Out of Scope

- WhatsApp Business API, Meta templates, delivery receipts, or chatbots
- SMS / email balance reminders
- Payment plans / scheduled installments
- Online card payment gateways
- Offline mutation queue for cobros
- Changing invoice PDF layout
- Automatic reminder cron for unpaid Tickets (separate from service schedules)
- Full accounting export beyond what Tickets CSV already provides
- Assigning collectors / ownership of a debt to a User

## Further Notes

- Coordinates with native-feel PDF share: Cobranza should call the same invoice delivery helper once that lands; until then use current download/share path.
- Suggested feature slug for branch/PR workflow: `feat/cobranza-queue`.
- Domain vocabulary: Company, Ticket, Client, Server Action, soft delete, Ticket audit event (payments already emit audit — Cobranza must not bypass `applyTicketPayment`).
