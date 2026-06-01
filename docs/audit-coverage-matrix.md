# Audit coverage matrix

Canonical map of in-scope audit instrumentation for the unified `AuditEvent` store.
Read access is **System company only** (`GET /api/audit/events`, `/dashboard/audit`).

Legacy dual-write tables (`TicketAuditEvent`, `GovernanceAuditEvent`) remain during
transition; new Ticket service API mutations dual-write Ticket history where noted.

## Read surfaces (System company only)

| Surface | Guard | Test evidence |
|---|---|---|
| `GET /api/audit/events` | `requireSession()` + `company_is_system` | `src/app/api/audit/events/route.test.ts` |
| `/dashboard/audit` | `requireSystemPage()` | `e2e/audit.spec.ts` |

## Security and auth events

| Resource | Action | Result | Source | Trigger | Test evidence |
|---|---|---|---|---|---|
| `auth` | `signed_in` | `success` | `auth` | Successful login | `src/lib/audit-security.ts` |
| `auth` | `sign_in_failed` | `failed` | `auth` | Failed login (throttle, inactive company, bad credentials) | `src/lib/audit-security.test.ts` |
| `auth` | `signed_out` | `success` | `auth` | Sign out | `src/lib/audit-security.ts` |
| `security` | `permission_denied` | `denied` | `action` | Missing permission on Server Action | `src/lib/security.test.ts` |
| `security` | `permission_denied` | `denied` | `action` | Invalid cross-company context on Server Action | `src/lib/security.test.ts` |
| `security` | `permission_denied` | `denied` | `api` | Missing permission on API route | `src/lib/api-helpers.test.ts` |
| `security` | `permission_denied` | `denied` | `api` | Invalid cross-company context on API route | `src/lib/api-helpers.test.ts`, `src/lib/audit-security.test.ts` |

## Ticket and ticket-service mutations

| Resource | Action | Result | Source | Trigger | Dual-write | Test evidence |
|---|---|---|---|---|---|---|
| `ticket` | `created` | `success` | `action` | Ticket create Server Action | unified only | `src/lib/audit-dual-write.test.ts` |
| `ticket` | `updated` | `success` | `action` | Ticket update Server Action | Ticket + unified | `src/lib/audit-dual-write.test.ts` |
| `ticket` | `deleted` | `success` | `action` | Ticket soft-delete Server Action | Ticket + unified | `src/lib/audit-dual-write.test.ts` |
| `ticket` | `finished` | `success` | `action` | Ticket finalize Server Action | Ticket + unified | `src/lib/audit-dual-write.test.ts` |
| `ticket` | `payment_collected` | `success` | `action` | Payment collect Server Action | Ticket + unified | `src/lib/audit-dual-write.test.ts` |
| `ticket` | `created` | `success` | `api` | `POST /api/tickets/[id]/services` | Ticket + unified | `src/lib/ticket-service-api-audit.test.ts` |
| `ticket` | `updated` | `success` | `api` | `PUT /api/tickets/[id]/services/[serviceId]` | Ticket + unified | `src/lib/ticket-service-api-audit.test.ts` |
| `ticket` | `deleted` | `success` | `api` | `DELETE /api/tickets/[id]/services/[serviceId]` | Ticket + unified | `src/lib/ticket-service-api-audit.test.ts` |

## Tenant resource mutations

| Resource | Action | Result | Source | Trigger | Test evidence |
|---|---|---|---|---|---|
| `client` | `created` / `updated` / `deleted` | `success` | `action`, `api` | Client CRUD | `src/lib/resource-audit.ts`, dual-write tests |
| `service` | `created` / `updated` / `deleted` | `success` | `action`, `api` | Service CRUD | `src/lib/resource-audit.ts`, dual-write tests |

## Governance and platform administration

| Resource | Action | Result | Source | Trigger | Dual-write | Test evidence |
|---|---|---|---|---|---|---|
| `company` | `created` / `updated` / `deleted` | `success` | `action`, `api` | Company admin mutations | Governance + unified | `src/lib/governance-audit.test.ts` |
| `user` | `created` / `updated` / `deleted` | `success` | `action`, `api` | User admin mutations | Governance + unified | `src/lib/governance-audit.test.ts` |
| `role` | `created` / `updated` / `deleted` | `success` | `action`, `api` | Role admin mutations | Governance + unified | `src/lib/governance-audit.test.ts` |
| `permission` | `created` / `updated` / `deleted` | `success` | `action`, `api` | Permission admin mutations | Governance + unified | `src/lib/governance-audit.test.ts` |
| `company` | `logo_uploaded` / `logo_removed` | `success` | `action`, `api` | Logo upload/remove | Governance + unified | `src/lib/governance-audit.test.ts` |
| `company` | `export_generated` | `success` | `api` | `GET /api/companies/[id]/export` | unified only | company export tests |
| `company` | `offboarded` | `success` | `api` | `POST /api/companies/[id]/offboard` | unified only | `src/lib/company-offboarding.test.ts` |

## Document generation

| Resource | Action | Result | Source | Trigger | Test evidence |
|---|---|---|---|---|---|
| `invoice` | `generated` | `success` | `api` | `GET /api/tickets/[id]/invoice` | resource-audit instrumentation |
| `report` | `generated` | `success` | `action` | Dashboard report export | resource-audit instrumentation |

## Console investigation UI

| Capability | Implementation | Test evidence |
|---|---|---|
| Filter by target company, actor, resource type/id, action, result, date range | `src/components/audit/audit-list.tsx` + URL query params | `src/components/audit/audit-list.test.tsx` |
| Debounced text search with combined filters | `AuditList` → `GET /api/audit/events` | `src/components/audit/audit-list.test.tsx` |
| Search/filter query parity (list + search modes) | `src/lib/audit-query.ts` | `src/lib/audit-query.test.ts` |
| Payload + request metadata display with redaction | `src/lib/audit-display.ts` | `src/lib/audit-display.test.ts` |
| Resource deep links where safe | `resolveAuditResourceLink()` | `src/lib/audit-display.test.ts` |

## Append-only policy (application-level v1)

| Rule | Enforcement | Test evidence |
|---|---|---|
| Normal code paths insert audit rows only | No update/delete helpers on `AuditEvent` | `src/lib/audit.test.ts` (`recordAuditEvent`) |
| Audit insert failure must not break primary operation | try/catch in recorders | `src/lib/audit.test.ts` |

## Focused verification commands

```bash
npm test -- --testPathPatterns="audit" --runInBand
npm test -- src/app/api/audit/events/route.test.ts --runInBand
npm test -- src/lib/ticket-service-api-audit.test.ts --runInBand
npm test -- src/lib/security.test.ts src/lib/api-helpers.test.ts --runInBand
npm run test:e2e -- e2e/audit.spec.ts
```
