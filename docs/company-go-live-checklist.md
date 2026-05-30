# Company Go-Live Readiness Checklist

Use this checklist before onboarding the **first paying client** or promoting `feat/company-tenant-platform` → `main`. Each item maps to shipped slices #89–#96.

Operator runbook: [company-tenant-runbook.md](company-tenant-runbook.md).

## Release gate (engineering)

- [ ] `npm run lint` passes on `feat/company-tenant-platform`
- [ ] `npm test -- --runInBand` passes
- [ ] `npm run build` passes
- [ ] Pending migrations applied to production (`npm run migrate:deploy`), including `0007` and `0008`
- [ ] Vercel preview smoke-tested on integration branch
- [ ] Final PR `feat/company-tenant-platform` → `main` reviewed and merged by a human

## 1. Bootstrap and RBAC (#89)

- [ ] System admin can create Company + owner in one flow (dashboard or API)
- [ ] Bootstrap is atomic (no orphan Company without owner)
- [ ] Tenant owner role excludes `companies.read` / `companies.write`
- [ ] Owner can log in and access dashboard for the new tenant

## 2. Lifecycle and readiness (#90)

- [ ] New tenant starts in **SETUP**
- [ ] Readiness panel lists missing profile/RFC/currency fields
- [ ] Transition to **ACTIVE** blocked until profile complete (CO008)
- [ ] Ticket creation blocked for non-production-ready tenants (CO008)
- [ ] **SUSPENDED** / **ARCHIVED** block authentication as documented

## 3. Branding (#91–#92)

- [ ] Logo upload accepts valid PNG/JPEG/WebP within size/dimension limits (CO010 on invalid)
- [ ] Logo appears in sidebar company context
- [ ] Ticket invoice PDF shows logo or vector initials fallback
- [ ] `BLOB_READ_WRITE_TOKEN` configured in production

## 4. Plan entitlements (#93)

- [ ] Plan selector visible on company edit (system admin)
- [ ] New bootstrap tenants default to **starter** plan
- [ ] Over-limit create actions return **CO011** (actions + APIs)
- [ ] Create UIs show entitlement notice when at limit

## 5. Governance audit (#94)

- [ ] `GovernanceAuditEvent` table exists in production DB
- [ ] Company/User/Role/Permission mutations write audit rows
- [ ] Cross-tenant system-admin edits set `cross_company: true` in payload
- [ ] Passwords never appear in audit or export payloads

## 6. Export and offboarding (#95)

- [ ] System admin can download JSON export from company edit page
- [ ] Export scoped strictly to target `company_id` (no cross-tenant leakage)
- [ ] Export emits `export_generated` governance event
- [ ] Offboarding sets **ARCHIVED** without hard delete
- [ ] Retention policy documented (90 days post-archive before manual purge review)
- [ ] Offboarding emits `offboarded` governance event

## 7. Operations documentation (#96)

- [ ] [company-tenant-runbook.md](company-tenant-runbook.md) reviewed by support lead
- [ ] This checklist signed off for first-client launch

## First-client onboarding walkthrough (support)

| Step | Verification |
| ---- | ------------ |
| 1. Create tenant | Company row + owner user + audit events |
| 2. Set plan | `settings.plan` matches contract (starter/standard/enterprise) |
| 3. Owner completes profile + logo | Readiness panel green; optional logo in PDF sample |
| 4. Activate tenant | Status **ACTIVE**; ticket create succeeds |
| 5. Entitlement spot-check | Create resources within plan limits; CO011 at boundary |
| 6. Document export path | Support can run export JSON on request |
| 7. Document offboarding path | Export → offboard → ARCHIVED; login denied |

## Sign-off

| Role | Name | Date | Notes |
| ---- | ---- | ---- | ----- |
| Engineering | | | Integration branch merged to `main` |
| Support / CS | | | Runbook acknowledged |
| Product / Release | | | First client cleared for ACTIVE |
