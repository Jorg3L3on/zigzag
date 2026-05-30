# PRD: Dashboard Analytics & Report Redesign

## Problem Statement

The Company dashboard is too simple for day-to-day business decisions. It shows only four static lifetime counters, two basic charts, and a full Client metrics table that largely duplicates the “top clients” chart. Important Ticket financial signals already exist in the backend—cash collected, payment status, open Tickets—but are hidden or buried. Owners and front-desk staff need a single scrollable view that blends financial health with operational awareness, modern chart-in-card visuals, and a shareable PDF summary aligned with the existing fintech Ticket invoice look.

## Solution

Redesign the dashboard as a hybrid analytics home: four KPI cards for the current calendar month with sparklines and month-over-month deltas; a hero revenue-by-month bar chart with an independent 3/6/12-month period control; a payment-status breakdown card (Saldado / Pago parcial / Pendiente); a recent Tickets activity section with search and payment badges; and server-generated vector PDF export that reuses the fintech invoice design language (navy header, rounded cards, es-MX currency). Keep a single page (no tabs), Spanish product copy, existing RBAC (`tickets.read`), and Company scoping including system-Company context switching. No database schema changes.

## User Stories

1. As a Company user, I want the dashboard to show ingresos del periodo for the current calendar month, so that I understand how this month is performing.
2. As a Company user, I want ingresos del periodo compared to the previous calendar month as a percentage, so that I can see whether revenue is improving.
3. As a Company user, I want a small sparkline on the ingresos KPI, so that I can scan recent trend without opening a chart.
4. As a Company user, I want efectivo cobrado for the current calendar month with delta and sparkline, so that I see cash collected separately from recognized revenue.
5. As a Company user, I want saldo por cobrar surfaced on the dashboard, so that I know how much remains outstanding on open and partially paid Tickets.
6. As a Company user, I want saldo por cobrar with month-over-month delta and sparkline, so that collection pressure is visible at a glance.
7. As a Company user, I want tickets activos (unfinished Tickets) with delta and sparkline, so that operational workload is visible alongside financial KPIs.
8. As a Company user, I want all four top KPI cards to show the same delta treatment, so that the row feels consistent and professional.
9. As a Company user, I want a large revenue-by-month bar chart, so that monthly performance is easy to compare visually.
10. As a Company user, I want the current month highlighted on the revenue chart, so that the active period stands out.
11. As a Company user, I want rich tooltips on the revenue chart, so that I can inspect exact amounts per month.
12. As a Company user, I want to switch the revenue chart between 3, 6, and 12 months independently of KPI period logic, so that I can zoom the trend without changing KPI scope.
13. As a Company user, I want a payment-status breakdown (Saldado, Pago parcial, Pendiente), so that collection state is visible beside revenue.
14. As a Company user, I want the breakdown to reflect Ticket payment status derived from total and paid amounts, so that labels match the rest of the product.
15. As a Company user, I want a recent Tickets table with Client, total, date, payment badge, and link to Ticket detail, so that I can jump into work from the dashboard.
16. As a Company user, I want to search recent Tickets by Client name, so that I can find a row quickly.
17. As a Company user, I want recent Tickets sorted newest first by default, so that the table matches “what happened lately.”
18. As a Company user, I want the old full Client metrics table removed from the main dashboard, so that I am not shown duplicate leaderboard data.
19. As a Company user, I want catalog counts (total Clients, total Services) de-emphasized or removed from the hero KPI row, so that performance metrics are not confused with inventory size.
20. As a Company user, I want an Export control that downloads a dashboard PDF, so that I can share a monthly snapshot with stakeholders.
21. As a Company user, I want the dashboard PDF to use the same fintech visual language as Ticket invoices, so that exports feel like part of the same product.
22. As a Company user, I want the PDF to include Company identity in the header, so that the report is clearly issued by my tenant.
23. As a Company user, I want the PDF to state the reporting period (current calendar month), so that readers know what the numbers represent.
24. As a Company user, I want the PDF to include the four KPIs with values and deltas, so that the export matches what I see on screen.
25. As a Company user, I want the PDF to include revenue and payment-status summaries, so that the document is useful without opening the app.
26. As a Company user, I want the PDF to include a recent Tickets table, so that operational context is preserved in the export.
27. As a system Company user, I want dashboard metrics and PDF export to respect the selected Company context, so that cross-tenant viewing stays explicit.
28. As a tenant user, I want dashboard data scoped to my Company only, so that another Company’s Tickets and Clients never appear.
29. As a user without `tickets.read`, I want the dashboard route to remain forbidden, so that RBAC is unchanged.
30. As a mobile dashboard user, I want KPIs in a 2×2 grid, so that cards are readable on a phone.
31. As a mobile dashboard user, I want charts stacked full width, so that I do not scroll horizontally.
32. As a mobile dashboard user, I want the recent Tickets section as cards instead of a wide table, so that the experience matches other mobile list pages.
33. As a keyboard or screen reader user, I want charts to retain accessible names and supplemental data tables where charts exist today, so that accessibility does not regress.
34. As a user who prefers reduced motion, I want chart animations to respect reduced-motion preferences, so that the dashboard does not cause discomfort.
35. As a developer, I want dashboard aggregation logic isolated from UI and PDF rendering, so that month boundaries, deltas, and payment buckets can be unit tested.
36. As a developer, I want a stable dashboard report payload separate from the PDF renderer, so that PDF layout can evolve without touching Drizzle queries.
37. As a developer, I want the PDF renderer to accept only the report payload, so that vector drawing code stays testable and auth-free.
38. As a maintainer, I want the redesign to reuse existing chart primitives and Tripled dashboard shell patterns, so that the UI stays consistent with the rest of the app.
39. As a maintainer, I want no schema migration for this feature, so that rollout is UI and query-only.
40. As a QA engineer, I want automated tests on aggregation and PDF payload contracts, so that financial regressions are caught without pixel-diffing PDFs.

