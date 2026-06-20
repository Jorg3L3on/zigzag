# PRD: System Company Operator Console

**Status:** Published — GitHub issue [#139](https://github.com/Jorg3L3on/zigzag/issues/139)

## Problem Statement

Zigzag already has several System company administration surfaces: Companies, Users, Roles, Permissions, company context switching, company readiness, data export, offboarding, entitlements, and a unified audit module. These pieces are useful, but they are scattered across separate pages and workflows. A System company operator who needs to run the platform still has to manually assemble the picture: which Company is selected, whether it is ready to go live, whether it is over plan limits, who has access, what recently changed, and whether export or offboarding actions are safe.

The user needs this to feel like a real operator console: one coherent System company control panel for viewing all Companies, selecting a Company context, inspecting activity and usage, managing Users and Roles, exporting Company data, disabling or offboarding a Company, and reviewing readiness or go-live status.

## Solution

Create a System company operator console that composes the existing administration features into a focused, cross-tenant control surface. The console should give System company users a clear landing page for platform operations, a per-Company operator view, and deep links into existing management surfaces. It should make the selected Company context obvious, expose readiness and usage at a glance, show recent audit activity, and place sensitive actions like export and offboarding behind explicit, well-labeled flows.

The existing unified audit PRD remains the source of truth for canonical audit storage and instrumentation. This PRD depends on that audit module where possible, but focuses on the operator experience, orchestration, navigation, and summary data needed to run Companies confidently.

## User Stories

1. As a System company user, I want a dedicated operator console entry point, so that platform administration feels distinct from tenant operations.
2. As a System company user, I want the console visible only to System company users, so that tenant users never see cross-tenant controls.
3. As a System company user, I want to see all active Companies in one console, so that I can quickly choose where to operate.
4. As a System company user, I want to search Companies by name, email, phone, or status, so that I can find the tenant I need without scanning the full list.
5. As a System company user, I want to filter Companies by lifecycle state, so that I can focus on setup, active, suspended, or archived tenants.
6. As a System company user, I want to see readiness state directly in the Companies list, so that go-live blockers are visible before I open a Company.
7. As a System company user, I want to see plan and usage pressure in the Companies list, so that I can identify tenants close to limits.
8. As a System company user, I want to select a Company context from the console, so that tenant-scoped dashboard pages use the intended Company.
9. As a System company user, I want the selected Company context to be clearly displayed, so that I do not accidentally act on the wrong tenant.
10. As a System company user, I want a per-Company operator overview, so that I can see the tenant’s operational health in one place.
11. As a System company user, I want the per-Company view to show lifecycle state, so that I know whether users can authenticate and operate.
12. As a System company user, I want the per-Company view to show readiness blockers, so that I can guide setup before activation.
13. As a System company user, I want the per-Company view to show plan, limits, and current usage, so that I can resolve CO011-style limit issues quickly.
14. As a System company user, I want usage counts for Users, Clients, Services, and Tickets this month, so that I can understand tenant scale at a glance.
15. As a System company user, I want usage indicators to call out exceeded or near-limit resources, so that risk is obvious without reading raw numbers.
16. As a System company user, I want to jump from usage cards to the related resource list, so that investigation is fast.
17. As a System company user, I want to see recent audit activity for a selected Company, so that I can review what changed recently.
18. As a System company user, I want to filter recent activity by result, resource type, and action, so that I can focus on security-relevant events.
19. As a System company user, I want audit rows to deep-link to related resources when possible, so that I can move from evidence to action.
20. As a System company user, I want to see who recently acted in a Company, so that I can identify administrators or tenant users involved in changes.
21. As a System company user, I want to manage Users from the Company operator view, so that account administration starts from tenant context.
22. As a System company user, I want to create a User for the selected Company without reselecting the Company in a form, so that onboarding is less error-prone.
23. As a System company user, I want to edit or soft-delete Users from the Company context, so that account lifecycle work is localized.
24. As a System company user, I want to manage Roles for the selected Company, so that access configuration is tied to the tenant I am reviewing.
25. As a System company user, I want to see each Company’s Roles and User counts together, so that I can spot missing or unusual access setup.
26. As a System company user, I want to inspect Role permissions from the Company view, so that privilege changes do not require jumping across unrelated pages.
27. As a System company user, I want the console to reuse existing Users and Roles behavior where appropriate, so that authorization rules stay consistent.
28. As a System company user, I want to edit Company profile and plan settings from the operator view, so that readiness and entitlements can be fixed in the same workflow.
29. As a System company user, I want to see Company logo and identity status, so that branding setup is visible before invoices are generated.
30. As a System company user, I want to activate a Company only when readiness requirements pass, so that production workflows are not enabled prematurely.
31. As a System company user, I want blocked activation to explain the missing readiness fields, so that I know exactly what to fix.
32. As a System company user, I want to suspend a Company with an explicit confirmation, so that login-blocking actions are intentional.
33. As a System company user, I want suspended Companies to show the operational impact, so that I understand users cannot authenticate.
34. As a System company user, I want to restore a suspended Company when appropriate, so that temporary access holds can be reversed.
35. As a System company user, I want to export Company data from the operator view, so that portability requests do not require hunting through edit screens.
36. As a System company user, I want export actions to clearly identify the target Company, so that cross-tenant data export mistakes are avoided.
37. As a System company user, I want export actions to emit audit events, so that portability activity is traceable.
38. As a System company user, I want to start offboarding from the operator view, so that churn or closure workflows are supported.
39. As a System company user, I want offboarding to require confirmation and explain retention behavior, so that destructive lifecycle transitions are deliberate.
40. As a System company user, I want offboarding to archive rather than hard-delete the Company, so that historical records remain available.
41. As a System company user, I want the console to show whether export should happen before offboarding, so that the runbook is followed.
42. As a System company user, I want archived Companies to remain inspectable in the console, so that support and compliance can review retained data.
43. As a System company user, I want archived Companies to be visually distinct from active Companies, so that I do not treat them as live tenants.
44. As a System company user, I want to see go-live checklist status for a Company, so that first-client onboarding can be verified from the app.
45. As a System company user, I want checklist items to map to readiness, entitlement, branding, audit, export, and offboarding capabilities, so that operational launch work is complete.
46. As a System company user, I want go-live status to be separate from raw lifecycle status, so that a Company can be ACTIVE but still have operational follow-ups.
47. As a System company user, I want the console to highlight operational incidents such as failed logins, permission denials, and entitlement denials, so that I can prioritize support.
48. As a System company user, I want to see recent document generation events for invoices and dashboard reports, so that export-style reads are visible.
49. As a System company user, I want the console to respect selected Company context across Tickets, Clients, Services, and dashboard metrics, so that cross-tenant viewing remains explicit.
50. As a System company user, I want tenant-scoped links to preserve or set the selected Company context, so that navigation does not silently switch tenants.
51. As a System company user, I want the console to use the existing dashboard list pattern on desktop and mobile, so that it feels consistent with other admin pages.
52. As a System company user, I want mobile cards for Company and activity summaries, so that emergency operations are usable from a phone.
53. As a System company user, I want sensitive actions to remain available on mobile with the same confirmations, so that mobile does not become a weaker control surface.
54. As a System company user, I want the console to show empty states when no Company context is selected, so that I know what action is required.
55. As a System company user, I want the console to show loading and error states for summary panels independently, so that one failed panel does not hide all operational data.
56. As a System company user, I want network and authorization failures to use existing error catalog behavior, so that errors are consistent.
57. As a tenant user, I want never to access the operator console, so that other Companies’ data remains private.
58. As a tenant user, I want my normal dashboard to remain unchanged, so that platform administration does not complicate daily tenant work.
59. As an implementer, I want a small console summary module, so that readiness, lifecycle, usage, and recent activity can be tested without coupling to UI details.
60. As an implementer, I want the console to reuse existing authorization helpers, so that System company enforcement remains consistent across pages and APIs.
61. As an implementer, I want all Company-scoped data to filter explicitly by target company id, so that Drizzle queries do not leak cross-tenant data.
62. As an implementer, I want the operator console to reuse existing export, offboarding, readiness, entitlement, and audit contracts, so that the new surface does not fork business logic.
63. As an implementer, I want the console to avoid adding new audit storage concepts, so that the unified audit module remains the single audit source of truth.
64. As a maintainer, I want acceptance tests for System-only access, so that future UI changes do not expose the console to tenant users.
65. As a maintainer, I want regression tests around selected Company context, so that cross-company actions remain explicit.

## Implementation Decisions

- Build a dedicated System company operator console route as the main entry point for cross-tenant administration. The existing sidebar System section should expose this entry point for System company users.
- Keep existing Companies, Users, Roles, Permissions, and Audit pages available. The console should orchestrate and deep-link into them rather than replacing them all in one large rewrite.
- Add a per-Company operator view that combines Company identity, lifecycle, readiness, entitlements, usage, recent audit activity, and sensitive actions.
- Treat the unified audit module PRD as a dependency for canonical audit storage and event query behavior. If the unified module is incomplete, the console can initially use the current audit query surface where available and should be designed to switch cleanly to the unified query contract.
- Introduce a deep module for Company operator summaries. Its interface should accept a target Company id and actor context, then return a structured summary containing Company profile, lifecycle, readiness, entitlement usage, user and role counts, and recent activity metadata.
- Introduce or extend a Company operations model that centralizes labels and allowed lifecycle transitions for SETUP, ACTIVE, SUSPENDED, and ARCHIVED states.
- Reuse existing Company readiness assessment logic for go-live blockers. The console should present readiness as operational status, not duplicate the rules.
- Reuse existing entitlement and usage calculations. Usage should include Users, Clients, Services, and Tickets this month, with limit status derived from the active plan.
- Reuse existing export and offboarding actions/API behavior. The console should call the same business paths so audit, retention, and authorization semantics stay unchanged.
- Reuse existing user and role management flows where possible, but prefill or preserve the selected Company context when navigating from the Company operator view.
- Use System company checks for the console page and any new API endpoints. Root-only actions must continue to require explicit System company membership plus the relevant permission where existing flows require it.
- All tenant data queries in new modules must explicitly filter by target Company id unless the query is intentionally listing Companies for a System company user.
- The selected Company context should remain separate from session Company id and should continue to use the existing client context model. The console may set or guide selected context, but should not overload the authentication session.
- The console should make the selected Company obvious in page headers, action dialogs, and sensitive workflows.
- Add deep links from Company summary panels to existing resource pages with enough context for System company users to continue working against the intended tenant.
- Desktop views should use dashboard list conventions: searchable/filterable tables, stable sorting, and clear row actions.
- Mobile views should use cards below the existing mobile breakpoint and keep sensitive actions discoverable with equivalent confirmation behavior.
- No new database schema is required for the first operator console slice unless the go-live checklist becomes a persisted workflow. Initial go-live status should be derived from existing readiness, lifecycle, entitlement, branding, audit, export, and offboarding signals.
- If persisted go-live checklist sign-off is later required, handle it in a follow-up PRD with explicit schema and audit decisions.
- The console should use Spanish UI copy consistent with the current dashboard, while the PRD and implementation comments can use the domain vocabulary from AGENTS.md.

## Testing Decisions

- Tests should verify external behavior and authorization outcomes, not UI internals or private helper call graphs.
- Unit-test the Company operator summary module with representative Companies: SETUP with missing readiness, ACTIVE and production-ready, SUSPENDED, ARCHIVED, near plan limit, and over plan limit.
- Unit-test lifecycle label and transition helpers if new helpers are introduced.
- Unit-test entitlement presentation logic so near-limit, at-limit, and unlimited enterprise plans render the correct derived state.
- Add page or route access tests proving non-System users cannot access the operator console or Company operator summaries.
- Add tests proving System company users can load summaries for multiple Companies while tenant users cannot.
- Add tests proving all summary queries are scoped to the target Company id, especially usage counts and recent activity.
- Add interaction tests for sensitive actions from the console: export requires System company access and emits the existing audit behavior; offboarding requires confirmation and archives rather than hard-deletes.
- Add client component tests for selected Company context behavior if the console adds new context-setting controls.
- Add mobile/responsive tests or coverage aligned with existing dashboard list tests where practical, especially for Company cards and sensitive actions.
- Reuse prior art from existing readiness, entitlements, company lifecycle, offboarding, audit security, RBAC coverage, and dashboard list tests.
- Run `npm run lint`, `npm test -- --runInBand`, and `npm run build` before shipping slices that touch the console.

## Out of Scope

- Replacing the unified audit module PRD or re-specifying canonical audit storage.
- Tenant-visible audit history or tenant-facing operator tools.
- Database-level row-level security or database triggers for tenant scoping.
- Real-time activity streaming, webhooks, SIEM integrations, or alerting.
- Automatic retention purge jobs for archived Companies.
- Persisted go-live sign-off workflow, unless a follow-up PRD explicitly adds it.
- Removing existing Companies, Users, Roles, Permissions, or Audit pages.
- Changing NextAuth session shape or merging selected Company context into the session.
- CSV, Excel, or non-JSON Company export formats.
- Broad redesign of the tenant dashboard, Ticket workflows, Client workflows, or Service workflows outside console navigation/deep links.

## Further Notes

- This PRD complements the unified audit module. Audit answers “what happened?”; the operator console answers “how does a System company user run the platform?”
- The Company tenant runbook and go-live checklist already describe much of the operator workflow. The console should turn those documented steps into an in-app workflow where possible.
- Sensitive actions should always name the target Company clearly and should preserve the current policy that offboarding archives rather than hard-deletes.
- Feature integration branch suggestion: `feat/system-company-operator-console`; slice PRs should merge there, with one final PR to `main` when the PRD is complete.
