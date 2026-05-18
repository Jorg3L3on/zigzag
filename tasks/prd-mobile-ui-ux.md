# PRD: Mobile UI/UX Improvements

## Introduction

ZigZag’s dashboard is already responsive, but several UI patterns create friction on phones and tablets: iOS input zoom, fixed overlays without safe-area support, and a few screens that still use desktop-first tables. This initiative improves visual layout, touch ergonomics, and consistency with the established mobile card pattern used on list pages (e.g. Tickets, Clientes).

**Problem:** Field and shop staff on mobile devices experience layout clutter, zoom-on-focus, and inconsistent list/detail layouts compared to desktop.

**Assumptions (from product audit):** Scope is **quick wins + targeted layout parity** (not a full visual redesign). Breakpoint remains `md` (768px).

**Locked decisions:** See `tasks/prd-mobile-program-decisions.md` (no Phase 2 items in this PRD).

## Goals

- Eliminate iOS Safari auto-zoom on form focus across the app.
- Ensure fixed UI (offline banner, toasts) respects notched devices and does not obscure primary content.
- Bring dashboard client metrics and payment history in line with mobile-friendly layouts where tables feel cramped.
- Maintain visual consistency with existing shadcn/Tailwind patterns and `Tripled*` components.

## User Stories

### US-001: Prevent iOS zoom on text inputs
**Description:** As a mobile user, I want form fields not to zoom when I focus them so that the layout stays stable while I type.

**Acceptance Criteria:**
- [ ] `Input` component uses `text-base` by default and `md:text-sm` at desktop breakpoint (mirrors `Textarea` pattern).
- [ ] No regression on desktop input appearance at `md+`.
- [ ] Login, client form, and ticket create forms verified on a viewport ≤390px wide.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Safe-area support for fixed top/bottom UI
**Description:** As a user on a notched iPhone, I want the offline banner and toasts to respect safe areas so content is not hidden under the status bar or home indicator.

**Acceptance Criteria:**
- [ ] `NetworkStatusBanner` uses `padding-top: env(safe-area-inset-top)` (or Tailwind equivalent).
- [ ] `Toaster` in root layout configured with bottom/top offset that includes `safe-area-inset-bottom` on mobile.
- [ ] Dashboard page header remains fully visible when banner is shown (optional: `padding-top` on `body` or main inset when banner active—document chosen approach).
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Mobile layout for dashboard client metrics
**Description:** As a mobile user, I want client metrics on the dashboard displayed in a readable card layout so I do not need to squint at a cramped table.

**Acceptance Criteria:**
- [ ] Below `md`, client metrics render as stacked cards or `<dl>` rows (name, ticket count, total spent)—same data as desktop table.
- [ ] At `md+`, existing table layout unchanged.
- [ ] Long client names truncate or wrap without horizontal page scroll.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Mobile-friendly payment history on ticket detail
**Description:** As a mobile user viewing a ticket with partial payments, I want payment history easy to scan without a table-heavy layout.

**Acceptance Criteria:**
- [ ] Below `md`, payment history in `TicketPaymentCollectSection` uses stacked rows (date + amount) instead of `<Table>` (or table remains only if verified readable at 320px).
- [ ] Desktop table layout preserved at `md+`.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Toast placement review for mobile dashboard
**Description:** As a mobile user, I want toast notifications visible and not overlapping critical actions.

**Acceptance Criteria:**
- [ ] Sonner `Toaster` documents chosen position (e.g. `top-center` when banner visible, or `bottom-center` with safe-area).
- [ ] Toasts do not cover primary CTAs on ticket detail and ticket create at 390px width.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## Functional Requirements

- FR-1: Update `src/components/ui/input.tsx` to apply `text-base md:text-sm` in the input class list.
- FR-2: Update `NetworkStatusBanner` and root `Toaster` for safe-area insets.
- FR-3: Refactor `DashboardMetricsClient` client metrics section with `md:hidden` mobile cards and `hidden md:block` table.
- FR-4: Refactor payment history in `ticket-payment-collect-section.tsx` for mobile-friendly layout below `md`.
- FR-5: All changes must use existing Tailwind tokens and Card/Badge patterns—no new design system.

## Non-Goals (Out of Scope)

- Full app redesign or new color system.
- Changing sidebar breakpoint or navigation information architecture.
- Custom native animations or gesture navigation.
- Tablet-specific two-column layouts beyond existing `lg:` usage.
- Dark mode theme work (unless required for contrast fixes found during verification).

## Design Considerations

- Reuse mobile card pattern from `TicketsList` / `ClientList` (`article`, `rounded-lg border`, `<dl>` grids).
- Ticket detail page (`tickets/[id]/page.tsx`) is the reference for spacing (`p-4 sm:p-6`, `max-w-2xl`).
- Breadcrumbs: keep `hidden md:block` for parent segments on small screens.

## Technical Considerations

- Safe-area utilities may need arbitrary values or a small utility in `globals.css` if not in Tailwind config.
- Test on iOS Safari simulator or real device for zoom behavior (16px minimum font size rule).

## Success Metrics

- Zero reports of “page jumps when tapping input” on iOS after release.
- Dashboard client metrics readable without horizontal scroll at 320px viewport width.
- No increase in layout-related support tickets for ticket detail/payment flows.

## Open Questions

- Should toast position switch dynamically when offline banner is visible?
- Is payment history table acceptable at 320px if only two columns? (US-004 may be downgraded if QA passes.)
