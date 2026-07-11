# PRD: Onboarding Checklist for New Companies

**Status:** Shipped — merged to `main` via PR [#227](https://github.com/Jorg3L3on/zigzag/pull/227) (Jul 2026)  
**Source:** Execution plan task 3.3; operator guide `guia-empresa.html` § Inicio rápido

## Problem Statement

New Company tenants often land on the dashboard with zero Clients, Services, and Tickets and no clear path to their first invoice PDF. ZigZag already ships static HTML operator guides and a partial in-app “Ruta de inicio” panel, but the two are not aligned: the dashboard checklist omits the **Mi empresa** step that the guide lists first, uses a different step order, lacks an **invite team** step, and disappears only when all three core counts are non-zero without persisting admin dismissals. Operators who bootstrap a tenant (or arrive after future self-serve signup) waste time discovering the correct setup sequence and may churn before completing activation.

## Solution

Deliver a structured, in-dashboard onboarding checklist for Company operators that mirrors the **Inicio rápido (5 minutos)** sequence from the operator HTML guide, auto-detects completion from live tenant data, links each step to the correct create/edit flow and guide anchor, and persists visibility preferences in Company settings. The checklist should accelerate time-to-value (profile → catalog → client → ticket → PDF/reminders) while respecting RBAC, multi-tenant Company context, and existing readiness rules.

## User Stories

1. As a new Company admin, I want to see an onboarding checklist on the dashboard when my tenant is not yet fully activated, so that I know what to do first without reading external docs.
2. As a new Company admin, I want the checklist order to match the operator guide’s quick-start list, so that in-app guidance and published documentation stay consistent.
3. As a new Company admin, I want the first checklist step to prompt **Mi empresa** setup (logo, RFC, moneda), so that invoices and PDFs have correct branding and fiscal data before I create Tickets.
4. As a new Company admin, I want the second step to prompt creating Services in my catalog, so that Ticket line items are fast to add later.
5. As a new Company admin, I want the third step to prompt registering Clients, so that Ticket creation has contacts ready.
6. As a new Company admin, I want the fourth step to prompt creating my first Ticket with Services and payments, so that I complete the core revenue workflow end-to-end.
7. As a new Company admin, I want the fifth step to prompt downloading a Ticket invoice PDF and setting up Service reminders, so that billing and recurring work are not forgotten after the first Ticket.
8. As a new Company admin, I want each incomplete step to link directly to the relevant in-app create or manage screen, so that I can act in one click.
9. As a new Company admin, I want each step to offer a **Ver guía** link to the matching section of the operator HTML guide, so that I can read screenshots and detailed instructions when needed.
10. As a new Company admin, I want completed steps to show a clear completed state, so that I can see progress at a glance.
11. As a new Company admin, I want the checklist to show my overall progress (e.g. 2 of 6 complete), so that activation feels achievable.
12. As a new Company admin, I want the checklist to appear when my Company is missing any of the three core activation signals (Services, Clients, Tickets), so that partial setup still surfaces guidance.
13. As a new Company admin, I want the checklist to remain visible until all required steps are complete or I explicitly dismiss it, so that I am not left without guidance mid-setup.
14. As a new Company admin with `company.manage` permission, I want to dismiss the checklist once I no longer need it, so that the dashboard stays focused after onboarding.
15. As a new Company admin, I want a dismissed checklist to stay hidden across sessions, so that I do not have to dismiss it every login.
16. As a Company operator without create permissions, I want to see checklist steps but not misleading action buttons I cannot use, so that RBAC boundaries remain honest.
17. As a Company operator without create permissions, I want to still open the operator guide from each step, so that I can follow documented workflows or ask an admin to act.
18. As a new Company admin, I want to invite at least one additional team member as a checklist step, so that Admin/Operator coverage is established before daily operations.
19. As a new Company admin, I want the invite step to link to the Users create flow, so that adding colleagues does not require hunting the sidebar.
20. As a System company user viewing a selected tenant dashboard, I want the checklist to reflect that tenant’s data, so that support can coach activation in context.
21. As a System company user without a selected Company context, I want a concise “select a Company” message instead of tenant onboarding steps, so that cross-tenant navigation stays clear.
22. As a mobile dashboard user, I want the checklist to use the existing card/grid responsive layout, so that onboarding works on phones and PWA installs.
23. As a Company admin in SETUP lifecycle, I want the **Mi empresa** step to reflect readiness gaps (RFC, moneda, address fields), so that I understand why Ticket creation may still be blocked.
24. As a Company admin who uploads a logo, I want the profile step to count as complete when readiness requirements are satisfied, so that optional branding does not block progress incorrectly.
25. As a Company admin who created a Ticket but has not added Services, I want the Ticket workflow step to remain incomplete, so that the checklist enforces a real first job, not an empty Ticket shell.
26. As a Company admin who added Services to a Ticket, I want the step to advance when at least one Ticket has sold Services, so that catalog usage is verified.
27. As a Company admin who registered a payment or finished a Ticket, I want the payment portion of the workflow step to complete, so that cobranza is part of activation.
28. As a Company admin, I want the PDF/reminders step to complete when I have at least one finished Ticket and at least one Service schedule (or equivalent recurring reminder), so that post-sale operations are introduced.
29. As a Company admin, I want the checklist to auto-hide when every required step is complete, so that experienced tenants are not nagged.
30. As a Company admin who dismissed the checklist early, I want to re-open guidance from **Mi empresa** or the Guías menu, so that help remains discoverable after dismiss.
31. As a product owner, I want checklist completion derived from database state rather than client-only memory, so that progress is trustworthy across devices.
32. As a product owner, I want dismiss state stored per Company in settings JSON, so that no new tables are required for v1.
33. As an implementer, I want checklist rules isolated in a pure module, so that step logic is unit-testable without rendering the dashboard.
34. As an implementer, I want the UI component to consume a typed checklist snapshot, so that presentation and evaluation stay decoupled.
35. As a QA engineer, I want tests for visibility rules, step completion mapping, permission-aware actions, dismiss persistence, and system-user context behavior, so that regressions in activation UX are caught early.
36. As a support lead, I want checklist copy in Spanish consistent with the operator guide tone, so that onboarding matches published training material.
37. As a tenant user in a non-system Company, I want never to see another Company’s onboarding state, so that tenant isolation holds.
38. As a Company admin on the starter plan, I want checklist actions to respect entitlement limits (CO011), so that onboarding does not bypass plan enforcement.
39. As a Company admin, I want dismiss to require `company.manage` (or equivalent admin profile), so that operators cannot hide guidance needed for compliance setup.
40. As a maintainer, I want guide deep-link anchors centralized with existing onboarding guide constants, so that HTML guide updates do not scatter magic URLs.

## Implementation Decisions

### Canonical step model (aligned with operator guide + execution plan)

Define a versioned checklist configuration consumed by both UI and tests. Required steps, in order:

| # | Step key | Title (ES) | Complete when | Primary action | Guide anchor |
|---|----------|------------|---------------|----------------|--------------|
| 1 | `company_profile` | Configura Mi empresa | Company `assessCompanyReadiness` reports `profileReady` (RFC, moneda, required address/profile fields; logo optional) | `/company` | `#paso-3` |
| 2 | `services` | Arma tu catálogo de servicios | `totalServices > 0` | `/services/new` | `#paso-4` |
| 3 | `clients` | Registra clientes | `totalClients > 0` | `/clients/new` | `#paso-5` |
| 4 | `first_ticket` | Crea tu primer ticket | `totalTickets > 0` AND `totalServicesSold > 0` AND at least one Ticket has `paid > 0` OR `finished = true` | `/tickets/create` | `#paso-7` (with secondary links contextually to `#paso-8`) |
| 5 | `team` | Invita a tu equipo | `totalUsers > 1` (more than bootstrap owner) | `/users` (create dialog entry) | new anchor in guide or platform onboarding section |
| 6 | `billing_followup` | Factura PDF y recordatorios | At least one `finished` Ticket AND `totalServiceSchedules > 0` | `/tickets` + `/service-schedules` | `#paso-10` + `#paso-11` |

Notes:
- Step order intentionally follows `guia-empresa.html` **Inicio rápido**, with **Invita a tu equipo** inserted after the first Ticket workflow (execution plan 3.3) and before advanced PDF/reminders follow-up.
- “Fewer than 3 of 3” visibility: show the checklist when the Company has **fewer than three** of `{services, clients, tickets}` present **OR** any required step remains incomplete **OR** checklist not dismissed. Hide when all steps complete, or when dismissed by an authorized admin (unless product later adds “snooze” — out of scope).
- Reuse existing `assessCompanyReadiness` for profile completion; do not duplicate readiness rules.

### Deep modules

1. **`company-onboarding-checklist` (new, pure)**  
   - Inputs: tenant signals object (counts, readiness assessment, dismiss timestamp, permissions flags).  
   - Outputs: `shouldShowChecklist`, ordered `steps[]` with `{ key, title, description, complete, href?, actionLabel?, canAct, guideHref? }`, `progress: { completed, total }`.  
   - Encapsulates visibility threshold, step completion predicates, and ordering.  
   - No React imports.

2. **`onboarding-status` loader (new, server-side)**  
   - Resolves effective `company_id` (respecting System company selected context).  
   - Loads Company row, readiness assessment, dismiss flag from `settings`, and aggregate counts: users, clients, services, tickets, services sold, finished tickets with payment, service schedules.  
   - May extend `loadDashboardMetricsForCompany` or compose alongside it; prefer a dedicated loader to keep dashboard metrics cache semantics unchanged.

3. **`CompanySettingsJson` extension**  
   - Add optional `onboarding_checklist_dismissed_at?: string` (ISO timestamp).  
   - Merge-safe updates via existing Company update server actions; only admins with `company.manage` may set/clear.

4. **Dismiss server action (new or extend companies action)**  
   - Sets `onboarding_checklist_dismissed_at` for the session Company.  
   - Optional `restore` path for admins (clears field) — can be deferred to **Mi empresa** page only.  
   - Revalidates dashboard and company settings paths.

5. **`DashboardOnboardingHelp` (modify)**  
   - Becomes a thin presenter over checklist module output.  
   - Adds dismiss control (icon/button) for authorized users with confirmation.  
   - Preserves system-user `needsCompanyContext` empty state.  
   - Keeps responsive card grid; adjust column count for six steps (`lg:grid-cols-3` or scrollable row).

6. **`onboarding-guides` (modify)**  
   - Add `OPERATOR_GUIDE_ANCHORS.miEmpresa` → `#paso-3`.  
   - Add team onboarding anchor if documented in HTML (fallback: `guia-empresa.html#paso-12` roles section or `guia-empresa-maestra.html#onboarding` for platform-created tenants).

### Data and tenancy

- All queries filter by effective `company_id` and `deleted_at IS NULL`.
- System company users must pass selected Company id; never infer onboarding state from session home Company alone when a tenant is selected.
- No new tables for v1; dismiss persistence lives in `Company.settings` JSONB.
- BigInt fields converted before client props using existing utilities.

### Authorization

- Step action buttons gated by existing permissions: `clients.write`, `services.write`, `tickets.write`, `users.write`, `company.manage`, schedules permission as today.
- Dismiss requires `company.manage` (tenant admin), not Viewer/Operator without manage rights.
- Viewer role sees checklist progress and guide links only.

### UX copy

- Section title remains **Ruta de inicio** or rename to **Inicio rápido** to match guide — prefer **Inicio rápido** with subtitle referencing the 5-minute path.
- Spanish copy sourced from `guia-empresa.html` checklist bullets; keep concise for cards.

### Schema migration

- JSON field extension only; no Drizzle migration required if new settings keys are additive. Update `CompanySettingsJson` type and merge helper.

```ts
// CompanySettingsJson additive shape (decision snippet)
type CompanySettingsJson = {
  rfc?: string;
  invoice_footer_note?: string;
  default_currency?: string;
  onboarding_checklist_dismissed_at?: string; // ISO-8601
};
```

## Testing Decisions

- **Good tests** assert externally observable behavior: which steps render, which links appear, visibility given signal inputs, dismiss hiding, permission-gated buttons absent when `canAct` is false.
- **Unit-test** `company-onboarding-checklist` module with table-driven cases for: empty tenant, partial core trio, all complete, dismissed, system-user context flag, each step’s completion boundary (e.g. ticket without services sold).
- **Unit-test** settings merge for dismiss timestamp (existing company settings patterns).
- **Component tests** for `DashboardOnboardingHelp`: renders six steps, dismiss control for manage permission, hides when `shouldShowChecklist` false, preserves mobile list structure.
- **Prior art:** `dashboard-onboarding-help.test.tsx`, `onboarding-guides.test.ts`, `company-readiness.test.ts`, `users-actions.test.ts` (user create), dashboard metrics tests.
- **Optional E2E:** authenticated dashboard shows checklist for seeded empty tenant; completing seed steps hides it — only if stable E2E credentials exist.
- Do not test Tailwind class names or icon choice.

## Out of Scope

- Self-serve signup flow (removed from execution plan scope); checklist must still help admin-bootstrapped tenants.
- Persisting per-step manual checkmarks independent of data (no “mark done” without underlying records).
- Email invitations or magic-link onboarding; use existing in-app User create dialog only.
- System company operator go-live checklist (covered by operator console PRD); this PRD is tenant-dashboard facing.
- Translating or rewriting the HTML guides; only deep links and copy alignment.
- Service worker, offline onboarding, or PWA install prompts as checklist steps.
- Analytics/telemetry funnel dashboards for activation (may log informally later).
- Forcing checklist modal on every page; dashboard placement only for v1.
- New notification emails when steps complete.

## Further Notes

- **Current partial implementation:** `DashboardOnboardingHelp` shows five steps (clients → services → tickets → schedules → payments) without Mi empresa, team invite, persisted dismiss, or “fewer than 3 of 3” visibility nuance. Step order differs from the HTML guide.
- **HTML source of truth:** `public/guides/guia-empresa.html` § *Inicio rápido (5 minutos)* and related paso anchors already wired in `OPERATOR_GUIDE_ANCHORS` (except Mi empresa).
- **Readiness coupling:** Companies in SETUP may see profile step incomplete while Ticket step actions remain blocked by CO008; checklist copy should not promise Ticket creation until lifecycle allows it.
- **Suggested feature branch:** `feat/onboarding-checklist`.
- **Execution plan linkage:** Closes Phase 3 task 3.3 acceptance criteria when shipped.

## GitHub Tracker

- Parent PRD: [#220](https://github.com/Jorg3L3on/zigzag/issues/220)
- Slice [#221](https://github.com/Jorg3L3on/zigzag/issues/221): Foundation and setup steps (Mi empresa, servicios, clientes)
- Slice [#222](https://github.com/Jorg3L3on/zigzag/issues/222): Ticket, team, billing steps with progress and visibility
- Slice [#223](https://github.com/Jorg3L3on/zigzag/issues/223): Persisted admin dismiss in Company settings