## Implementation Decisions

### Product and layout (from design review)

- **Purpose:** Hybrid dashboard (~60% financial, ~40% operational).
- **Information architecture:** Single scrollable page; no Overview/Sales-style tabs in v1.
- **Visual direction:** Reference-inspired analytics layout using existing shadcn/Tripled tokens—not a full rebrand. No three-dot overflow menus on KPI cards in v1.
- **KPI row (4 cards):** (1) Ingresos del periodo, (2) Efectivo cobrado, (3) Saldo por cobrar, (4) Tickets activos.
- **KPI period:** Values for the **current calendar month**; delta is **percent change vs previous calendar month**; sparkline uses the last **6–8** month buckets already used for revenue series (extend aggregation for ticket-count series where needed).
- **Charts (desktop large breakpoint):** ~2/3 hero **bar** chart for revenue by month with highlighted current month; ~1/3 **payment-status** breakdown (Saldado / Pago parcial / Pendiente). Revenue chart keeps its own **3 / 6 / 12** month selector, independent of KPI month logic.
- **Bottom section:** Recent Tickets table (~10–15 rows), search by Client name, default sort newest first, payment status badges, links to Ticket detail. Remove the full Client metrics table from the main dashboard view.
- **Mobile:** KPI 2×2 grid; charts stacked; recent Tickets as cards below `md`.
- **Phasing:** Phase 1 (this PRD) delivers KPIs, charts, recent Tickets, PDF export, and removal of duplicate Client table. Phase 2+ (out of scope here): top Services chart, ticket promedio, richer filters, custom date range, KPI card actions.

### Deep modules to build or extend

1. **Dashboard period aggregation (pure, testable)**  
   Encapsulates calendar-month boundaries, prior-month comparison, sparkline point series, saldo por cobrar, tickets activos counts, payment-status buckets, and recent Ticket row shaping. Input: scoped Ticket rows and related aggregates for one Company; output: a stable `DashboardMetrics` shape consumed by UI and PDF adapter. Reuse existing finished-revenue-by-month helpers where possible; add parallel helpers for cash collected, open Ticket counts, and payment-status grouping using the same `getTicketPaymentStatus` rules as the Ticket list.

2. **Dashboard metrics loader (server action)**  
   Extends the existing authenticated fetch path: enforce `tickets.read`, resolve effective `company_id` (session vs system-Company selected context), filter soft-deleted Tickets/Clients, return the expanded metrics object. No schema changes—additional SQL/select fields or in-memory aggregation on loaded rows.

3. **Dashboard presentation components**  
   - KPI card with value, delta badge (up/down/neutral styling), and sparkline (Recharts or lightweight SVG—match existing chart stack).  
   - Hero revenue bar chart card (replace or augment current area chart).  
   - Payment-status side card (donut or horizontal segmented bar).  
   - Recent Tickets section (table desktop / cards mobile) with local client-side search on loaded rows.

4. **Dashboard report payload adapter (pure, testable)**  
   Maps `DashboardMetrics` + Company display fields + period labels into a `DashboardReportPayload` (issuer block, period label, KPI array, chart summaries as numbers/labels, recent Ticket rows). Mirrors the invoice pattern: adapter knows domain; renderer does not.

5. **Dashboard report PDF renderer (vector, testable smoke)**  
   Server-side jsPDF vector renderer sharing the fintech invoice **color palette and drawing primitives** (navy gradient header, rounded cards, uppercase muted labels, es-MX money strings). Sections: header with Company name/contact, report title “Resumen del dashboard”, period, KPI grid, revenue summary (table or static bars), payment-status summary, recent Tickets table. **Do not** use html2canvas for this report—match Ticket invoice fidelity and performance.

6. **Dashboard report API route**  
   `GET` endpoint authenticated with `tickets.read`, optional `company_id` for system Company users, builds payload, returns `application/pdf` with `Content-Disposition: attachment`. Node runtime only. No uploaded PDFs.

### Technical constraints

