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

## API routes — Audit, dashboard (#190)

| Route | Methods | Status | Test file | Slice |
| ----- | ------- | ------ | --------- | ----- |
| `/api/audit/events` | GET | ✅ | `audit/events/route.test.ts` | #190 |

`/api/realtime` (session-only SSE over Postgres LISTEN) was removed in ZIG-I20-3; the notification bell refreshes on focus and with a visible-tab poll instead.

## Server Actions — Clients & Services (#186)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `clients.ts` | getClients, getClientsList, getClient, createClient, updateClient, deleteClient, bulkImportClients | ✅ | `clients-actions.test.ts` | #186 |
| `services.ts` | getServices, getService, createService, updateService, deleteService, bulkImportServices, searchMaterials, previewServiceCsvImport, commitServiceCsvImportChunk | ✅ | `services-actions.test.ts` | #202, ZIG-I10 |
| `services.ts` materials (ZIG-I10) | createService / updateService `materials[]`: catalog Material ids are checked against the caller's company (`loadCatalogMaterials`), new names land in the caller's company, and ServiceMaterial rows are replaced only after the company-scoped Service update matched | ✅ | `services-actions.test.ts` (service default materials) | ZIG-I10 |
| `service-usage.ts` | getServiceUsage (Eliminar servicio dialog, M-36): read-only counts; `requireTenantActionPermission('services.write')` and every count joins Ticket on the caller's `company_id` | ✅ | `service-usage-actions.test.ts` | ZIG-I36-6 |

## Server Actions — Tickets (#187)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `tickets.ts` | createTicket, getTickets, getTicketsList, getTicketsPaginated, getTicketById, updateTicket, deleteTicket, finishTicket, applyTicketPayment, getTicketAuditHistory | ✅ | `src/lib/tickets-actions.test.ts` | #187 |
| Line materials (ZIG-I10) | `materials[]` on createTicketWithLines, createPresupuestoWithLines, updatePresupuesto, updateTicket, updateTicketLines: catalog Material ids must be active rows of the caller's company (`loadCatalogMaterials` in `insertServiceLines`) | ✅ | `src/lib/service-lines-server.test.ts`, `src/actions/presupuestos.test.ts` | ZIG-I10 |

## Pages — in-app PDF viewers (ZIG-I9)

Both pages load their data only through the tenant-scoped actions above (`getPresupuestoById` filters `company_id` and `document_kind`; `getTicketById` filters `company_id`) and render `notFound()` when the action denies the id. The PDF bytes still come from `/api/tickets/[id]/invoice`, which keeps its own check.

| Page | Status | Test file | Slice |
| ---- | ------ | --------- | ----- |
| `/presupuestos/[id]/pdf` | ✅ | `src/app/(app)/presupuestos/[id]/pdf/page.test.tsx` | ZIG-I9-1 |
| `/tickets/[id]/recibo` | ✅ | `src/app/(app)/tickets/[id]/recibo/page.test.tsx` | ZIG-I9-1 |

## Server Actions — Users, Roles, Permissions (#188)

