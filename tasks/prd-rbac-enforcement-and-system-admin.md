# RBAC enforcement and System admin

**Status:** Applied

**Evidence:** `src/lib/permissions.ts`, `src/hooks/use-permissions.ts`,
`src/lib/security.ts`, `src/lib/api-helpers.ts`,
`src/lib/rbac-coverage.test.ts`, `src/lib/api-helpers.test.ts`,
`src/lib/security.test.ts`, and [docs/rbac-audit-matrix.md](../docs/rbac-audit-matrix.md).

## Problem Statement

Zigzag already has role-based access control across most Server Actions, API routes, and dashboard pages, plus a System company exception for cross-tenant administration. The current implementation is effective on the server for the main product surface, but the enforcement model is distributed and unevenly visible in the client. This makes it hard to confidently answer whether every action is protected, whether unauthorized users see actions they cannot perform, and whether the System company exception is intentionally constrained.

The user needs RBAC to be consistent across server and client side behavior: every protected action should have clear server enforcement, every dashboard page and client control should reflect the same permission model, and System company users should be able to administer the platform without accidentally relying on stale or ambiguous authorization checks.

## Solution

Standardize RBAC enforcement and visibility across Zigzag. Preserve the current permission vocabulary and System company model, but make the behavior explicit, testable, and consistent.

The solution should introduce a central permission contract for dashboard resources and actions, then use that contract from page guards, Server Actions, API routes, and client components. Server enforcement remains the source of truth. Client-side RBAC should only hide or disable unavailable controls and improve the experience; it must not become the only protection.

The System company exception should remain: users whose Company has `is_system = true` can administer all companies. However, the code should make that exception deliberate and auditable, avoid unnecessary trust in stale session claims where possible, and keep root-only operations behind explicit System company checks.

## User Stories

1. As a System company user, I want to access every Company, Ticket, Client, Service, User, Role, and Permission surface, so that I can administer the entire Zigzag installation.
2. As a System company user, I want to switch company context intentionally, so that cross-company actions happen against the correct tenant.
3. As a System company user, I want root-only operations to remain explicit, so that user, role, permission, and company administration is not accidentally granted by a normal role.
4. As a System company user, I want all root-only Server Actions to check System company status from current persisted data, so that stale session state does not over-authorize sensitive changes.
5. As a System company user, I want company-scoped records to remain scoped when I choose a Company, so that I do not accidentally mutate the wrong tenant's data.
6. As a non-system user with a role, I want to see only navigation items I can read, so that the dashboard reflects my actual access.
7. As a non-system user with read-only permissions, I want write controls hidden or disabled, so that I do not attempt operations that will fail.
8. As a non-system user without a role, I want protected pages and actions denied by default, so that access fails closed.
9. As a non-system user, I want to access only my own Company's Tickets, Clients, and Services, so that tenant data remains isolated.
10. As a non-system user, I want API routes to enforce the same permissions as the UI, so that direct HTTP calls cannot bypass the dashboard.
11. As a non-system user, I want Server Actions to enforce the same permissions as page guards, so that direct action invocation cannot bypass the dashboard.
12. As a user with `tickets.read`, I want to list and view Tickets for my Company, so that I can inspect work items I am allowed to see.
13. As a user without `tickets.read`, I want ticket list and detail pages blocked, so that Ticket data is not exposed.
14. As a user with `tickets.write`, I want to create, update, finish, delete, and collect payments on Tickets for my Company, so that I can manage Ticket workflows.
15. As a user without `tickets.write`, I want Ticket write controls hidden and write actions rejected, so that I cannot modify Tickets.
16. As a user with `tickets.write`, I want Ticket payment and status changes to continue producing immutable Ticket audit events, so that financial and status changes remain traceable.
17. As a user with `clients.read`, I want to list and view Clients for my Company, so that I can use client information.
18. As a user without `clients.read`, I want Client pages and API reads blocked, so that Client data is not exposed.
19. As a user with `clients.write`, I want to create, update, and soft-delete Clients for my Company, so that I can maintain the Client catalog.
20. As a user without `clients.write`, I want Client write controls hidden and write actions rejected, so that I cannot modify Clients.
21. As a user with `services.read`, I want to list and view Services for my Company, so that I can use the Service catalog.
22. As a user without `services.read`, I want Service pages and API reads blocked, so that Service data is not exposed.
23. As a user with `services.write`, I want to create, update, and soft-delete Services for my Company, so that I can maintain the Service catalog.
24. As a user without `services.write`, I want Service write controls hidden and write actions rejected, so that I cannot modify Services.
25. As a System company user with `users.read` bypassed by root status, I want to list users across companies, so that I can administer accounts.
26. As a non-system user with `users.read`, I want to list only users in my Company, so that user data remains tenant-scoped.
27. As a non-system user, I should not be able to create, update, or delete users through user administration, so that account administration remains root-only.
28. As a signed-in user, I want to update my own account details through a dedicated self-service path, so that profile maintenance does not require System company privileges.
29. As a System company user, I want to create and update roles for any Company, so that tenants can have tailored access models.
30. As a non-system user, I should not be able to create, update, or delete roles, so that privilege management remains root-only.
31. As a System company user, I want to assign only permissions that are global or belong to the target Company, so that roles cannot cross tenant boundaries incorrectly.
32. As a System company user, I want to create and update Permissions where appropriate, so that the permission catalog can be administered safely.
33. As a non-system user, I should not be able to create, update, delete, assign, or remove Permissions, so that permission management remains root-only.
34. As a user with `companies.read`, I want Company reads scoped according to System company status, so that root sees all companies and normal users see only their own.
35. As a non-system user, I should not be able to create, delete, or administratively update Companies, so that tenant administration remains root-only.
36. As an implementer, I want a central permission contract, so that dashboard pages, Server Actions, API routes, and client controls use the same permission names.
37. As an implementer, I want root-only checks to be separate from permission checks, so that `*.write` permissions do not accidentally imply platform administration.
38. As an implementer, I want an audit matrix of routes and actions, so that every Server Action and API route has an explicit permission or documented public status.
39. As an implementer, I want RBAC tests to cover allowed and denied behavior, so that future changes do not weaken authorization.
40. As an implementer, I want client permission helpers to be easy to use, so that new buttons and menus consistently reflect permissions.
41. As an implementer, I want public routes such as health checks documented as public, so that intentional exceptions are distinguishable from missing RBAC.
42. As a product owner, I want the dashboard to avoid dead-end actions, so that users are not shown controls they cannot successfully use.
43. As a product owner, I want server security to remain authoritative even when client controls are hidden, so that UI bugs do not become security bugs.
44. As a maintainer, I want authorization failures to return the established error shape, so that client handling remains consistent.
45. As a maintainer, I want BigInt IDs and soft deletes handled correctly in protected responses, so that RBAC changes do not regress existing data contracts.

