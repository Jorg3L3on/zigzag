# PRD: Audit module completion and gap closure

**Status:** Published — GitHub issue [#138](https://github.com/Jorg3L3on/zigzag/issues/138)

**Related:** Completes the remaining gaps after GitHub issue #127, "PRD: Unified audit module".

## Problem Statement

Zigzag now has a canonical unified audit store, legacy dual-write for Ticket and governance audit paths, a System company-only audit console, and instrumentation across many mutation and security flows. However, the module is not yet complete enough to be treated as a gap-free accountability layer.

System company operators still cannot rely on the audit log as the single source of truth because some REST mutation paths can change Ticket-related data without writing an audit event, some denied Server Action paths are silent, audit search can return unrelated rows, and the console does not expose all investigation filters promised by the audit product contract. The current UI also shows raw identifiers and payload JSON without resource links, request metadata, or display-layer redaction. These gaps make incident reconstruction and compliance review incomplete even though the main audit infrastructure exists.

The user needs the audit module finished to 100% of the current product contract: every in-scope mutation and security outcome is recorded consistently, the System company audit console can filter and inspect events accurately, and regression tests prove that direct API usage cannot bypass accountability.

## Solution

Finish the unified audit module as a hardening and completion pass. The implementation will close all known audit coverage gaps, fix audit querying semantics, complete the System company investigation UI, and add regression tests that make future gaps visible.

The completed module will ensure Ticket service API mutations write Ticket and unified audit events just like equivalent UI mutation paths. Permission-denied events will be recorded for both permission failures and invalid cross-company context in Server Actions and API routes. Audit search will apply all active filters correctly and will only match rows that actually contain the search term. The dashboard audit console will expose the full filter set needed by System company users, show request metadata and redacted structured payloads, and provide deep links to related resources where the resource has a dashboard destination.

No tenant user will gain audit read access. Non-system user actions will still be recorded. The implementation will remain application-level append-only for v1 and will not introduce a public audit write/update/delete API.

## User Stories

1. As a System company user, I want every Ticket service addition through the API recorded in the unified audit log, so that direct HTTP calls cannot bypass Ticket accountability.
2. As a System company user, I want every Ticket service update through the API recorded in the unified audit log, so that service quantity and price changes are traceable.
3. As a System company user, I want every Ticket service removal through the API recorded in the unified audit log, so that total-changing removals are not silent.
4. As a System company user, I want Ticket service API mutations to continue writing legacy Ticket audit events during the transition period, so that existing operational history remains complete.
5. As a System company user, I want Ticket service audit payloads to include before and after state where available, so that I can understand exactly what changed.
6. As a System company user, I want Ticket total changes caused by Ticket service mutations represented in the audit payload, so that financial impact is visible.
7. As a System company user, I want Server Action cross-company access denials recorded, so that attempted tenant boundary violations are visible.
8. As a System company user, I want API cross-company access denials recorded with route and method metadata, so that I can investigate unauthorized HTTP attempts.
9. As a System company user, I want permission-denied events to distinguish missing permission from invalid company context, so that I can tell role misconfiguration from cross-tenant probing.
10. As a System company user, I want denied events to include the requested Company when known, so that tenant-specific investigations include failed attempts.
11. As a System company user, I want denied events to include the actor Company when known, so that I can distinguish System company operators from tenant users.
12. As a System company user, I want audit search to return only rows matching the search term, so that investigations are not polluted by unrelated payload-bearing events.
13. As a System company user, I want audit search to respect resource type filters, so that broad text searches can still be scoped to Tickets, Clients, Services, or security events.
14. As a System company user, I want audit search to respect result filters, so that I can search only denied or failed outcomes.
15. As a System company user, I want audit search to respect action filters, so that I can search only generated documents, deletions, or payment events.
16. As a System company user, I want audit search to respect actor filters, so that I can review one user’s activity without noise.
17. As a System company user, I want audit search to respect target Company filters, so that tenant-specific investigations remain scoped.
18. As a System company user, I want audit search to respect resource id filters, so that I can find all activity for one Ticket or entity.
19. As a System company user, I want audit search to respect date range filters, so that incident timelines can be narrowed precisely.
20. As a System company user, I want cursor pagination to remain stable while filters and search are active, so that large audit logs can be reviewed safely.
21. As a System company user, I want the audit console to filter by target Company, so that I can focus on one tenant.
22. As a System company user, I want the audit console to filter by actor User, so that I can review one administrator or tenant user.
23. As a System company user, I want the audit console to filter by action, so that I can find deletions, generated documents, or denied attempts quickly.
24. As a System company user, I want the audit console to filter by resource id, so that I can investigate one Ticket, Client, Service, User, Role, Permission, Company, invoice, export, or report.
25. As a System company user, I want the audit console to filter by date range, so that I can reconstruct a known incident window.
26. As a System company user, I want filter state reflected in the URL, so that I can share or reopen the same investigation.
27. As a System company user, I want audit rows to link to related dashboard resources where possible, so that I can navigate from an event to the affected record.
28. As a System company user, I want resources without a safe dashboard destination to show plain identifiers, so that the UI does not create broken links.
29. As a System company user, I want expanded audit details to show payload and request metadata separately, so that I can distinguish business context from transport context.
30. As a System company user, I want expanded audit details to redact sensitive-looking keys at display time, so that accidental secrets are not exposed in the console.
31. As a System company user, I want expanded audit details to preserve useful before and after structure, so that comparisons are readable.
32. As a System company user, I want failed login events to avoid raw passwords and tokens, so that security review does not create credential exposure.
33. As a System company user, I want login failure reasons to remain distinguishable, so that throttling, inactive Company, missing credentials, and invalid credentials can be analyzed separately.
34. As a System company user, I want document generation events to include request metadata where available, so that PDF and export activity has operational context.
35. As a System company user, I want the audit console to remain desktop-table and mobile-card friendly, so that investigation works on all supported dashboard layouts.
36. As a non-system tenant user, I want the audit page to remain inaccessible, so that platform-wide activity is not exposed to tenants.
37. As a non-system tenant user, I want the audit API to remain inaccessible, so that other Companies' activity cannot be read through direct HTTP calls.
38. As a non-system tenant user, I want my in-scope writes and denied attempts still recorded, so that System company operators can support and investigate my tenant.
39. As an implementer, I want a shared audit query builder, so that search and filtered listing cannot drift apart.
40. As an implementer, I want a shared audit display redactor, so that payload rendering is safe and testable.
41. As an implementer, I want a shared audit resource-link resolver, so that deep links are consistent and easy to extend.
42. As an implementer, I want representative Server Action and API mutation tests, so that fixing one data-access layer does not leave the other uncovered.
43. As an implementer, I want a coverage matrix for in-scope audit events, so that future features can see which mutations must record events.
44. As a maintainer, I want tests proving direct API Ticket service mutations create audit rows, so that accountability cannot regress.
45. As a maintainer, I want tests proving invalid cross-company context creates denied audit rows, so that tenant isolation attempts remain observable.
46. As a maintainer, I want tests proving audit search does not match every payload-bearing row, so that the console remains trustworthy.
47. As a maintainer, I want tests proving the audit read API remains System company-only, so that tenant users cannot inspect platform activity.
48. As a maintainer, I want tests proving payload display redaction catches common sensitive keys, so that accidental secret display is prevented.
49. As a maintainer, I want append-only application semantics documented and guarded by tests, so that normal code paths never update or delete audit rows.
50. As a product owner, I want the audit module marked complete only when the documented completion checklist passes, so that "100%" means observable behavior, not just infrastructure presence.

## Implementation Decisions

- Treat this PRD as a completion pass on the existing unified audit module, not as a replacement for the original module design.
- Keep the canonical unified audit store as the read model and primary product surface.
- Keep legacy Ticket and governance audit tables during the current transition period; new coverage for Ticket service API mutations must dual-write where it represents Ticket history.
- Add audit recording to Ticket service API create, update, and soft-delete flows. These events should use the existing Ticket audit action vocabulary, with payload metadata that clearly identifies the service mutation and any resulting Ticket financial state.
- Ensure audit recording for Ticket service API mutations runs in the same transaction as the business mutation when feasible.
- Extend permission-denied auditing so invalid Company context and cross-company boundary failures are recorded, not only permission-name failures.
- Preserve the current non-blocking audit write policy: audit insert failures are logged server-side and should not break the primary operation in v1.
- Build or consolidate a deep audit query module that applies all filters consistently for both list and search modes.
- Search should match explicit searchable fields and useful structured metadata without using a condition that makes all payload-bearing rows match.
- Cursor pagination should continue to use stable newest-first ordering and should behave consistently under filters and search.
- Build or consolidate a deep audit display redaction module that redacts sensitive-looking keys recursively before payloads or request metadata are rendered.
- Redaction should cover known credential and secret terms, including password, token, secret, key, authorization, cookie, and remember-token variants.
- Storage sanitization remains required where known sensitive domain objects are recorded; display redaction is an additional safety layer, not a replacement.
- Build or consolidate a deep audit resource-link resolver that maps resource type and resource id to dashboard destinations only when a safe destination exists.
- The audit console should add filters for target Company, actor User, action, resource id, and date range, in addition to existing resource type, result, and text search controls.
- Filter state should be reflected in query parameters so investigation URLs are durable.
- The audit details panel should show payload and request metadata as separate sections.
- Request metadata should include route and method wherever the calling API helper or route can reasonably provide it.
- The audit API remains read-only and System company-only. No audit create, update, delete, or purge API is introduced.
- Page access remains System company-only and should validate persisted Company state through existing authorization helpers.
- The sidebar should continue showing audit navigation only for System company users.
- No database trigger or PostgreSQL RLS append-only enforcement is required for this PRD; append-only remains application-level for v1.
- Add or update developer documentation with a concise audit coverage matrix for in-scope resources, actions, Server Action paths, API routes, and expected event results.
- Completion requires closing every known gap from the audit review: Ticket service API auditing, cross-company denial auditing, search correctness, full filter UI, detail redaction, request metadata visibility, deep links, and regression tests.

## Testing Decisions

- Tests should assert external behavior: after an authenticated user performs an in-scope action, the expected audit row exists with the expected resource, action, result, source, target Company, and sanitized payload.
- Tests should not assert internal call graphs; it should be possible to refactor recorder helpers without rewriting behavior tests.
- Unit-test the audit query module with representative filter combinations, including search plus resource type, result, action, actor, target Company, resource id, date range, and cursor.
- Unit-test that audit search does not return unrelated rows merely because payload is present.
- Unit-test the audit display redactor against nested objects, arrays, mixed-case keys, and common sensitive-key variants.
- Unit-test the audit resource-link resolver for linked and non-linked resource types.
- Integration-test Ticket service API create, update, and soft-delete flows to prove they write both legacy Ticket audit history and unified audit rows.
- Integration-test invalid cross-company Server Action context to prove a denied audit row is recorded.
- Integration-test invalid cross-company API context to prove a denied audit row is recorded with request metadata.
- Integration-test that a non-system user cannot read the audit API.
- E2E-test that a System company user can open the audit page, apply the new filters, expand a row, and see redacted structured detail.
- E2E-test that a non-system user remains blocked from the audit page.
- Reuse existing audit helper tests, dual-write tests, API helper tests, security tests, and audit page access tests as prior art.
- Add regression tests for the exact gaps found in review so the module cannot be called complete while those behaviors are missing.
- Completion should include a focused lint and test run covering audit, security, API helpers, and any changed UI components.

## Out of Scope

- Tenant-visible audit history on Ticket detail pages or Company settings.
- Real-time audit streaming, webhooks, SIEM integrations, or notification workflows.
- A public or internal audit event mutation API.
- Audit event editing, deletion, retention purge, or purge UI.
- Database trigger, PostgreSQL RLS, or database-level append-only enforcement.
- Capturing full request or response bodies for every API call.
- Auditing ordinary read-only list and page views beyond explicitly in-scope document/export generation events.
- Replacing NextAuth, Drizzle, or the existing migration workflow.
- Removing legacy Ticket and governance audit tables.
- Formal external compliance certification.

## Further Notes

- This PRD intentionally depends on the existing unified audit module and closes the remaining work needed before the module can be treated as complete.
- The original unified audit PRD is closed, so this follow-up should be the source of truth for final hardening and completion work.
- The implementation must continue respecting Zigzag's multi-tenancy model: every resource remains scoped by Company, and System company access is explicit.
- The dashboard copy should continue using Spanish UI terminology already present in the app.
- A future slice can add database-level append-only enforcement, but that is intentionally outside this v1 completion pass.
