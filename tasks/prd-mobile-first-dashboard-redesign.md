# PRD: Mobile-First Dashboard Redesign

## Problem Statement

ZigZag has solid responsive foundations, but the dashboard still feels uneven on phones. The tickets page now has a more app-like mobile experience, while other dashboard areas still read as desktop layouts compressed into a narrow viewport. Field and shop staff should be able to move through core Company, Ticket, Client, Service, User, Role, Permission, and Account workflows with thumb-friendly controls, clear record cards, and predictable mobile page chrome.

## Solution

Extend the new tickets mobile-first visual language across the dashboard. Mobile should become the primary layout: simple top context, flatter page surfaces, larger touch targets, card-based records, bottom-sheet filters/actions where useful, and sticky mobile action bars for form flows. Desktop layouts remain dense and table-oriented where they already work.

The redesign should preserve the existing shadcn/Tailwind tokens, TanStack list architecture, Server Actions/API contracts, RBAC behavior, tenant scoping, soft-delete behavior, and audit requirements. This is a visual and interaction consistency initiative, not a data model rewrite.

## User Stories

1. As a mobile dashboard user, I want every resource list to use a consistent card layout, so that I can scan records without horizontal scrolling.
2. As a mobile dashboard user, I want list search and filters to use large touch targets, so that I can refine data without precision tapping.
3. As a mobile dashboard user, I want active filters summarized as chips, so that I understand why a list changed.
4. As a mobile dashboard user, I want primary create actions to be full-width or thumb-friendly, so that starting work is obvious.
5. As a mobile dashboard user, I want create and edit forms to use a mobile app bar and sticky submit actions, so that saving is always reachable.
6. As a mobile dashboard user, I want form controls to be at least mobile-safe size and avoid iOS zoom, so that typing does not shift the page.
7. As a mobile dashboard user, I want detail pages to read like stacked records, so that ticket, client, service, company, and account information is easy to inspect.
8. As a mobile ticket user, I want ticket services and ticket edit flows to match the new create-ticket experience, so that the multi-step flow feels continuous.
9. As a mobile admin, I want Users, Roles, and Permissions pages to retain administrative clarity while using mobile-friendly cards and action placement, so that admin work remains possible on phones.
10. As a system company user, I want Companies pages to follow the same mobile-first shell and card grammar, so that cross-company management does not feel like a separate product.
11. As a desktop user, I want existing table-oriented dashboard productivity preserved, so that the redesign does not slow down back-office work.
12. As a keyboard or screen reader user, I want the new mobile controls to retain semantic buttons, links, headings, labels, and focus behavior, so that accessibility does not regress.
13. As a maintainer, I want reusable mobile-first dashboard primitives, so that future pages follow the pattern by default.
14. As a QA engineer, I want Playwright mobile coverage for representative list and form flows, so that the mobile design does not quietly regress.
15. As a product owner, I want the rollout split into small slices, so that the design can ship safely and be reviewed page group by page group.

## Implementation Decisions

- Treat the tickets redesign as the visual baseline: flatter mobile page backgrounds, reduced mobile card chrome, full-width or sticky primary actions, compact mobile copy, and record cards that lead with the meaningful entity name.
- Keep `md` as the dashboard split point. Desktop remains table-first for resource lists; mobile remains card-first.
- Introduce or evolve shared dashboard primitives rather than copying page-specific class strings everywhere. Candidate primitives include a mobile-aware page shell, page hero/header, sticky mobile action bar, mobile record card, and mobile filter summary chips.
- Resource lists should keep TanStack row models on desktop and mobile. Mobile cards should render from table row models where the page already follows the list architecture.
- Search remains visible on list pages. Secondary filters, sort controls, and bulk-ish refinements should use compact controls or bottom sheets on mobile.
- Create/edit pages should hide desktop breadcrumb-heavy chrome on mobile when a mobile app bar is present.
- Sticky mobile action bars should respect `env(safe-area-inset-bottom)` and must not cover form content.
- Detail pages should use stacked sections and `<dl>`-style facts on mobile, preserving current desktop density.
- Administrative pages may remain visually restrained, but they should still follow mobile card/action patterns.
- No database schema changes are expected.
- No authorization changes are expected. Existing RBAC, company context behavior, and system-company access rules must remain intact.
- No production PDF upload behavior changes are included.

## Testing Decisions

- Tests should verify external behavior and layout affordances rather than brittle class names.
- Add Playwright mobile tests using a real device profile for representative pages: at minimum a resource list, a create form, a detail/edit flow, and an admin list.
- Existing authenticated Playwright tests may remain skipped when `E2E_EMAIL` and `E2E_PASSWORD` are unset, but new tests should be ready to run in configured environments.
- Keep unit/integration tests focused on shared primitives only if they encapsulate meaningful behavior, such as rendering action bars or filter summaries with accessibility labels.
- Run `npm run lint`, `npm run build`, and `npm run test:e2e` for each slice. Note authenticated E2E skips when credentials are not configured.

## Out of Scope

- New branding, color system, dark-mode redesign, or custom animation system.
- Changing the dashboard sidebar information architecture.
- Changing the `md` breakpoint.
- Data model changes, migration work, or seed data changes.
- Offline/PWA service worker work.
- Reworking ticket audit, payment, or invoice generation behavior.
- Full native app gestures or custom mobile navigation beyond dashboard web/PWA patterns.

## Further Notes

- The current branch `codex/mobile-first-tickets` contains the prototype pattern for Tickets list and Create Ticket.
- Existing mobile PRDs remain valid. This PRD is a broader visual consistency pass that builds on the already shipped mobile functionality, accessibility, and architecture work.
- Suggested feature branch when implementing slices: `feat/mobile-first-dashboard-redesign`.

## GitHub Tracker

- Parent PRD: [#63](https://github.com/Jorg3L3on/zigzag/issues/63)
- Slice [#64](https://github.com/Jorg3L3on/zigzag/issues/64): Mobile-first dashboard primitives
- Slice [#65](https://github.com/Jorg3L3on/zigzag/issues/65): Apply mobile-first pattern to Client, Service, and Company lists
- Slice [#66](https://github.com/Jorg3L3on/zigzag/issues/66): Apply mobile-first pattern to admin lists
- Slice [#67](https://github.com/Jorg3L3on/zigzag/issues/67): Apply mobile-first pattern to Client, Service, and Company forms
- Slice [#68](https://github.com/Jorg3L3on/zigzag/issues/68): Complete mobile-first Ticket flows beyond the list
- Slice [#69](https://github.com/Jorg3L3on/zigzag/issues/69): Polish dashboard, account, and utility pages for mobile-first consistency
- Slice [#70](https://github.com/Jorg3L3on/zigzag/issues/70): Add mobile E2E coverage for dashboard redesign
