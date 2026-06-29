# Company Tenant Operations Runbook

Operational guide for support and platform operators managing **Company (tenant)** lifecycle, entitlements, governance audit, and offboarding. Part of PRD #88 (`feat/company-tenant-platform`).

Related: [company-go-live-checklist.md](company-go-live-checklist.md), [production-runbook.md](production-runbook.md), [soft-delete-policy.md](soft-delete-policy.md).

## Scope

| Area | Module / route | Operator audience |
| ---- | -------------- | ----------------- |
| Bootstrap | `bootstrapCompanyTenant`, `createCompany()` Server Action | System company admin |
| Lifecycle | `Company.status`: SETUP → ACTIVE → SUSPENDED → ARCHIVED | System company admin |
| Readiness | `assessCompanyReadiness`, `/api/companies/[id]/readiness` | System admin + tenant owner |
| Entitlements | `assertCompanyEntitlementAllows`, CO011 | All tenants; plan set by system admin |
| Governance audit | `GovernanceAuditEvent` | Security / compliance review |
| Export | `GET /api/companies/[id]/export` | System company admin |
| Offboarding | `POST /api/companies/[id]/offboard` | System company admin |

## Roles and authorization

- **System company user** (`company.is_system = true`): cross-tenant bootstrap, company write, export, offboarding, user/role/permission admin.
- **Tenant user**: scoped by session `company_id`; cannot export or offboard other tenants.
- All export/offboarding paths require **system company** membership plus `companies.read` (export) or `companies.write` (offboard).

Cross-company actions emit governance audit payloads with `cross_company: true` when the actor's home company differs from the target tenant.

## Onboarding (new tenant)

1. **Provision** via dashboard **Empresas → Nueva** or `createCompany()` Server Action (atomic bootstrap: Company + owner user + tenant-admin role + RBAC baseline).
2. Confirm bootstrap governance events: `company.created`, `role.created`, `user.created` in `GovernanceAuditEvent`.
3. Owner completes profile, RFC, currency, optional logo (Blob upload with validation).
4. System admin sets commercial **plan** (`settings.plan`: starter | standard | enterprise) on company edit.
5. Transition lifecycle **SETUP → ACTIVE** only when readiness panel shows no blocking gaps (CO008 if profile incomplete).

### Verification commands

```bash
# Readiness snapshot (authenticated system session)
curl -s -H "Cookie: …" https://<host>/api/companies/<id>/readiness | jq .

# Entitlements snapshot
curl -s -H "Cookie: …" https://<host>/api/companies/<id>/entitlements | jq .
```

## Lifecycle incidents

| Symptom | Likely cause | Action |
| ------- | ------------- | ------ |
| Users cannot log in | Company SUSPENDED or ARCHIVED | Check `Company.status`; restore to ACTIVE if appropriate |
| Ticket create fails CO008 | Company not production-ready | Complete readiness gaps; ensure ACTIVE |
| Create user/client fails CO011 | Plan limit reached | Review entitlements API; upgrade plan or archive unused records |
| Logo missing in PDF | Blob fetch failure | Expected fallback (initials); verify logo URL in Blob store |
| Offboarding requested | Customer churn | Export first, then offboard (see below) |

### Status transitions (non-destructive)

- **SUSPENDED**: blocks authentication (`companyAllowsAuthentication` false except SETUP/ACTIVE).
- **ARCHIVED**: terminal for offboarding; login blocked; data retained per retention policy.
- Soft **delete** (`deleted_at`) is separate from lifecycle ARCHIVED; avoid unless legal/compliance requires tenant removal from active lists.

## Entitlements (CO011)

Plans and limits live in `src/lib/company-entitlements.ts`. Enforcement points:

- Server actions: `createUser`, `createClient`, `createService`, `createTicket`
- Server Actions: `createUser()`, `createClient()`, `createService()` (canonical UI mutation path; REST duplicates removed in epic #200)

UI surfaces `CompanyEntitlementNotice` on create entry points. System company tenants bypass entitlement limits.

## Governance audit investigations

Query `GovernanceAuditEvent` filtered by `company_id` (target tenant) or `actor_user_id`.

Each row includes:

- `resource_type`: company | user | role | permission
- `event_type`: created | updated | deleted | logo_* | permission_* | export_generated | offboarded
- `payload.mutation`, `payload.before`, `payload.after`, `payload.cross_company`

**Do not** update or delete audit rows during triage (same policy as `TicketAuditEvent`).

## Portability and offboarding

### Export (before offboarding)

1. Authenticated system admin opens **Empresas → Editar → Portabilidad y offboarding → Exportar datos (JSON)** or calls `GET /api/companies/[id]/export`.
2. Verify JSON: no `password` fields on users; `counts` match expectations; includes soft-deleted rows for historical portability.
3. Confirm governance event `export_generated` with count metadata.

### Offboarding

1. Complete export and deliver to customer if required.
2. **Iniciar offboarding** → sets status **ARCHIVED** (non-destructive; no row purge).
3. Retention: **90 calendar days** after archive before any manual purge review (`COMPANY_OFFBOARDING_RETENTION_POLICY` in `src/lib/company-offboarding.ts`).
4. Confirm governance event `offboarded` with `offboarding` summary in payload.

Hard delete (`deleteCompany` / soft delete) is **not** the default offboarding path.

## Database migrations (Company platform)

Apply on preview/production after merging integration branch:

```bash
npm run migrate:deploy
```

Relevant migrations: `0007_company_lifecycle.sql`, `0008_governance_audit.sql`. No schema change for export/offboarding slice.

## Incident response checklist

1. Identify **target company_id** and whether actor is system admin.
2. Check `Company.status`, readiness (`/readiness`), entitlements (`/entitlements`).
3. Pull recent `GovernanceAuditEvent` rows for the tenant.
4. For payment/ticket issues, also inspect `TicketAuditEvent` (separate domain).
5. Preserve audit tables; fix forward via lifecycle or data correction PRs.

## Escalation

- Schema or migration failures → DBA / engineering + [production-runbook.md](production-runbook.md) rollback section.
- Cross-tenant data exposure suspicion → freeze system admin accounts involved; audit `cross_company` events.
- Portability SLA → use export API; do not hand-copy production DB rows.
