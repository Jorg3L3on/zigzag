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

The static RBAC coverage test enforces these rules so new routes or actions do
not bypass authorization accidentally.