| Module | Exports | Status | Test file | Slice |
| ------ | ------- | ------ | --------- | ----- |
| `users.ts` | getUsers, getUsersPaginated, createUser, updateUser, updateOwnAccount, deleteUser | ✅ | `users-actions.test.ts` | #188 |
| `roles.ts` | getRoles, getRolesPaginated, createRole, updateRole, deleteRole | ✅ | `roles-actions.test.ts` | #188 |
| `permissions.ts` | getPermissions, getPermissionsByCompany, createPermission, updatePermission, deletePermission, assignPermissionToRole, removePermissionFromRole | ✅ | `permissions-actions.test.ts` | #188 |
| `team.ts` | getTeam, addTeamMember, updateTeamMember, changeTeamMemberRole, deactivateTeamMember (Mi empresa › Equipo; no company id input, members looked up within the caller's company) | ✅ | `team-actions.test.ts` | ZIG-I3-4 |
| `company-roles.ts` | getCompanyRoles, saveCompanyRole, deleteCompanyRole (Mi empresa › Roles; no company id input, edits roles owned by the caller's company; a shared global role is copied into the caller's company on save, never edited in place) | ✅ | `company-roles-actions.test.ts` | ZIG-I3-5 |

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
| `dashboard.ts` | fetchDashboardMetrics (the raw loader lives in `src/lib/dashboard-metrics-loader.ts`, not an action) | ✅ | `src/lib/dashboard-actions.test.ts` | #190, ZIG-07 |
| `dashboard-day-queue.ts` | getDashboardDayQueue | ✅ | `src/lib/dashboard-day-queue-actions.test.ts` | ZIG-I4-6 |
| `client-service-schedules.ts` | listClientServiceSchedules, listClientServiceSchedulesForClient, listServiceScheduleFormCatalog, upsertClientServiceSchedule, pauseClientServiceSchedule, resumeClientServiceSchedule, snoozeClientServiceSchedule, deleteClientServiceSchedule, listClientServiceSchedulesPaginated, markClientServiceScheduleDone, bulkClientServiceSchedules, restoreClientServiceScheduleDates, getClientServiceScheduleHistory, listClientServiceScheduleServiceOptions | ✅ | `src/lib/client-service-schedules-actions.test.ts` | #190 |
| `trash.ts` | getTrash, restoreClient, restoreService, restoreTicket | ✅ | `src/lib/trash-actions.test.ts` | #190 |
| `notifications.ts` | getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead | ✅ | `src/lib/notifications-actions.test.ts` | #190 |
| `authz.ts` | getSessionPermissionMap | ⏭️ Exempt | — (session-scoped; filters permissions by caller company) | #190 |

## Server Actions — Added by the pre-release audit (ZIG-I36-14)

The gate (`npm run check:idor-coverage`) now fails when an exported `'use server'` action under `src/actions` is not named in a row of this file, so a new action cannot ship unlisted. 🟡 rows were probed live with foreign ids by ZIG-I36-5 (all denied) but have no jest cross-tenant test yet.

| Module | Exports | Status | Test file / evidence | Slice |
| ------ | ------- | ------ | -------------------- | ----- |
| `presupuestos.ts` | createPresupuestoWithLines, updatePresupuesto, getPresupuestoById, getPresupuestosList, getPresupuestosPaginated, cancelPresupuesto, convertPresupuestoToTicket, extendPresupuestoVigencia, duplicatePresupuesto | ✅ | `src/actions/presupuestos.test.ts`, `src/actions/presupuestos-paginated.db.test.ts` | ZIG-I36-14 |
| `tickets.ts` (new actions) | createTicketWithLines, updateTicketLines, recordReceiptShared, duplicateTicket | ✅ | `src/actions/create-ticket-with-lines.test.ts`, `src/actions/tickets-edit-lines.test.ts` | ZIG-I36-14 |
| `client-detail.ts` | getClientDetail, updateClientNotes | 🟡 | ZIG-I36-5 live probe (CL006 on a foreign id) | ZIG-I36-14 |
| `anotar.ts` | anotarCapture | ✅ | `src/actions/anotar.test.ts` | ZIG-I36-14 |
| `dashboard-activity.ts` | fetchDashboardActivity (session revalidated with `requireActionAuth`; company taken from the session) | ✅ | `src/actions/dashboard-activity.test.ts` | ZIG-I36-9 |
| `company-payment-info.ts` | getCompanyPaymentInfo | ✅ | `src/actions/company-payment-info.test.ts` | ZIG-I36-14 |
| `cobranza.ts` | getCobranzaList, getCobranzaPaginated | ✅ | `src/actions/cobranza.test.ts`, `src/actions/cobranza.db.test.ts` | ZIG-I36-14 |
| `push-subscriptions.ts` | savePushSubscription, removePushSubscription, hasPushSubscription (own subscriptions only) | ✅ | `src/actions/push-subscriptions.test.ts` | ZIG-I36-14 |
| `team.ts` (password) | resetTeamMemberPassword | ✅ | `src/lib/team-actions.test.ts` | ZIG-I36-14 |
| `users.ts` (session/password) | resetUserTemporaryPassword, completeForcedPasswordChange, signOutEverywhere | ✅ | `src/actions/users-password-reset.test.ts`, `src/actions/user-write-guard.test.ts`, `src/actions/sign-out-everywhere.test.ts` | ZIG-I36-14 |
| `onboarding-status.ts` | fetchOnboardingStatus, dismissOnboardingChecklist (caller's company only) | 🟡 | `src/lib/onboarding-status.test.ts` (no cross-tenant case) | ZIG-I36-14 |
| `experience-mode.ts` | loadExperienceModeForCompany | 🟡 | no cross-tenant test | ZIG-I36-14 |
| `company-operator.ts` (fleet) | getOperatorCompanyFleet (system operator only) | 🟡 | `src/components/operator-console/operator-company-fleet.test.tsx` (UI only) | ZIG-I36-14 |
| `operator-user-sessions.ts` | fetchOperatorUserSessions (system operator only) | 🟡 | no cross-tenant test | ZIG-I36-14 |
| `operator-company-usage.ts` | fetchOperatorCompanyUsage (system operator only; `users.read` on the route's company) | 🟡 | no cross-tenant test | ZIG-I38-4 |
| `operator-company-access.ts` | getOperatorCompanyAccess (system operator only; `users.read` on the company) | 🟡 | no cross-tenant test | ZIG-I38-6 |
| `operator-company-access.ts` | operatorChangeMemberRole (system operator; member must belong to the company; then `updateUser` with its rank guard) | 🟡 | no cross-tenant test | ZIG-I38-6 |
| `operator-company-access.ts` | operatorDeactivateMember (system operator; member must belong to the company; then `deleteUser`) | 🟡 | no cross-tenant test | ZIG-I38-6 |
| `operator-company-access.ts` | operatorAddMember (system operator; `createUser` with the company id and its rank guard) | 🟡 | no cross-tenant test | ZIG-I38-6 |
| `operator-company-lifecycle.ts` | getOperatorCompanyLifecycle (system operator only; `companies.read` on the company) | 🟡 | no cross-tenant test | ZIG-I38-7 |

## Shared helpers

| Module | Status | Test file |
| ------ | ------ | --------- |
| `authz-context.ts` (resolveWritableCompanyId) | ✅ | `src/lib/idor.test.ts` |
| `tenant.ts` (tenantScope, assertTenantOwnership) | ✅ | `src/lib/tenant.test.ts` |
| `security.ts` (checkPermission cross-tenant) | ✅ | `src/lib/security.test.ts` |
| `security.ts` (`requireTenantActionPermission` — system must pass selected company) | ✅ | `src/lib/security.test.ts` |
| IDOR fixtures | ✅ | `src/test/idor-fixtures.test.ts` |

### Master vs selected company (system operators)

Cross-tenant IDOR (company B vs A) is covered above. Separately, system
operators who select another tenant in the UI must pass that `companyId` into
tenant mutations/exports. `requireTenantActionPermission` rejects system users
who omit it (no silent master-company fallback). Covered in `security.test.ts`
and the domain action suites listed for clients, services, tickets,
and trash. (`ticket-services.ts` was removed in ZIG-I36-14: no page bound it.)

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
| Material.company_id | ✅ | `0029_materiales` |
| ServiceMaterial | ⏭️ N/A | Junction via Service / Material FKs in `0029` (both company-scoped) |
| TicketLineMaterial | ⏭️ N/A | Child of ServicesTickets; Material FK in `0029` |
| AuditEvent | ✅ | `0009_audit_event` |

## CI (#191)

| Check | Status |
| ----- | ------ |
| `npm run test:idor` script | ✅ |
| CI runs IDOR suite | ✅ |
| Matrix coverage gate | ✅ |
| Zero known leaks | ✅ |

## Audit sign-off

- **Last updated:** master-company selected-context audit (`requireTenantActionPermission`) + slice #191
- **Known leaks:** none identified across audited surfaces
- **Reviewer sign-off:** automated matrix + IDOR test suite green in CI

## Related: ticket creation integrity

Cross-tenant denial for tickets is covered above. Money/contract holes on the create → services → finish path (client_id ownership on create, service-line qty/price validation, finish races, schema drift) are tracked separately in [ticket-creation-integrity-audit.md](./ticket-creation-integrity-audit.md) and `tasks/prd-ticket-creation-integrity.md`.
