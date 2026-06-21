# UI data access layer

ZigZag uses **Server Actions** for most dashboard mutations and list reads, and
**API routes** where the browser needs REST-style fetch (PDF download, audit
pagination, legacy edit forms, or external consumers).

When fixing auth, validation, or soft-delete behavior for clients, services,
tickets, or users, update **both** layers unless the surface is explicitly
single-path below.

See also: [rbac-audit-matrix.md](rbac-audit-matrix.md),
[soft-delete-policy.md](soft-delete-policy.md).

## Server Actions (primary)

| UI surface | Action module | Notes |
|---|---|---|
| Tickets list, create, detail actions | `src/actions/tickets.ts` | Lists, create, update, delete, finish, collect payment |
| Ticket service lines editor | `src/actions/ticket-services.ts` | CRUD on `ServicesTickets` |
| Clients list and forms | `src/actions/clients.ts` | List, create, update, delete |
| Services list and create form | `src/actions/services.ts` | List, create, update, delete |
| Users list | `src/actions/users.ts` | Admin user CRUD; `updateOwnAccount` for `/account` |
| Roles / permissions lists | `src/actions/roles.ts`, `permissions.ts` | Admin RBAC |
| Companies list and forms | `src/actions/companies.ts` | System-company admin |
| Company logo, lifecycle, portability | `company-lifecycle.ts`, `company-portability.ts` | Operator flows |
| Company entitlements / operator summary | `company-entitlements.ts`, `company-operator.ts` | Operator console panels |
| Dashboard metrics widgets | `src/actions/dashboard.ts` | KPIs and recent tickets |
| Service schedules | `src/actions/client-service-schedules.ts` | Schedule CRUD and finish dialog |

## API routes (browser fetch)

| UI surface | Route | Why API |
|---|---|---|
| Ticket edit preload | `GET /api/tickets/[id]` | `tickets/[id]/edit/page.tsx` hydrates form via fetch |
| Service edit preload / save | `GET/PATCH /api/services/[id]` | `services/[id]/edit/page.tsx` |
| Invoice PDF download | `GET /api/tickets/[id]/invoice` | `pdf-download-button.tsx` streams PDF |
| Dashboard report export | `GET /api/dashboard/report` | `dashboard-metrics-client.tsx` PDF export |
| Audit log (system company) | `GET /api/audit/events` | Paginated client-side fetch in audit console |
| Company picker (system user) | `GET /api/companies` | `app-sidebar.tsx` loads tenant list |

## Dual-path resources

These domains exist in **both** `src/actions/` and `src/app/api/`. Keep behavior
aligned (RBAC permission, `company_id` scope, soft delete, audit events).

| Resource | Server Actions | API routes |
|---|---|---|
| Clients | `src/actions/clients.ts` | `/api/clients`, `/api/clients/[clientId]` |
| Services | `src/actions/services.ts` | `/api/services`, `/api/services/[id]` |
| Tickets | `src/actions/tickets.ts`, `ticket-services.ts` | `/api/tickets/[id]`, `/api/tickets/[id]/services*` |
| Users | `src/actions/users.ts` | `/api/users` |
| Companies | `src/actions/companies.ts` (+ lifecycle) | `/api/companies`, `/api/companies/[id]/*` |

Ticket **mutations** from the dashboard UI go through Server Actions. Ticket
**detail JSON** for the edit page and **invoice PDF** use API routes.

## Maintenance checklist

When changing one layer for a dual-path resource:

1. Match permission (`requireActionPermission` ↔ `requireApiPermission`).
2. Filter `deleted_at IS NULL` on reads and use soft delete on writes.
3. Emit the same audit events (`TicketAuditEvent`, governance audit, etc.).
4. Update this doc and [rbac-audit-matrix.md](rbac-audit-matrix.md) if routes or guards change.
