# Audit module completion checklist (PRD #138)

Use this checklist before merging `feat/audit-module-completion` → `main`.
Each row maps a known gap from PRD #138 to implementation and test evidence.

| # | Gap | Status | Implementation | Test / doc evidence |
|---|---|---|---|---|
| 1 | Ticket service API create not audited | ✅ | `POST /api/tickets/[id]/services` | `src/lib/ticket-service-api-audit.test.ts` |
| 2 | Ticket service API update not audited | ✅ | `PUT /api/tickets/[id]/services/[serviceId]` | `src/lib/ticket-service-api-audit.test.ts` |
| 3 | Ticket service API delete not audited | ✅ | `DELETE /api/tickets/[id]/services/[serviceId]` | `src/lib/ticket-service-api-audit.test.ts` |
| 4 | Ticket service API dual-write to legacy Ticket audit | ✅ | `recordTicketAudit` in API routes | `src/lib/ticket-service-api-audit.test.ts` |
| 5 | Cross-company Server Action denials silent | ✅ | `requireActionPermission` + `recordPermissionDeniedAudit` | `src/lib/security.test.ts` |
| 6 | Cross-company API denials silent | ✅ | `requireApiPermission` + `recordPermissionDeniedAudit` | `src/lib/api-helpers.test.ts`, `src/lib/audit-security.test.ts` |
| 7 | Denial reason distinguishes permission vs company context | ✅ | `reason: missing_permission \| invalid_company_context` | `src/lib/security.test.ts`, `src/lib/audit-security.test.ts` |
| 8 | Audit search returns unrelated payload rows | ✅ | `searchAuditEvents` ILIKE on explicit fields | `src/lib/audit-query.test.ts` |
| 9 | Search ignores active filters | ✅ | Shared `normalizeAuditEventFilters` | `src/lib/audit-query.test.ts` |
| 10 | Console missing target company filter | ✅ | `AuditList` + `target_company_id` param | `src/components/audit/audit-list.test.tsx` |
| 11 | Console missing actor user filter | ✅ | `AuditList` + `actor_user_id` param | `src/components/audit/audit-list.test.tsx` |
| 12 | Console missing action filter | ✅ | `AuditList` + `action` param | `src/components/audit/audit-list.test.tsx` |
| 13 | Console missing resource id filter | ✅ | `AuditList` + `resource_id` param | `src/components/audit/audit-list.test.tsx` |
| 14 | Console missing date range filters | ✅ | `AuditList` + `from` / `to` params | `src/components/audit/audit-list.test.tsx` |
| 15 | Filter state not in URL | ✅ | `router.replace` sync from `AuditList` | `src/components/audit/audit-list.test.tsx` |
| 16 | Raw payload JSON without redaction | ✅ | `redactAuditDisplayValue()` | `src/lib/audit-display.test.ts` |
| 17 | No resource deep links in console | ✅ | `resolveAuditResourceLink()` in columns | `src/lib/audit-display.test.ts` |
| 18 | Non-system users can read audit API | ✅ | `company_is_system` gate | `src/app/api/audit/events/route.test.ts` |
| 19 | Non-system users can open audit page | ✅ | `requireSystemPage()` | `e2e/audit.spec.ts` |
| 20 | Append-only semantics undocumented | ✅ | Application-level v1 policy | `docs/audit-coverage-matrix.md`, `src/lib/audit.test.ts` |
| 21 | No coverage matrix for implementers | ✅ | This doc + matrix | `docs/audit-coverage-matrix.md` |

## Pre-merge verification

- [ ] `npm run lint`
- [ ] `npm test -- --testPathPatterns="audit" --runInBand`
- [ ] `npm test -- --runInBand` (full suite)
- [ ] `npm run build`
- [ ] Optional: `npm run test:e2e -- e2e/audit.spec.ts` with `E2E_EMAIL` / `E2E_PASSWORD`
- [ ] Review unified audit console on preview deployment (System company user)
- [ ] `npm run migrate:deploy` if pending migrations on target DB

## Slice issues (PRD #138)

| Slice | Issue | PR |
|---|---|---|
| Ticket service API audit | #140 | #146 |
| Cross-company denial audit | #141 | #147 |
| Search/filter correctness | #142 | #148 |
| Console filters + URL state | #143 | #150 |
| Redacted details + links | #144 | #149 |
| Completion proof | #145 | (this slice) |

## Related docs

- [audit-coverage-matrix.md](./audit-coverage-matrix.md)
- [rbac-audit-matrix.md](./rbac-audit-matrix.md)
- [tasks/prd-audit-module-completion.md](../tasks/prd-audit-module-completion.md)
