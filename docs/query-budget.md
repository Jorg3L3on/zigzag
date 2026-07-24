# Query budget (execution plan 2.2)

Tenant list queries always filter by `company_id` (and usually `deleted_at IS NULL`).
This doc records acceptable **database** execution budgets, the indexes that keep
plans on index scans at scale, and the 10k-ticket / 1k-client baseline.

## How to reproduce

```bash
# Prefer a disposable Neon branch (or local Postgres), not production.
npm run db:migrate
npm run seed:perf          # company "__perf_baseline__": 1k clients, 10k tickets
npm run query:audit        # EXPLAIN (ANALYZE, BUFFERS) + budget check
npm run query:audit -- --json
```

Budgets measure **Postgres execution time** after a warm cache (planning excluded).
They do not include Next.js / network / React hydration. Full-list actions that
ship thousands of rows to the browser can still feel slow even when SQL is fast.

## Indexes (migration `0023_query_audit_active_indexes`)

| Index | Matches |
|-------|---------|
| `Ticket_company_id_created_at_active_idx` | `WHERE company_id AND deleted_at IS NULL ORDER BY created_at DESC` |
| `Ticket_company_id_finished_active_idx` | Active tickets filtered by `finished` / cheap `count(*)` |
| `Client_company_id_created_at_active_idx` | Active client list / pagination |
| `Service_company_id_created_at_active_idx` | Active service catalog |
| `User_company_id_created_at_active_idx` | Active user roster |
| `TicketAuditEvent_ticket_id_created_at_idx` | Per-ticket audit history |
| `TicketAuditEvent_company_id_created_at_idx` | Tenant-scoped ticket audit browse |

Earlier migrations already cover `Ticket`/`Client` `(company_id, created_at)`,
`AuditEvent (target_company_id, occurred_at)`, and pg_trgm search indexes.

Partial (`WHERE deleted_at IS NULL`) indexes match the live list predicates so the
planner prefers index scans once a tenant grows past a few pages of heap.

## N+1 review (list endpoints)

| Action / helper | Relations | Pattern |
|-----------------|-----------|---------|
| `getTickets` | `services_tickets.service` | Drizzle relational batch (constant query count) |
| `getTicketsList` / `getTicketsPaginated` | none | Single `SELECT` |
| `getClients` / `getClientsList` | none | Single `SELECT` |
| `getServices` | none | Single `SELECT` |
| `getUsers` / `getUsersPaginated` | `company`, `role` | Drizzle relational batch |
| `getTicketAuditHistory` | `actor` | Drizzle relational batch |
| `queryAuditEvents` | none | Single `SELECT` + limit |
| `fetchDashboardActivity` | actors | `inArray` batch per page (not per row) |

No list path issues a per-row query inside a loop. Detail endpoints
(`getTicketById`) eager-load payments / services in the same relational query.

## Budgets (ms, execution time)

| Endpoint / shape | Action | Budget | Notes |
|------------------|--------|--------|-------|
| `tickets.list` | `getTicketsList` | **150 ms** | Full active roster; prefer pagination above ~2k tickets for UI |
| `tickets.paginated` | `getTicketsPaginated` | **80 ms** | Page size ≤ 100 |
| `tickets.count` | paginated total | **80 ms** | Same predicate as list |
| `clients.list` | `getClientsList` | **100 ms** | Full active roster |
| `clients.paginated` | `getClients` | **60 ms** | |
| `services.list` | `getServices` | **40 ms** | Catalog stays small |
| `users.list` | `getUsers` / paginated | **40 ms** | |
| `audit.events` | `queryAuditEvents` | **60 ms** | Limit ≤ 100 |
| `ticket.audit-history` | `getTicketAuditHistory` | **40 ms** | Per ticket |

`npm run query:audit` exits non-zero if a budget is exceeded, or if a Seq Scan on
a tenant table returns ≥ 200 rows (tiny Service/User catalogs may still Seq Scan
legitimately when the table fits in one page).

## Baseline run (2026-07-24)

Environment: Neon branch `perf-query-audit-22` (`br-red-cake-ambjfmxe`), PG 17,
indexes from `0023` applied, dataset for company `__perf_baseline__` (id `6`):

| Metric | Count |
|--------|------:|
| Clients | 1 000 |
| Services | 25 |
| Tickets | 10 000 |
| AuditEvent | 2 000 |
| TicketAuditEvent | 250 |

`EXPLAIN (ANALYZE, BUFFERS)` (warm cache):

| Shape | Plan | Execution |
|-------|------|----------:|
| `tickets.list` | **Index Scan** `Ticket_company_id_created_at_active_idx` | **3.99 ms** |
| `tickets.paginated` (20) | **Index Scan** same | **0.06 ms** |
| `tickets.count` | **Index Only Scan** `Ticket_company_id_finished_active_idx` | **1.58 ms** |
| `clients.list` | Seq Scan when table ≈ only this tenant; with multi-tenant filler → **Bitmap Index Scan** `Client_company_id_idx` + sort | **0.42–0.44 ms** |
| `clients.paginated` (20) | **Index Scan** `Client_company_id_created_at_active_idx` | **0.04 ms** |
| `services.list` | Seq Scan (42 rows total heap — expected) | **0.04 ms** |
| `users.list` | Seq Scan (8 rows — expected; no users on perf company) | **0.03 ms** |
| `audit.events` (51) | **Index Scan** `AuditEvent_target_company_id_occurred_at_idx` | **0.14 ms** |
| `ticket.audit-history` | **Bitmap Index Scan** `TicketAuditEvent_ticket_id_idx` | **0.09 ms** |

All shapes are within budget. Ticket and audit list paths use indexes at the
10k-ticket scale. Service/User catalogs remain heap-scanned while tiny; the
active composite indexes are in place for growth.

## UI note

`TicketsList` still calls `getTicketsList` (full roster) for client-side filters.
SQL is fine at 10k (~4 ms), but payload size dominates UX. Prefer
`getTicketsPaginated` (or server-side filters) before a tenant approaches the
`tickets.list` budget or multi-megabyte JSON responses.
