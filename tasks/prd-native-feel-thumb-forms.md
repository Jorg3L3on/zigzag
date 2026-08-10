# PRD: Native-feel — Thumb-first ticket edit CTA

**Status:** ❌ Not applied  
**GitHub:** [#345](https://github.com/Jorg3L3on/zigzag/issues/345)  
**Parent:** [`prd-native-feel-pwa.md`](./prd-native-feel-pwa.md)

## Introduction

Ticket **create** already uses `TripledMobileStickyActionBar`. Ticket **edit** still places primary save (and related actions) in the scrolling flow, so thumbs must scroll to commit. This slice adds the same sticky pattern to ticket edit only.

## Goals

- Ticket edit primary save always reachable on mobile without scrolling
- Reuse existing sticky action bar primitive
- Hide bottom tabs while sticky bar is shown (coordinates with bottom-tabs slice)

## User Stories

### US-001: Sticky save on ticket edit
**Description:** As a mobile user editing a ticket, I want a sticky bottom save action so I can submit without scrolling past the whole form.

**Acceptance Criteria:**
- [ ] Ticket edit page uses `TripledMobileStickyActionBar` (or equivalent) below `md` for the primary save/submit control
- [ ] Desktop layout unchanged (no forced sticky bar at `md+`)
- [ ] Shell bottom padding accounts for sticky bar; bottom tabs hidden while bar visible
- [ ] Existing edit validations and error toasts still work
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Mobile E2E for edit sticky CTA
**Description:** As a maintainer, I want E2E coverage that the edit sticky CTA is present on mobile.

**Acceptance Criteria:**
- [ ] `mobile-chrome` assertion: ticket edit shows sticky action bar / primary save control fixed at bottom
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Scope limited to ticket edit (create already done).
- FR-2: Do not move PDF download into the sticky bar unless it already shares that row without crowding save (prefer save as primary).

## Non-Goals

- Sticky CTAs on client, service, or company forms (deferred)
- Redesigning the entire edit form layout
- Changing ticket update Server Action contracts

## Design Considerations

- Match create-ticket sticky bar styling
- Primary button full-width or dominant in the bar

## Technical Considerations

- Page: `src/app/(app)/tickets/[id]/edit/page.tsx`
- Primitive: `src/components/tripled/mobile-first.tsx`

## Success Metrics

- On Pixel-class width, save is visible without scrolling on a typical edit form

## Open Questions

- None
