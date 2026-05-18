# PRD: Mobile Testing & Quality Assurance

## Introduction

Playwright E2E today runs **Desktop Chrome only**. Mobile-specific layouts (card lists, filter sheets, sidebar sheet) can regress without detection. This PRD adds automated mobile viewport coverage and optional quality gates for PWA and performance.

**Assumptions:** Existing E2E credentials pattern (`E2E_EMAIL`, `E2E_PASSWORD`) continues. CI runs on GitHub Actions or equivalent.

**Locked decisions:** See `tasks/prd-mobile-program-decisions.md`. Lighthouse CI gate is optional in v1 (not a separate Phase 2 PRD unless deferred explicitly).

## Goals

- Catch mobile layout regressions on critical paths in CI.
- Document manual mobile test checklist for releases.
- Optional: Lighthouse CI or PWA checks on PRs.

## User Stories

### US-001: Playwright mobile device project
**Description:** As a developer, I want E2E tests to run on a mobile viewport so card layouts and sidebar behavior are verified in CI.

**Acceptance Criteria:**
- [ ] `playwright.config.ts` adds project e.g. `mobile-chrome` using `devices['iPhone 13']` or `Pixel 5`.
- [ ] Existing `dashboard.spec.ts` runs on both desktop and mobile projects OR mobile-specific spec created.
- [ ] `npm run test:e2e` runs all projects locally (document if slower).
- [ ] CI workflow runs mobile project (if CI exists).

### US-002: Mobile E2E — tickets list cards visible
**Description:** As QA, I want assurance that the tickets page shows mobile cards, not a broken table-only layout on narrow viewports.

**Acceptance Criteria:**
- [ ] New test: after login, navigate to `/dashboard/tickets`.
- [ ] Assert mobile card container visible (`md:hidden` section) OR ticket article/card with expected heading/text.
- [ ] Assert desktop-only wide table not the sole content at mobile width (implementation-specific selector).
- [ ] Test passes in mobile project; skipped without E2E credentials like existing tests.

### US-003: Mobile E2E — sidebar opens as sheet
**Description:** As QA, I want the sidebar to open on mobile without desktop collapse behavior breaking.

**Acceptance Criteria:**
- [ ] Test: tap `SidebarTrigger` on dashboard or tickets page.
- [ ] Assert sheet/dialog sidebar content visible (e.g. nav link “Tickets” or “Inicio”).
- [ ] Close sheet; main content visible again.
- [ ] Passes on mobile project only.

### US-004: Manual mobile release checklist
**Description:** As a release owner, I want a repeatable checklist for devices we support before production deploy.

**Acceptance Criteria:**
- [ ] Markdown checklist in `tasks/mobile-release-checklist.md` or `e2e/README.md`.
- [ ] Covers: login, tickets list, create ticket (start), ticket detail, PDF download attempt, offline banner (airplane mode), install to home screen (manual).
- [ ] Devices: at least iOS Safari + Android Chrome noted.

### US-005: Lighthouse CI mobile (optional — same epic, not blocking)
**Description:** As a developer, I want PRs to warn when mobile performance scores regress sharply.

**Acceptance Criteria:**
- [ ] Script or GitHub Action runs Lighthouse mobile on `/login` (unauthenticated).
- [ ] Thresholds documented (e.g. Performance drop &gt;10 points warns).
- [ ] Non-blocking for v1 merge if flaky; baseline file from `prd-mobile-performance.md` US-001.
- [ ] **Out of scope for v1 if not completed:** defer to a future `prd-mobile-ci-quality.md` (do not block other mobile PRDs).

## Functional Requirements

- FR-1: Playwright config supports multiple `projects` including one mobile device profile.
- FR-2: At least two mobile-specific assertions (tickets cards, sidebar sheet).
- FR-3: Manual checklist committed to repo and linked from README Testing section.
- FR-4 (Optional): Lighthouse CI configuration with documented thresholds.

## Non-Goals (Out of Scope)

- BrowserStack / Sauce real device farm.
- Visual regression Percy/Chromatic for every page.
- Unit tests for `useIsMobile` unless trivial and stable.
- Load testing mobile API endpoints.

## Technical Considerations

- Mobile E2E may be flakier on filter sheets—use `getByRole` and stable labels in Spanish.
- `reuseExistingServer` for local dev; CI starts `npm run dev` on port 3069.
- Parallel runs: mobile + desktop doubles time—acceptable or split jobs in CI.

## Success Metrics

- Mobile Playwright project green on `main` for 2 consecutive weeks.
- At least one mobile layout bug caught or prevented in PR review within first month (qualitative).

## Open Questions

- Block PR merge on mobile E2E or allow soft-fail initially?
- Which device profile best matches user base: iPhone 13 vs Pixel 7?
