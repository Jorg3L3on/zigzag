# PRD: Native-feel — Mobile bottom tabs

**Status:** ❌ Not applied  
**GitHub:** [#342](https://github.com/Jorg3L3on/zigzag/issues/342)  
**Parent:** [`prd-native-feel-pwa.md`](./prd-native-feel-pwa.md)

## Introduction

On viewports below `md` (768px), primary navigation lives in a sidebar sheet. Daily users need thumb-reachable tabs for Inicio, Tickets, and Clientes, with **Más** opening the existing sidebar for everything else.

## Goals

- Four-tab mobile bar: Inicio · Tickets · Clientes · Más
- Desktop (`md+`) sidebar unchanged
- Tabs hidden when a sticky form action bar owns the bottom edge
- Shared nav config so tabs and sidebar cannot drift

## User Stories

### US-001: Shared nav item definitions
**Description:** As a developer, I want primary nav items defined once so the sidebar and bottom tabs stay aligned.

**Acceptance Criteria:**
- [ ] Primary nav definitions extracted to a shared module (e.g. titles, hrefs, permission keys)
- [ ] `AppSidebar` consumes the shared module for Plataforma items that map to tabs
- [ ] Typecheck/lint passes

### US-002: Mobile bottom tab bar
**Description:** As a mobile user, I want bottom tabs for Dashboard, Tickets, and Clients so I can switch core screens with my thumb.

**Acceptance Criteria:**
- [ ] Tab bar renders only below `md` (`md:hidden` / `useIsMobile`)
- [ ] Tabs: Inicio → `/dashboard`; Tickets → `/tickets` (requires `tickets.read`); Clientes → `/clients` (requires `clients.read`); Más opens existing mobile sidebar sheet
- [ ] Active tab reflects current route (including nested ticket/client paths)
- [ ] Missing permission: that tab is hidden or disabled consistently with sidebar gating
- [ ] Safe-area bottom inset respected
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Coexist with sticky form action bars
**Description:** As a user on ticket create/edit, I want the sticky save bar unobstructed by tabs.

**Acceptance Criteria:**
- [ ] When `TripledMobileStickyActionBar` (or equivalent) is visible, bottom tabs are hidden
- [ ] List/dashboard pages reserve bottom padding for tab height + safe area
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Mobile E2E for tabs
**Description:** As a maintainer, I want Playwright coverage so tabs do not regress.

**Acceptance Criteria:**
- [ ] `mobile-chrome` spec: tabs visible on `/tickets`; navigate to `/clients`; tabs hidden on ticket create (sticky CTA)
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Mount tab bar from authenticated `(app)` layout inside `SidebarInset`.
- FR-2: Más must open the same mobile sidebar sheet used today (not a second menu system).
- FR-3: System-only destinations stay reachable via Más / sidebar, not as primary tabs.
- FR-4: Update `tasks/mobile-release-checklist.md` with a tabs smoke line.

## Non-Goals

- Redesigning desktop sidebar IA
- Adding Servicios or Recordatorios as primary tabs
- Moving search or notification bell into the tab bar

## Design Considerations

- Reuse existing icons/labels from sidebar where possible
- Touch targets ~44px (align with accessibility PRD)
- Visual weight should match `Tripled` mobile chrome, not a new design system

## Technical Considerations

- Breakpoint: `MOBILE_BREAKPOINT_PX` / `md` = 768
- Permission hooks: existing `usePermissions` / `canAccessPermission`
- Conflict: sticky action bar already `fixed bottom-0 z-30`

## Success Metrics

- Core three destinations reachable in one tap on mobile
- No double bottom chrome on create/edit ticket

## Open Questions

- None
