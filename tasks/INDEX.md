# Tasks folder — PRD index

Local product requirements for the **mobile initiative** and related work. Status reflects **shipped code** and GitHub issue closure where noted. Update this file when a PRD ships or scope changes.

**Legend:** ✅ Applied · 🔶 Partial · ❌ Not applied · ⏸️ Deferred · 📋 Reference

| Status | File | Kind |
|--------|------|------|
| 📋 | [prd-mobile-program-decisions.md](./prd-mobile-program-decisions.md) | Locked Q&A for all mobile PRDs |
| ✅ | [prd-mobile-ui-ux.md](./prd-mobile-ui-ux.md) | v1 epic |
| ✅ | [prd-mobile-functionality.md](./prd-mobile-functionality.md) | v1 epic |
| ✅ | [prd-mobile-architecture-consistency.md](./prd-mobile-architecture-consistency.md) | v1 epic |
| ❌ | [prd-mobile-performance.md](./prd-mobile-performance.md) | v1 epic |
| ❌ | [prd-mobile-pwa-install.md](./prd-mobile-pwa-install.md) | v1 epic |
| ⏸️ | [prd-mobile-pwa-offline.md](./prd-mobile-pwa-offline.md) | Future epic |
| ❌ | [prd-mobile-testing.md](./prd-mobile-testing.md) | v1 epic |
| ✅ | [prd-mobile-accessibility.md](./prd-mobile-accessibility.md) | v1 epic |
| ❌ | [prd-mobile-documentation.md](./prd-mobile-documentation.md) | v1 epic |
| ✅ | [prd-invoice-fintech-pdf.md](./prd-invoice-fintech-pdf.md) | Invoice PDF feature |

**Suggested implementation order** (from program decisions): UI/UX → Functionality → Architecture → Performance → PWA install → Testing → Accessibility → Documentation.

---

## 📋 prd-mobile-program-decisions.md

**Status:** Reference (not implementable on its own)

**TL;DR:** Stakeholder locks for the mobile program: Phase 2 items stay in future PRDs; PWA `start_url` = `/dashboard`; **no service worker in v1**; **server PDF in v1**; bilingual install docs in README. Lists deferred `prd-mobile-pwa-offline.md` and optional Lighthouse CI PRD.

---

## ✅ prd-mobile-ui-ux.md

**Status:** Applied

**TL;DR:** Quick wins for phones/tablets at the `md` (768px) breakpoint: stop iOS input zoom (`text-base` on `Input`), safe-area for offline banner and Sonner toasts, mobile card layout for dashboard client metrics, stacked payment history on ticket detail, toast placement on narrow viewports. No full redesign; Android benefits from layout/safe-area work; iOS zoom fix is Safari-specific.

**Evidence:** `src/components/ui/input.tsx`, `src/components/network-status-banner.tsx`, `src/components/app-toaster.tsx`, `src/components/dashboard/dashboard-metrics-client.tsx`, `src/components/tickets/ticket-payment-collect-section.tsx`.

**Android note:** No extra work required beyond what shipped; optional smoke test on Android Chrome for safe-area/toasts only.

---

## ✅ prd-mobile-functionality.md