- **Multi-tenancy:** Every query filters by `company_id`; respect soft deletes.
- **Permissions:** Dashboard page and APIs remain gated on `tickets.read`.
- **BigInt:** Format Ticket IDs as strings in payloads and PDF text.
- **Currency:** es-MX formatting consistent with dashboard UI and invoice PDFs.
- **Payment status:** Use shared `TicketPaymentStatus` logic (`paid` | `partial` | `pending`) and existing Spanish labels.
- **Revenue recognition:** Finished Tickets only for recognized revenue and cash-collected KPIs, consistent with current dashboard semantics; document whether saldo por cobrar includes unfinished and partial Tickets explicitly in adapter tests.
- **PDF production constraint:** Generate on demand from authoritative DB state; do not accept uploaded PDFs.
- **Export button placement:** Page-level action near existing dashboard chrome (e.g. beside period controls), labeled in Spanish (e.g. “Exportar PDF”).

### API / contracts (behavioral, not file paths)

- Expanded dashboard metrics response includes: `kpis` (four entries with `value`, `deltaPercent`, `sparklinePoints`), `revenueByMonth`, `paymentStatusBreakdown`, `recentTickets`, and legacy fields only if still needed for backward compatibility during migration.
- Dashboard PDF route accepts same Company scoping query param pattern as Ticket invoice download for system users.

### Payload shape (decision-rich sketch)

```ts
type DashboardKpiKey =
  | 'revenue'
  | 'cashCollected'
  | 'outstandingBalance'
  | 'activeTickets';

type DashboardReportPayload = {
  issuer: { name: string; phone?: string; address?: string; currencyCode: string };
  periodLabel: string; // e.g. "Mayo 2026"
  generatedAt: string;
  kpis: Array<{
    key: DashboardKpiKey;
    label: string;
    value: number;
    deltaPercent: number | null;
    sparkline: Array<{ label: string; value: number }>;
  }>;
  revenueByMonth: Array<{ label: string; revenue: number }>;
  paymentStatus: Array<{
    status: 'paid' | 'partial' | 'pending';
    label: string;
    count: number;
    amount: number;
  }>;
  recentTickets: Array<{
    id: string;
    clientName: string;
    total: number;
    paid: number;
    dateLabel: string;
    paymentStatusLabel: string;
  }>;
};
```

## Testing Decisions

- **Principle:** Test external behavior and stable contracts—aggregation outputs, payload mapping, API auth/scoping, and PDF smoke (valid bytes + expected text)—not chart pixel layout or jsPDF drawing internals.
- **Dashboard period aggregation:** Unit tests for month boundaries (including month rollover), delta percent math (including zero prior month), sparkline ordering, saldo por cobrar, active Ticket count, payment-status buckets, and finished vs unfinished rules. Prior art: existing dashboard-metrics unit tests and ticket-payment-status tests.
- **Dashboard metrics loader:** Integration or action-level tests that non-system users cannot pass another `company_id`; system users can when permitted; soft-deleted Tickets excluded.
- **Dashboard report payload adapter:** Unit tests mapping fixture metrics to payload labels, money formatting, and empty-state fallbacks.
- **PDF renderer:** Smoke test returning non-empty PDF buffer containing period label and at least one KPI label; no golden pixel comparison required for CI.
- **API route:** Auth failure without session; forbidden without `tickets.read`; 403/404 for cross-Company access consistent with Ticket invoice route tests.
- **UI:** Update existing dashboard chart tests for new chart types and empty states; optional Playwright smoke for Export button when E2E credentials configured (follow existing skip pattern).
- **Accessibility:** Retain sr-only data tables or aria labels on charts where the current dashboard does; verify reduced-motion disables chart animation.

## Out of Scope

- Tabbed dashboard sections (Finanzas / Operaciones / Clientes) in v1.
- Three-dot menus or per-KPI drill-down actions.
- CSV or Excel export (PDF only in v1).
- Custom global date-range picker driving all widgets.
- Top Services chart, ticket promedio KPI, and advanced table filters (Phase 2).
- New branding, dark-mode redesign, or animation system beyond existing motion tokens.
- Database schema migrations or seed changes.
- Changing Ticket payment audit behavior, Server Action payment flows, or Ticket invoice PDF layout.
- Persisting generated dashboard PDFs in blob storage.
- Accepting uploaded PDFs in production.
- Company logos in tables, CRM-style deal stages, or lead-source breakdowns from unrelated reference designs.

## Further Notes

- Design review locked: hybrid purpose, single page, four KPIs with calendar-month deltas on all cards, hero bar + payment-status side chart, recent Tickets table, mobile stack pattern A, reference-inspired visuals without KPI overflow menus.
- Backend already computes `totalCashCollected` and `totalServicesSold` today but UI underuses them; this PRD elevates cash collected and adds outstanding balance and active Tickets explicitly.
- Suggested feature branch when implementing: `feat/dashboard-analytics-redesign`.
- Slice breakdown (`to-issues`) can separate: (1) aggregation + KPI UI, (2) charts layout, (3) recent Tickets section, (4) PDF adapter + route + Export button.
