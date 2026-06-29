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

## API routes — Clients & Services (#186)

| Route | Methods | Status | Test file | Slice |
| ----- | ------- | ------ | --------- | ----- |
| `/api/clients` | GET, POST | ✅ | `clients/route.test.ts` | #186 |
| `/api/clients/[clientId]` | GET, PATCH, DELETE | ✅ | `clients/[clientId]/route.test.ts` | #186 |
| `/api/services` | GET, POST | ✅ | `services/route.test.ts` | #186 |
| `/api/services/[id]` | GET, PUT, DELETE | ✅ | `services/[id]/route.test.ts` | #186 |

## API routes — Tickets (#187)

| Route | Methods | Status | Test file | Slice |
| ----- | ------- | ------ | --------- | ----- |
| `/api/tickets/[id]` | GET | 🟡 | `route.test.ts` (RBAC only) | #187 |
| `/api/tickets/[id]/services` | GET, POST | ⬜ | — | #187 |
| `/api/tickets/[id]/services/[serviceId]` | PUT, DELETE | ⬜ | — | #187 |
| `/api/tickets/[id]/invoice` | GET | 🟡 | `invoice/route.test.ts` (partial) | #187 |

## API routes — Users (#188)

| Route | Methods | Status | Test file | Slice |
| ----- | ------- | ------ | --------- | ----- |
| `/api/users` | GET, POST | ✅ | `users/route.test.ts` | #188 |

## API routes — Companies & operator (#189)

| Route | Methods | Status | Test file | Slice |
| ----- | ------- | ------ | --------- | ----- |
| `/api/companies` | GET, POST, PUT | ⬜ | — | #189 |
| `/api/companies/[id]/export` | GET | ⬜ | — | #189 |
| `/api/companies/[id]/offboard` | POST | ⬜ | — | #189 |
| `/api/companies/[id]/logo` | POST, DELETE | ⬜ | — | #189 |
| `/api/companies/[id]/readiness` | GET | ⬜ | — | #189 |
| `/api/companies/[id]/entitlements` | GET | ⬜ | — | #189 |
| `/api/companies/[id]/operator-summary` | GET | ⬜ | — | #189 |

## API routes — Audit, dashboard, realtime (#190)

| Route | Methods | Status | Test file | Slice |
| ----- | ------- | ------ | --------- | ----- |
| `/api/audit/events` | GET | 🟡 | `events/route.test.ts` (partial) | #190 |
| `/api/dashboard/report` | GET | ⬜ | — | #190 |
| `/api/realtime` | GET | ⬜ | — | #190 |

## Server Actions — Clients & Services (#186)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `clients.ts` | getClients, getClientsList, getClient, createClient, updateClient, deleteClient, getClientsForExport, bulkImportClients | ✅ | `clients-actions.test.ts` | #186 |
| `services.ts` | getServices, createService, updateService, deleteService, getServicesForExport, bulkImportServices | ✅ | `services-actions.test.ts` | #186 |

## Server Actions — Tickets (#187)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `tickets.ts` | createTicket, getTickets, getTicketsList, getTicketsPaginated, getTicketById, updateTicket, deleteTicket, finishTicket, applyTicketPayment, getTicketsForExport, getTicketAuditHistory | ⬜ | — | #187 |
| `ticket-services.ts` | getTicketServices, createServiceTicket, updateServiceTicket, deleteServiceTicket | ⬜ | — | #187 |

## Server Actions — Users, Roles, Permissions (#188)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `users.ts` | getUsers, getUsersPaginated, createUser, updateUser, updateOwnAccount, deleteUser | ✅ | `users-actions.test.ts` | #188 |
| `roles.ts` | getRoles, getRolesPaginated, createRole, updateRole, deleteRole | ✅ | `roles-actions.test.ts` | #188 |
| `permissions.ts` | getPermissions, getPermissionsByCompany, createPermission, updatePermission, deletePermission, assignPermissionToRole, removePermissionFromRole | ✅ | `permissions-actions.test.ts` | #188 |

## Server Actions — Companies & operator (#189)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `companies.ts` | getCompanies, getCompany, getOwnCompany, getCompanyReadiness, getOwnCompanyReadiness, createCompany, updateCompany, updateOwnCompany, uploadCompanyLogo, removeCompanyLogo, deleteCompany | ⬜ | — | #189 |
| `company-portability.ts` | exportCompanyData, downloadCompanyExportJson, offboardCompany | ⬜ | — | #189 |
| `company-lifecycle.ts` | setCompanyLifecycleStatus | ⬜ | — | #189 |
| `company-operator.ts` | getCompanyOperatorSummary | ⬜ | — | #189 |
| `company-entitlements.ts` | getCompanyEntitlements | ⬜ | — | #189 |
| `exports.ts` | requestCompanyExport | ⬜ | — | #189 |

## Server Actions — Remaining (#190)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `dashboard.ts` | loadDashboardMetricsForCompany, fetchDashboardMetrics | ⬜ | — | #190 |
| `client-service-schedules.ts` | list*, upsert, pause, resume, delete | ⬜ | — | #190 |
| `trash.ts` | getTrash, restoreClient, restoreService, restoreTicket | ⬜ | — | #190 |
| `search.ts` | globalSearch | ⬜ | — | #190 |
| `notifications.ts` | getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead | ⬜ | — | #190 |
| `authz.ts` | getSessionPermissionMap | ⬜ | — | #190 |
| `two-factor.ts` | getTwoFactorStatus, startTwoFactorEnrollment, confirmTwoFactorEnrollment, disableTwoFactor | ⬜ | — | #190 |

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
| `npm run test:idor` script | ⬜ |
| CI runs IDOR suite | ⬜ |
| Matrix coverage gate | ⬜ |
| Zero known leaks | ⬜ |

## Audit sign-off

- **Last updated:** foundation slice (#185)
- **Known leaks:** TBD (fix in owning slice)
- **Reviewer sign-off:** pending epic completion (#191)
