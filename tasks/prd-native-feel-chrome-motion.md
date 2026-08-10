# PRD: Native-feel — App chrome, motion, pull-to-refresh

**Status:** ❌ Not applied  
**GitHub:** [#348](https://github.com/Jorg3L3on/zigzag/issues/348)–[#351](https://github.com/Jorg3L3on/zigzag/issues/351)  
**Parent:** [`prd-native-feel-pwa.md`](./prd-native-feel-pwa.md)

## Introduction

Native apps feel continuous: no browser chrome when installed, light motion, and pull-to-refresh on lists. This slice adds standalone detection, restrained transitions, pull-to-refresh on tickets/clients lists, and optional haptic vibrate on success — without background polling.

## Goals

- Detect `display-mode: standalone` for light chrome tweaks
- Short content transitions that honor `prefers-reduced-motion`
- User-initiated pull-to-refresh on tickets and clients lists
- Optional `navigator.vibrate` on selected successful primary actions

## User Stories

### US-001: Standalone display-mode detection
**Description:** As an installed PWA user, I want the UI to recognize standalone mode so chrome can adapt slightly.

**Acceptance Criteria:**
- [ ] Hook or CSS (`display-mode: standalone`) available to app shell
- [ ] At least one concrete adaptation shipped (e.g. documentation class on `html`/`body`, or hide redundant browser-ish affordance if any)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Reduced-motion-safe transitions
**Description:** As a user, I want subtle navigation/content transitions that do not run when I prefer reduced motion.

**Acceptance Criteria:**
- [ ] Tab or main content uses a short opacity/transform transition
- [ ] Under `prefers-reduced-motion: reduce`, transitions are disabled or instantaneous
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Pull-to-refresh on tickets and clients
**Description:** As a mobile user, I want to pull down on tickets and clients lists to reload data.

**Acceptance Criteria:**
- [ ] Pull-to-refresh on `/tickets` and `/clients` list UIs (mobile)
- [ ] Refresh is user-initiated only (no interval polling)
- [ ] Shows loading affordance; errors toast without wiping the list blindly
- [ ] Does not fight scroll inside nested sheets/dialogs
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Optional success vibrate
**Description:** As an Android user, I want light haptic feedback on successful primary actions when the browser supports it.

**Acceptance Criteria:**
- [ ] `navigator.vibrate` called on a small set of successes (e.g. payment collect and/or ticket save) when available
- [ ] No-op when unsupported; no error thrown
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Pull-to-refresh must call existing list reload paths (Server Actions / router refresh), not new APIs.
- FR-2: Coordinate bottom offsets with bottom tab bar and sticky CTAs.

## Non-Goals

- Custom gesture navigation stacks
- Background periodic refresh
- Replacing Sonner toasts

## Technical Considerations

- Overscroll/PTR libraries should stay dependency-light; prefer small local hook if possible
- E2E may only smoke that a refresh control exists if PTR is hard to synthesize

## Success Metrics

- Lists can be refreshed with a pull on mobile without opening desktop-only controls
- Reduced-motion users see no gratuitous animation

## Open Questions

- None