**Status:** Applied (shipped to `main` via PR #30)

**GitHub:** Parent [#20](https://github.com/Jorg3L3on/zigzag/issues/20) closed; slices [#21](https://github.com/Jorg3L3on/zigzag/issues/21)–[#24](https://github.com/Jorg3L3on/zigzag/issues/24) closed on merge. [#25](https://github.com/Jorg3L3on/zigzag/issues/25) (mobile PDF verify) closed as deferred — unblock when `prd-mobile-performance` ships.

**TL;DR:** Functional parity on mobile: `type="tel"` + autocomplete on client/ticket phone fields (via `ClientForm`), login autocomplete for password managers, delete company from mobile list cards, fix `useIsMobile` first-paint sidebar flash. Mobile PDF verification waits on server PDF (`prd-mobile-performance`).

**Slice PRs (into `feat/mobile-functionality`):** #26 (tel), #27 (login), #28 (company delete), #29 (sidebar flash). **Production:** [#30](https://github.com/Jorg3L3on/zigzag/pull/30) → `main`.

| Item | Status |
|------|--------|
| US-001 tel on client + ticket forms | ✅ `client-form.tsx` `type="tel"` / `autoComplete="tel"`; ticket create/edit use `ClientForm` |
| US-002 login autocomplete | ✅ `login-form.tsx` `autoComplete="email"` / `current-password` |
| US-003 delete company on mobile cards | ✅ `companies-list.tsx` `DeleteCompanyDialog` on cards with `stopPropagation` |
| US-004 `useIsMobile` flash | ✅ `use-mobile.tsx` `useSyncExternalStore`; `sidebar.tsx` CSS `md:` split (mobile sheet vs desktop chrome) |
| US-005 mobile PDF verify | ⏸️ Deferred until server PDF (`prd-mobile-performance` US-002/US-003) |

**Evidence:** `src/components/clients/client-form.tsx`, `src/app/dashboard/tickets/create/page.tsx`, `src/components/login-form.tsx`, `src/components/companies/companies-list.tsx`, `src/hooks/use-mobile.tsx`, `src/components/ui/sidebar.tsx`.

---

## ✅ prd-mobile-architecture-consistency.md

**Status:** Applied (shipped to `main` via PR #53)

**GitHub:** Parent [#45](https://github.com/Jorg3L3on/zigzag/issues/45); slices [#46](https://github.com/Jorg3L3on/zigzag/issues/46)–[#50](https://github.com/Jorg3L3on/zigzag/issues/50) closed on merge.

**TL;DR:** Companies list aligned with TanStack + mobile cards from row model; mobile sort presets; `DataTable` documented as not for dashboard lists; list Cursor rule + AGENTS.md link; shared `MOBILE_BREAKPOINT_PX` (768px).

**Slice PRs (into `feat/mobile-architecture-consistency`):** #51 (#46 TanStack), #52 (#47–#50 sort/docs/rules/breakpoint). **Production:** [#53](https://github.com/Jorg3L3on/zigzag/pull/53) → `main`.

| Item | Status |
|------|--------|
| US-001 Companies TanStack migration | ✅ `companies-columns.tsx`, `CompaniesList` + `useReactTable` |
| US-002 Mobile sort | ✅ `companies-sort-presets.ts`, mobile `Select` |
| US-003 DataTable policy | ✅ JSDoc on `ui/data-table.tsx`; no dashboard imports |
| US-004 List rule + AGENTS | ✅ `lists-and-responsive-tables.mdc`, AGENTS.md link |
| US-005 Breakpoint constant | ✅ `src/lib/breakpoints.ts`, `use-mobile.tsx` |

**Evidence:** `src/components/companies/companies-list.tsx`, `companies-columns.tsx`, `companies-sort-presets.ts`, `src/components/ui/data-table.tsx`, `src/lib/breakpoints.ts`, `src/hooks/use-mobile.tsx`, `.cursor/rules/lists-and-responsive-tables.mdc`.

---

## ❌ prd-mobile-performance.md

**Status:** Not applied

**TL;DR:** Mobile performance: Lighthouse mobile baseline doc, **server-generated ticket PDF** (primary path), wire `PDFDownloadButton` to server, honor `prefers-reduced-motion` on charts/`TripledMotionDiv`. Targets mid-range Android shop devices and iOS Safari PDF reliability.

**Evidence:** `PDFDownloadButton` still uses `renderElementToPdfBlob`; no `tasks/mobile-lighthouse-baseline.md`; charts still use `isAnimationActive` without reduced-motion check.

---

## ❌ prd-mobile-pwa-install.md

**Status:** Not applied

**TL;DR:** PWA install metadata only (no service worker): `start_url` → `/dashboard`, relax `orientation` from `portrait` to `any`, verify icons/metadata on iOS + Android, align with bilingual README (documentation PRD).

**Evidence:** `src/app/manifest.ts` still has `start_url: '/login'`, `orientation: 'portrait'`.

---

## ⏸️ prd-mobile-pwa-offline.md

**Status:** Deferred (explicitly out of v1)

**TL;DR:** Future epic: service worker, offline app shell, “requires network” messaging, optional Android `beforeinstallprompt` banner. Depends on PWA install + docs PRDs. Stub only—refine before implementation.

---

## ❌ prd-mobile-testing.md

**Status:** Not applied

**TL;DR:** Playwright **mobile device project** (e.g. iPhone 13 / Pixel 5), mobile E2E for ticket cards and sidebar sheet, manual `mobile-release-checklist.md`, optional Lighthouse CI gate (non-blocking in v1).

**Evidence:** `playwright.config.ts` — Desktop Chrome only; no `tasks/mobile-release-checklist.md`.

---

## ✅ prd-mobile-accessibility.md

**Status:** Applied (shipped to `main` via PR #44)

**GitHub:** Parent [#33](https://github.com/Jorg3L3on/zigzag/issues/33) closed; slices [#34](https://github.com/Jorg3L3on/zigzag/issues/34)–[#38](https://github.com/Jorg3L3on/zigzag/issues/38) closed on merge.

**TL;DR:** Mobile a11y: offline banner does not block focus, ~44px touch targets on primary flows, chart accessible names + sr-only data tables, sheet/dialog focus trap, form validation errors linked via `aria-describedby` and announced as alerts. Target WCAG 2.1 AA where practical.

**Slice PRs (into `feat/mobile-accessibility`):** #39 (banner), #40 (touch targets), #41 (charts), #42 (focus trap), #43 (forms). **Production:** #44 → `main`.

| Item | Status |
|------|--------|
| US-001 banner focus / aria | ✅ `NetworkStatusBanner` live regions, document offset, mobile sidebar below banner |
| US-002 touch target audit | ✅ `Button` icon `h-11`, sidebar trigger, login, tickets list/filter, ticket detail PDF |
| US-003 chart a11y | ✅ `accessibilityLayer`, `role="img"` + `aria-label`, sr-only tables, empty-state `role="status"` |
| US-004 sheet/dialog focus | ✅ `overlay-focus`, filter sheet `showCloseButton={false}`, Escape returns focus to trigger |
| US-005 form errors | ✅ `FormControl` `aria-describedby`, `FormMessage` `role="alert"`, ticket create client validation |

**Evidence:** `src/components/network-status-banner.tsx`, `src/components/ui/button.tsx`, `src/components/ui/sidebar.tsx`, `src/components/dashboard/dashboard-charts.tsx`, `src/lib/overlay-focus.ts`, `src/components/ui/form.tsx`, `src/components/tickets/tickets-list.tsx`, `src/components/tickets/ticket-services-list-client.tsx`, `src/app/dashboard/tickets/create/page.tsx`.

**Out of scope (unchanged):** full admin WCAG audit, high-contrast theme, axe-core CI.

---

## ❌ prd-mobile-documentation.md

**Status:** Not applied

**TL;DR:** Bilingual (ES/EN) README **Mobile & PWA** section: install steps, `start_url` = dashboard, internet required / no offline, supported browsers, link to release checklist, AGENTS.md pointer to list rules and mobile PRDs, E2E mobile project docs.

**Evidence:** No “Mobile & PWA” section in `README.md`; `AGENTS.md` has no mobile initiative links.

---

## ✅ prd-invoice-fintech-pdf.md

**Status:** Applied

**TL;DR:** Replaced the current DOM/canvas ticket invoice PDF with a server-generated vector PDF based on the provided ReportLab fintech invoice source. Preserves the reference visual design as closely as practical with dynamic Company, Client, Service, Ticket, and payment data; uses free/open-source tooling; keeps generation on demand and tenant-scoped.

**Evidence:** `src/app/api/tickets/[id]/invoice/route.ts`, `src/lib/fintech-invoice-payload.ts`, `src/lib/fintech-invoice-renderer.ts`, `src/components/pdf-download-button.tsx`, ticket detail/edit download flows.

**Notes:** GitHub issue publishing is blocked until `gh auth login -h github.com` refreshes the invalid local GitHub token.

---

## Maintenance

- After merging a mobile PR, update the table and the PRD’s section (status + evidence).
- Non-mobile PRDs should use `tasks/prd-<feature-name>.md` per [README](./README.md); add a row here when created.
- **Last audited:** 2026-05-18 (architecture PRD #45/#46–#50, PR #53; functionality PR #30).
