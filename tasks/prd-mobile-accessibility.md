# PRD: Mobile Accessibility

## Introduction

ZigZag already includes solid patterns on list cards (keyboard activation, `aria-label` on many actions, live regions on the network banner). This PRD addresses **mobile-specific accessibility gaps**: overlap of fixed UI, small touch targets on charts, and consistency of screen reader labels on dense admin screens.

**Assumptions:** WCAG 2.1 Level AA is the target where practical. No formal third-party audit in v1 unless noted in Open Questions.

**Locked decisions:** See `tasks/prd-mobile-program-decisions.md`.

## Goals

- Fixed overlays do not hide focusable controls or essential content.
- Interactive elements meet minimum touch target guidance (~44×44px) on primary flows.
- Charts and filters remain usable with VoiceOver (iOS) and TalkBack (Android) on key paths.
- Dialogs and sheets trap focus appropriately on mobile.

## User Stories

### US-001: Offline banner does not trap or hide focus
**Description:** As a screen reader user on mobile, I want the offline banner announced without blocking navigation to the sidebar or main content.

**Acceptance Criteria:**
- [ ] Banner has `role="status"` and `aria-live` (existing—verify unchanged).
- [ ] When banner visible, first focusable element in main content remains reachable.
- [ ] Banner height accounted for in layout (coordinates with `prd-mobile-ui-ux.md` US-002).
- [ ] Manual VoiceOver pass: open sidebar, navigate to Tickets link with banner visible.
- [ ] Typecheck/lint passes.

### US-002: Touch target audit on primary mobile flows
**Description:** As a user with motor difficulties, I want buttons and links large enough to tap reliably on ticket and list screens.

**Acceptance Criteria:**
- [ ] Audit checklist completed for: login, tickets list mobile cards, ticket detail CTAs, sidebar trigger, filter sheet actions.
- [ ] Any control below 44px height/width gets padding or `min-h-11` / expanded hit area (sidebar pattern).
- [ ] Icon-only buttons have `aria-label` (Spanish, matching visible purpose).
- [ ] Findings fixed or documented as exceptions in PR.
- [ ] Verify in browser using dev-browser skill.

### US-003: Chart accessibility on mobile
**Description:** As a low-vision mobile user, I want dashboard charts to expose data in a non-pointer-only way.

**Acceptance Criteria:**
- [ ] Recharts `accessibilityLayer` remains enabled.
- [ ] Empty states for charts have text alternatives (existing copy verified).
- [ ] Document that tooltips are supplemental; table/summary data available elsewhere (client metrics table/cards).
- [ ] Optional: `aria-label` on chart container describing chart purpose.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Mobile sheet and dialog focus trap
**Description:** As a keyboard/screen reader user, I want filter sheets and dialogs to trap focus until dismissed.

**Acceptance Criteria:**
- [ ] Tickets filter `Sheet`: focus moves inside on open; Escape closes; focus returns to trigger.
- [ ] Radix `Dialog` on ticket services: same behavior on mobile viewport.
- [ ] No focus lost behind sheet overlay on iOS Safari (manual test).
- [ ] Verify in browser using dev-browser skill.

### US-005: Form error association on mobile forms
**Description:** As a screen reader user, I want validation errors announced when submitting client or ticket forms.

**Acceptance Criteria:**
- [ ] `FormMessage` from react-hook-form linked via `aria-describedby` on invalid fields (verify `FormControl` implementation).
- [ ] Submit with empty required field: error message read by VoiceOver on mobile.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## Functional Requirements

- FR-1: Coordinate layout fixes with UI/UX PRD for banner/safe-area.
- FR-2: Touch target fixes applied only where audit fails; prefer shared Button sizes over one-off CSS.
- FR-3: Chart containers include accessible name or nearby textual summary.
- FR-4: Sheet/Dialog components use Radix defaults; fix only if mobile Safari fails.
- FR-5: Form field errors associated with inputs per shadcn Form pattern.

## Non-Goals (Out of Scope)

- Full WCAG audit of every admin page (roles, permissions, companies).
- High contrast theme.
- Localization of screen reader strings beyond existing Spanish UI.
- Automated axe-core CI (may be future work).

## Design Considerations

- Do not reduce information density below usability for sighted users when increasing touch targets.
- Use `sr-only` labels where visual design is icon-only.

## Technical Considerations

- iOS Safari + VoiceOver is the primary manual test platform.
- `Sidebar` mobile sheet hides close button visually (`[&>button]:hidden`)—ensure swipe/outside click still accessible.

## Success Metrics

- Zero critical a11y blockers on audited flows (login, tickets list, ticket detail, ticket create).
- Touch target audit: 100% of primary actions pass 44px guideline or documented exception.

## Open Questions

- Should we add `eslint-plugin-jsx-a11y` stricter rules in CI?
- Formal WCAG audit required for compliance/legal?
