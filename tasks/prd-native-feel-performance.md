# PRD: Native-feel — Perceived performance

**Status:** ❌ Not applied  
**GitHub:** [#352](https://github.com/Jorg3L3on/zigzag/issues/352)–[#355](https://github.com/Jorg3L3on/zigzag/issues/355)  
**Parent:** [`prd-native-feel-pwa.md`](./prd-native-feel-pwa.md)

## Introduction

Mobile Lighthouse baselines (2026-06-20) show `/dashboard` ~68 and `/tickets` ~76 with multi-second LCP. This slice improves **perceived** speed with route skeletons, **conservative** idle prefetch of the three tab routes, and light optimistic UI — without aggressive link prefetch or new infrastructure cost.

## Goals

- Skeletons for dashboard, tickets, and clients navigations
- Idle prefetch of `/dashboard`, `/tickets`, `/clients` on mobile only (one-shot)
- Low-risk optimistic UI where rollback is trivial
- Refresh documented Lighthouse baselines

## User Stories

### US-001: Route loading skeletons
**Description:** As a mobile user navigating between core routes, I want skeletons that resemble the destination layout so the wait feels shorter.

**Acceptance Criteria:**
- [ ] `loading.tsx` (or equivalent) for tickets, clients, and dashboard segments showing card/list-shaped placeholders
- [ ] Skeletons do not cause large CLS relative to final content where practical
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Conservative idle prefetch
**Description:** As a mobile user, I want the three tab routes warmed after first paint without prefetching the entire app.

**Acceptance Criteria:**
- [ ] After idle on mobile authenticated shell, `router.prefetch` for `/dashboard`, `/tickets`, `/clients` at most once per session
- [ ] No hover-prefetch of arbitrary links beyond Next defaults
- [ ] Desktop may skip this idle prefetch
- [ ] Typecheck/lint passes

### US-003: Light optimistic UI
**Description:** As a user, I want snappy feedback on low-risk toggles without optimistic payment/status mutations.

**Acceptance Criteria:**
- [ ] At least one low-risk flow uses optimistic or instant local update (e.g. notification mark-read) with rollback on failure
- [ ] Ticket payment collect and status changes remain server-confirmed (no optimistic audit-sensitive writes)
- [ ] Typecheck/lint passes

### US-004: Lighthouse baseline refresh
**Description:** As a maintainer, I want updated mobile Lighthouse numbers after this work.

**Acceptance Criteria:**
- [ ] `npm run lighthouse:mobile` re-run on prod build; results written to `tasks/mobile-lighthouse-baseline.md`
- [ ] No CI hard gate required in this slice
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Prefetch limited to the three bottom-tab routes.
- FR-2: Do not enable service-worker caching of RSC/API to “win” Lighthouse.

## Non-Goals

- Lighthouse CI fail-the-build gate
- CDN/image product upgrades
- Rewriting dashboard charts for micro-optimizations unrelated to navigation feel

## Technical Considerations

- Existing coarse `src/app/(app)/loading.tsx` can be specialized per segment
- Cost: idle prefetch adds a few RSC hits — accepted under epic cost guardrails

## Success Metrics

- Navigation between tab routes feels immediate after first idle prefetch
- Baseline doc updated with new date and scores

## Open Questions

- None
