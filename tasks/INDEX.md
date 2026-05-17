# Tasks folder — PRD index

Local product requirements for the **mobile initiative** and related work. Status reflects a **codebase audit** (not GitHub issue closure). Update this file when a PRD ships or scope changes.

**Legend:** ✅ Applied · 🔶 Partial · ❌ Not applied · ⏸️ Deferred · 📋 Reference

| Status | File | Kind |
|--------|------|------|
| 📋 | [prd-mobile-program-decisions.md](./prd-mobile-program-decisions.md) | Locked Q&A for all mobile PRDs |
| ✅ | [prd-mobile-ui-ux.md](./prd-mobile-ui-ux.md) | v1 epic |
| 🔶 | [prd-mobile-functionality.md](./prd-mobile-functionality.md) | v1 epic |
| ❌ | [prd-mobile-architecture-consistency.md](./prd-mobile-architecture-consistency.md) | v1 epic |
| ❌ | [prd-mobile-performance.md](./prd-mobile-performance.md) | v1 epic |
| ❌ | [prd-mobile-pwa-install.md](./prd-mobile-pwa-install.md) | v1 epic |
| ⏸️ | [prd-mobile-pwa-offline.md](./prd-mobile-pwa-offline.md) | Future epic |
| ❌ | [prd-mobile-testing.md](./prd-mobile-testing.md) | v1 epic |
| 🔶 | [prd-mobile-accessibility.md](./prd-mobile-accessibility.md) | v1 epic |
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

## 🔶 prd-mobile-functionality.md

**Status:** Partial

**TL;DR:** Functional parity on mobile: `type="tel"` + autocomplete on client/ticket phone fields, login autocomplete for password managers, delete company from mobile list cards, fix `useIsMobile` first-paint sidebar flash, verify PDF on mobile after server PDF exists.

**Done / not done:**

| Item | Status |
|------|--------|
| US-001 tel on client + ticket forms | ❌ Only `company-form` has `type="tel"` |
| US-002 login autocomplete | ❌ `login-form` has no `autoComplete` |
| US-003 delete company on mobile cards | ❌ Comment in `companies-list.tsx`: delete desktop-only |
| US-004 `useIsMobile` flash | 🔶 Initial state `undefined` but hook returns `!!isMobile` (still `false` until measured) |
| US-005 mobile PDF verify | ❌ Blocked on performance PRD (still client-side PDF) |

---

## ❌ prd-mobile-architecture-consistency.md

**Status:** Not applied

**TL;DR:** Align **Companies** with the TanStack Table + mobile-cards-from-row-model pattern used by Tickets/Clients; deprecate or document `ui/data-table.tsx`; update `.cursor/rules/lists-and-responsive-tables.mdc`; optional shared `MOBILE_BREAKPOINT_PX` constant.

**Evidence:** `CompaniesList` still uses local state + `.map` on `filteredCompanies` (not `useReactTable`); no `companies-columns.tsx`; `MOBILE_BREAKPOINT` only inside `use-mobile.tsx`, not `src/lib/breakpoints.ts`.

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

## 🔶 prd-mobile-accessibility.md

**Status:** Partial (baseline only)

**TL;DR:** Mobile a11y: offline banner must not block focus, ~44px touch targets on primary flows, chart accessibility, sheet/dialog focus trap on mobile Safari, form error `aria-describedby`. Target WCAG 2.1 AA where practical; VoiceOver + TalkBack on key paths.

**Done / not done:**

| Item | Status |
|------|--------|
| US-001 banner focus / aria | 🔶 `role="status"` + `aria-live` present; layout coordinated with UI/UX PRD |
| US-002 touch target audit | ❌ No documented audit |
| US-003 chart a11y | 🔶 `accessibilityLayer` may exist; PRD extras not verified |
| US-004 sheet/dialog focus | ❌ Not systematically verified |
| US-005 form errors | ❌ Not verified per PRD |

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
- **Last audited:** 2026-05-16 (workspace codebase).
