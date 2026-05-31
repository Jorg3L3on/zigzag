# RBAC Policy

ZigZag uses role-based access control plus tenant scoping for every protected
business workflow.

## Protected Surfaces

- Server actions must call `requireActionPermission()` or an equivalent helper
  that calls `checkPermission()`.
- API routes must call `requireApiPermission()` or `requireSession()` before
  reading or mutating tenant data.
- Dashboard routes must be protected by `requirePagePermission()` in the page or
  nearest route segment layout.

System-company users (`company.is_system = true`) can act across companies. All
other users are restricted to their own `company_id`.

## Intentional Exceptions

- `/api/auth/[...nextauth]` is the authentication endpoint.
- `/api/health` is public and only returns service health.
- `/dashboard/account` is authenticated self-service. It does not require a role
  permission, but it is covered by the dashboard active-session guard.
- `/dashboard/forbidden` is authenticated and intentionally reachable after a
  failed page permission check.

## Edge-role policy

| Scenario | Server | UI |
| --- | --- | --- |
| `tickets.write` without `tickets.read` | Write actions allowed when reached; read actions denied | Read-guarded pages redirect/deny; mutation controls hidden without write |
| Schedule write via `clients.write` | `requireScheduleWrite` falls back to `clients.write` | Schedule write controls visible with either permission |
| Read-only viewer | Read guards pass; write guards fail | Create/edit/delete controls hidden; payment collect hidden |
| System company without selected tenant | Server rejects missing company context | Lists/widgets show selected-company empty state |
| Admin resources (users, roles, permissions, companies) | Requires permission + system company for cross-tenant admin | Sidebar and write CTAs require `isSystem` and write permission |

Contract modules under `src/lib/*-rbac.ts` are the canonical policy surface for UI and server helpers.

