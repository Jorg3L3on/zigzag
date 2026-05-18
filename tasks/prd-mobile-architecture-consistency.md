# PRD: Mobile Architecture & List Consistency

## Introduction

ZigZag has a documented list pattern (`.cursor/rules/lists-and-responsive-tables.mdc`): TanStack Table on desktop, cards on mobile, debounced search, button filters, and shared sorting. **Companies** and the unused **`ui/data-table.tsx`** diverge from this pattern, increasing risk of future mobile regressions when new lists are added.

This PRD standardizes architecture so every resource list behaves the same on mobile.

**Locked decisions:** See `tasks/prd-mobile-program-decisions.md`.

## Goals

- All dashboard resource lists follow the same mobile/desktop split and TanStack patterns.
- `CompaniesList` reaches parity with `TicketsList` / `ClientList`.
- `useIsMobile` breakpoint stays aligned with Tailwind `md` (768px).
- Prevent new lists from shipping table-only mobile layouts.

## User Stories

### US-001: Migrate CompaniesList to TanStack Table
**Description:** As a developer, I want companies to use the same table stack as clients and tickets so sorting, filtering, and mobile row models stay consistent.

**Acceptance Criteria:**
- [ ] Create `companies-columns.tsx` with column definitions and actions.
- [ ] `CompaniesList` uses `useReactTable` with sorting and filtered row model (match `ClientList` patterns).
- [ ] Desktop: `hidden md:block` table from TanStack.
- [ ] Mobile: `md:hidden` cards driven by `table.getRowModel().rows` (not a separate filtered array).
- [ ] Existing filters (search, status) still work.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Align companies mobile sort with other lists
**Description:** As a mobile user, I want to sort the companies list the same way I sort clients or tickets.

**Acceptance Criteria:**
- [ ] Mobile sort `Select` below `md` with presets file e.g. `companies-sort-presets.ts` (encode/decode sorting state).
- [ ] Sort order matches desktop column sorting.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Deprecate or restrict generic DataTable component
**Description:** As a developer, I should not accidentally use a table-only component for new list pages.

**Acceptance Criteria:**
- [ ] Decision documented in `ui/data-table.tsx` file comment OR component removed if unused.
- [ ] If kept: JSDoc warns “Do not use for dashboard lists—use resource *List pattern”.
- [ ] Grep confirms no dashboard list imports `DataTable` without mobile cards.
- [ ] Typecheck/lint passes.

### US-004: Update lists-and-responsive-tables rule
**Description:** As a contributor, I want AGENTS/rules to mention companies and anti-patterns explicitly.

**Acceptance Criteria:**
- [ ] `.cursor/rules/lists-and-responsive-tables.mdc` lists Companies as reference implementation after migration.
- [ ] Rule states: mobile cards must use TanStack row model; plain `.map` on filtered array is discouraged.
- [ ] AGENTS.md links to rule (one line) if not already.

### US-005: Shared breakpoint constant (optional)
**Description:** As a developer, I want `useIsMobile` and Tailwind `md` to stay in sync when breakpoint changes.

**Acceptance Criteria:**
- [ ] Single exported constant e.g. `MOBILE_BREAKPOINT_PX = 768` in `src/lib/breakpoints.ts`.
- [ ] `use-mobile.tsx` imports it; comment references Tailwind `md`.
- [ ] No behavior change at 768px.
- [ ] Typecheck/lint passes.

## Functional Requirements

- FR-1: Companies list fully migrated to TanStack + mobile cards from row model.
- FR-2: Companies sort presets and mobile sort UI added.
- FR-3: `DataTable` usage policy enforced via docs and/or removal.
- FR-4: Cursor rule updated for future lists.
- FR-5 (Optional): Shared breakpoint constant.

## Non-Goals (Out of Scope)

- Rewriting all lists in one PR if risk too high—companies-first, others unchanged.
- Changing breakpoint from 768px to 640px.
- URL persistence for sort state on companies (unless already planned elsewhere).

## Technical Considerations

- Companies delete on mobile may land in `prd-mobile-functionality.md`—coordinate stories.
- `CompaniesList` currently filters `filteredCompanies` manually—move logic into table filters.

## Success Metrics

- Companies list code structure matches ClientList file layout (columns + list client + sort presets).
- New list PRs reference rule; zero new table-only mobile pages in next quarter.

## Open Questions

- Should companies adopt URL-encoded sort state like tickets?
- Remove `data-table.tsx` entirely vs document-only?
