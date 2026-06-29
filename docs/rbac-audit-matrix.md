# RBAC audit matrix

This matrix documents the intentional authorization surface for ZigZag. Server
checks are authoritative; client checks only hide unavailable controls.

## Public routes

| Surface | Status | Notes |
|---|---|---|
| `src/app/api/auth/[...nextauth]/route.ts` | Public auth endpoint | Handled by NextAuth |
| `src/app/api/health/route.ts` | Public health endpoint | No tenant data |
| `/login` | Public page | Auth entry point |

## Auth-only routes

| Surface | Guard | Notes |
|---|---|---|
| `src/app/dashboard/layout.tsx` | `requireActionAuth()` | Active user and active company required |
| `src/app/dashboard/account/page.tsx` | Dashboard layout | Self-service page |
| `updateOwnAccount()` | `requireActionAuth()` | May only update the authenticated user's own name, email, and password |

## Dashboard pages

| Surface | Permission | Extra guard |
|---|---|---|
| `/dashboard` | `tickets.read` | Dashboard metrics are ticket-scoped |
| `/dashboard/tickets` | `tickets.read` | Write CTA hidden without `tickets.write` |
| `/dashboard/tickets/create` | `tickets.write` | Layout guard |
| `/dashboard/tickets/[id]` | `tickets.read` | Tenant scope in data loader |
| `/dashboard/tickets/[id]/edit` | `tickets.write` | Layout guard |
| `/dashboard/tickets/[id]/services` | `tickets.write` | Layout guard |
| `/dashboard/clients` | `clients.read` | Write CTA hidden without `clients.write` |
| `/dashboard/clients/new` | `clients.write` | Page guard |
| `/dashboard/clients/[id]/edit` | `clients.write` | Page guard |
| `/dashboard/services` | `services.read` | Write CTA hidden without `services.write` |
| `/dashboard/services/new` | `services.write` | Layout guard |
| `/dashboard/services/[id]/edit` | `services.write` | Layout guard |
| `/dashboard/users` | `users.read` | Write controls require System company |
| `/dashboard/roles` | `roles.read` | Write controls require System company |
| `/dashboard/permissions` | `permissions.read` | Write controls require System company |
| `/dashboard/companies` | `companies.read` | Write controls require System company |
| `/dashboard/companies/new` | `companies.write` | System company page guard |
| `/dashboard/companies/[id]/edit` | `companies.write` | System company page guard |
| `/dashboard/audit` | System company only | `requireSystemPage()`; not permission-based |

## API routes

| Surface | Permission | Notes |
|---|---|---|
| `GET /api/clients` | `clients.read` | Company-scoped list (read-only REST; mutations via Server Actions) |
| `GET /api/clients/[clientId]` | `clients.read` | Company-scoped detail (read-only REST; mutations via Server Actions) |
| `GET /api/services` | `services.read` | Company-scoped |
| `POST /api/services` | `services.write` | Company-scoped |
| `GET /api/services/[id]` | `services.read` | Company-scoped |
| `PUT /api/services/[id]` | `services.write` | Company-scoped |
| `DELETE /api/services/[id]` | `services.write` | Soft delete |
| `GET /api/tickets/[id]` | `tickets.read` | Company-scoped |
| `GET /api/tickets/[id]/invoice` | `tickets.read` | Company-scoped PDF |
| `GET /api/tickets/[id]/services` | `tickets.read` | Company-scoped via ticket |
| `POST /api/tickets/[id]/services` | `tickets.write` | Company-scoped via ticket |
| `PUT /api/tickets/[id]/services/[serviceId]` | `tickets.write` | Company-scoped via ticket |
| `DELETE /api/tickets/[id]/services/[serviceId]` | `tickets.write` | Company-scoped via ticket |
| `GET /api/dashboard/report` | `tickets.read` | Dashboard metrics PDF export; company-scoped |
| `GET /api/users` | `users.read` | System sees all; regular users see own company |
| `POST /api/users` | `users.write` | System company only |
| `GET /api/companies` | `companies.read` | System sees all; regular users see own company |
| `POST /api/companies` | `companies.write` | System company only |
| `PUT /api/companies` | `companies.write` | System company only for administrative updates |
| `GET /api/companies/[id]/export` | `companies.read` | System company operator; tenant export bundle |
| `GET /api/companies/[id]/entitlements` | `companies.read` | Company-scoped entitlement usage |
| `GET /api/companies/[id]/readiness` | `companies.read` | Company-scoped readiness assessment |
| `GET /api/companies/[id]/operator-summary` | `companies.read` | System company only |
| `POST /api/companies/[id]/offboard` | `companies.write` | System company operator |
| `POST /api/companies/[id]/logo` | `companies.write` | System company operator |
| `DELETE /api/companies/[id]/logo` | `companies.write` | System company operator |
| `GET /api/audit/events` | System company only | `requireSession()` + `company_is_system`; unified audit log read |

Company tenant sub-routes (export, offboard, logo, readiness, entitlements) are
also documented in [company-tenant-runbook.md](company-tenant-runbook.md).

`requireSession()` refreshes `company_id`, `company_name`, and
`company_is_system` from persisted user/company data before API routes make
scope decisions.

## Server actions

| Module | Read guard | Write guard |
|---|---|---|
| `src/actions/dashboard.ts` | `checkPermission('tickets.read')` | N/A |
| `src/actions/tickets.ts` | `tickets.read` | `tickets.write` |
| `src/actions/ticket-services.ts` | `tickets.read` | `tickets.write` |
| `src/actions/clients.ts` | `clients.read` | `clients.write` |
| `src/actions/services.ts` | `services.read` | `services.write` |
| `src/actions/users.ts` | `users.read` | `users.write` plus System company, except `updateOwnAccount()` |
| `src/actions/roles.ts` | `roles.read` | `roles.write` plus System company |
| `src/actions/permissions.ts` | `permissions.read` | `permissions.write` plus System company |
| `src/actions/companies.ts` | `companies.read` | `companies.write` plus System company |
| `src/actions/authz.ts` | Auth-only | Returns current user's permission map |

## Regression coverage

| Test | Coverage |
|---|---|
| `src/lib/rbac-coverage.test.ts` | Server action, API route, and dashboard page guard coverage |
| `src/app/api/tickets/[id]/route.test.ts` | Ticket detail API RBAC (403 without `tickets.read`) |
| `src/app/api/tickets/[id]/invoice/route.test.ts` | Invoice PDF API RBAC (403 without `tickets.read`) |
| `src/lib/security.test.ts` | Permission checks, System company bypass, stale root claim denial |
| `src/lib/api-helpers.test.ts` | API session company claim refresh |
| `src/lib/permissions.test.ts` | Shared client/server permission helper contract |