## Implementation Decisions

- Keep the existing RBAC model: Users belong to a Company and may have a Role; Roles receive Permissions through role-permission assignments.
- Keep the existing System company exception: a user is a root administrator when their Company has `is_system = true`.
- Treat server enforcement as authoritative. Client RBAC is for navigation and control visibility only.
- Introduce or formalize a central permission contract that defines resource permissions such as `tickets.read`, `tickets.write`, `clients.read`, `clients.write`, `services.read`, `services.write`, `users.read`, `users.write`, `roles.read`, `roles.write`, `permissions.read`, `permissions.write`, `companies.read`, and `companies.write`.
- Introduce a reusable client authorization helper or provider that exposes `isSystem`, `can(permission)`, and root-only status to dashboard components.
- Update dashboard action controls so write actions are hidden or disabled when the user lacks the matching `*.write` permission.
- Keep page-level guards for protected dashboard pages.
- Keep API route guards on every non-public API route.
- Keep Server Action guards on every data mutation and protected read.
- Document intentional public API routes, including health checks and authentication routes.
- Separate "has permission" from "is System company user". Root-only flows must continue to require explicit System company checks.
- Review account self-service separately from user administration. A signed-in user should have a narrow self-update path that does not require System company status or broad `users.write`.
- Reduce reliance on stale session claims for root-only decisions by validating active user and Company status from persisted data before sensitive root-only operations.
- Preserve Company scoping for all Company-owned resources. Non-system users must remain restricted to their own `company_id`.
- Preserve soft-delete filtering across protected reads and writes.
- Preserve Ticket audit event behavior for Ticket status and payment changes.
- Add an RBAC audit matrix as developer documentation or tests, mapping pages, Server Actions, and API routes to their required permissions or documented public status.

## Testing Decisions

- Tests should validate external authorization behavior, not implementation details. A good RBAC test asserts whether a user can or cannot perform an operation and what data scope is returned.
- Unit test the central permission contract and helper behavior, including System company bypass, missing role denial, deleted role denial, missing permission denial, company mismatch denial, and global/company-specific permission matching.
- Extend existing security tests that already cover `checkPermission` behavior.
- Add Server Action tests for representative reads and writes across Tickets, Clients, Services, Users, Roles, Permissions, and Companies.
- Add API route tests for representative protected routes to verify unauthorized, forbidden, regular user, and System company behavior.
- Add page guard tests or integration coverage for dashboard routes requiring read/write permissions.
- Add focused client tests for action visibility: users with read-only permissions should not see write controls, while System company users should see all appropriate controls.
- Add regression coverage for account self-service so normal users can update their own account without gaining user administration privileges.
- Add regression coverage for System company users acting across companies with explicit company context.
- Use prior art from existing security tests and proxy tests for authorization-style cases.
- Use existing Jest patterns for Server Actions and helper tests.
- Use Playwright only where client visibility and real dashboard flows need browser-level verification.

## Out of Scope

- Replacing NextAuth or the JWT session model.
- Replacing Drizzle or changing the canonical database workflow.
- Adding a new external identity provider.
- Adding database row-level security.
- Redesigning the full dashboard navigation or information architecture.
- Changing the existing permission names unless a specific mismatch is discovered during implementation.
- Changing Ticket audit event semantics beyond preserving current audit requirements.
- Building a full audit log UI for authorization decisions.
- Implementing offline/PWA permission synchronization.

## Further Notes

- The current code already has strong foundations: shared API helpers, shared page authorization, Server Action permission checks, and explicit System company helpers.
- The biggest practical gap is consistency: client controls do not always reflect write permissions, and the authorization rules are spread across many modules.
- The account self-service flow should be handled carefully because it currently appears to call the same user administration action that requires System company access.
- System company status is a powerful root exception. It should stay deliberate, explicit, and covered by tests.
