# IDOR audit matrix

Cross-tenant isolation coverage for the IDOR audit epic (PRD #184). Update **Status** and **Test file** as slices land.

**Legend:** ⬜ Not covered · 🟡 Partial · ✅ Covered · ⏭️ Exempt (public/cron)

**Expected denial:** Company B session accessing Company A resources → HTTP `403` or `404`; Server Actions → `{ success: false }` or `AuthorizationError`.

Fixtures: `src/test/idor-fixtures.ts`

## Public / exempt routes

| Route | Methods | Status | Notes |
| ----- | ------- | ------ | ----- |
| `/api/health` | GET | ⏭️ Exempt | No auth, no tenant data |
| `/api/auth/[...nextauth]` | * | ⏭️ Exempt | Authentication only |
| `/api/cron/jobs` | GET | ⏭️ Exempt | Bearer secret, no user session |
| `/api/cron/notifications` | GET | ⏭️ Exempt | Bearer secret, no user session |

## API routes — kept REST surfaces (#200)

Removed duplicate CRUD REST for clients, services, tickets, ticket-services, users, and company collection routes. IDOR coverage for those resources is via Server Actions (see below).

| Route | Methods | Status | Test file | Slice |
| ----- | ------- | ------ | --------- | ----- |
| `/api/tickets/[id]/invoice` | GET | ✅ | `tickets/[id]/invoice/route.test.ts` | #203 |
| `/api/companies/[id]/export` | GET | ✅ | `companies/[id]/export/route.test.ts` | #205 |
| `/api/companies/[id]/offboard` | POST | ✅ | `companies/[id]/offboard/route.test.ts` | #189 |
| `/api/companies/[id]/logo` | POST, DELETE | ✅ | `companies/[id]/logo/route.test.ts` | #189 |
| `/api/companies/[id]/readiness` | GET | ✅ | `companies/[id]/readiness/route.test.ts` | #189 |
| `/api/companies/[id]/entitlements` | GET | ✅ | `companies/[id]/entitlements/route.test.ts` | #189 |
| `/api/companies/[id]/operator-summary` | GET | ✅ | `companies/[id]/operator-summary/route.test.ts` | #189 |

## API routes — Audit, dashboard, realtime (#190)

| Route | Methods | Status | Test file | Slice |
| ----- | ------- | ------ | --------- | ----- |
| `/api/audit/events` | GET | ✅ | `audit/events/route.test.ts` | #190 |
| `/api/dashboard/report` | GET | ✅ | `dashboard/report/route.test.ts` | #190 |
| `/api/realtime` | GET | ⏭️ Exempt | `realtime/route.test.ts` (session-only SSE) | #190 |

## Server Actions — Clients & Services (#186)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `clients.ts` | getClients, getClientsList, getClient, createClient, updateClient, deleteClient, getClientsForExport, bulkImportClients | ✅ | `clients-actions.test.ts` | #186 |
| `services.ts` | getServices, getService, createService, updateService, deleteService, getServicesForExport, bulkImportServices | ✅ | `services-actions.test.ts` | #202 |

## Server Actions — Tickets (#187)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `tickets.ts` | createTicket, getTickets, getTicketsList, getTicketsPaginated, getTicketById, updateTicket, deleteTicket, finishTicket, applyTicketPayment, getTicketsForExport, getTicketAuditHistory | ✅ | `src/lib/tickets-actions.test.ts` | #187 |
| `ticket-services.ts` | getTicketServices, createServiceTicket, updateServiceTicket, deleteServiceTicket | ✅ | `src/lib/ticket-services-actions.test.ts` | #187 |

## Server Actions — Users, Roles, Permissions (#188)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `users.ts` | getUsers, getUsersPaginated, createUser, updateUser, updateOwnAccount, deleteUser | ✅ | `users-actions.test.ts` | #188 |
| `roles.ts` | getRoles, getRolesPaginated, createRole, updateRole, deleteRole | ✅ | `roles-actions.test.ts` | #188 |
| `permissions.ts` | getPermissions, getPermissionsByCompany, createPermission, updatePermission, deletePermission, assignPermissionToRole, removePermissionFromRole | ✅ | `permissions-actions.test.ts` | #188 |

## Server Actions — Companies & operator (#189)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `companies.ts` | getCompanies, getCompany, getOwnCompany, getCompanyReadiness, getOwnCompanyReadiness, createCompany, updateCompany, updateOwnCompany, uploadCompanyLogo, removeCompanyLogo, deleteCompany | ✅ | `src/lib/companies-actions.test.ts` | #189 |
| `company-portability.ts` | exportCompanyData, downloadCompanyExportJson, offboardCompany | ✅ | `src/lib/companies-actions.test.ts` | #189 |
| `company-lifecycle.ts` | setCompanyLifecycleStatus | ✅ | `src/lib/companies-actions.test.ts` | #189 |
| `company-operator.ts` | getCompanyOperatorSummary | ✅ | `src/lib/companies-actions.test.ts` | #189 |
| `company-entitlements.ts` | getCompanyEntitlements | ✅ | `src/lib/companies-actions.test.ts` | #189 |
| `exports.ts` | requestCompanyExport | ✅ | `src/lib/companies-actions.test.ts` | #189 |

## Server Actions — Remaining (#190)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `dashboard.ts` | loadDashboardMetricsForCompany, fetchDashboardMetrics | ✅ | `src/lib/dashboard-actions.test.ts` | #190 |
| `client-service-schedules.ts` | list*, upsert, pause, resume, delete | ✅ | `src/lib/client-service-schedules-actions.test.ts` | #190 |
| `trash.ts` | getTrash, restoreClient, restoreService, restoreTicket | ✅ | `src/lib/trash-actions.test.ts` | #190 |
| `search.ts` | globalSearch | ✅ | `src/lib/search-actions.test.ts` | #190 |
| `notifications.ts` | getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead | ✅ | `src/lib/notifications-actions.test.ts` | #190 |
| `authz.ts` | getSessionPermissionMap | ⏭️ Exempt | — (session-scoped; filters permissions by caller company) | #190 |

## Shared helpers

| Module | Status | Test file |
| ------ | ------ | --------- |
| `authz-context.ts` (resolveWritableCompanyId) | ✅ | `src/lib/idor.test.ts` |
| `tenant.ts` (tenantScope, assertTenantOwnership) | ✅ | `src/lib/tenant.test.ts` |
| `security.ts` (checkPermission cross-tenant) | ✅ | `src/lib/security.test.ts` |
| IDOR fixtures | ✅ | `src/test/idor-fixtures.test.ts` |

## Schema — `company_id` foreign keys

| Table | FK status | Migration |
| ----- | --------- | --------- |
| Client, Service, Ticket | ✅ NOT VALID | `0014_tenant_fks_and_unique` |
| ClientServiceSchedule, TicketPayment, Notification | ✅ NOT VALID | `0014` |
| Role, Permission, User | ✅ | `0004_rbac_foreign_keys` |
| GovernanceAuditEvent.company_id | ✅ | `0008_governance_audit` |
| TicketAuditEvent.company_id | ✅ NOT VALID | `0019_idor_audit_fks` |
| TicketAuditEvent.actor_user_id | ✅ NOT VALID | `0019_idor_audit_fks` |
| ServicesTickets | ⏭️ N/A | Junction via ticket/service FKs in `0014` |
| AuditEvent | ✅ | `0009_audit_event` |

## CI (#191)

| Check | Status |
| ----- | ------ |
| `npm run test:idor` script | ✅ |
| CI runs IDOR suite | ✅ |
| Matrix coverage gate | ✅ |
| Zero known leaks | ✅ |

## Audit sign-off

- **Last updated:** slice #191 — CI gate and epic sign-off
- **Known leaks:** none identified across audited surfaces
- **Reviewer sign-off:** automated matrix + IDOR test suite green in CI
