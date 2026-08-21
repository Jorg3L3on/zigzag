# PRD: Field program — Mobile bottom tabs (Hoy / Anotar / Clientes / Más)

**Status:** 📋 Ready to implement — **Epic A, slice 1**  
**Program:** [`prd-field-program-decisions.md`](./prd-field-program-decisions.md)  
**Supersedes tab IA in:** [`prd-native-feel-bottom-tabs.md`](./prd-native-feel-bottom-tabs.md) (generic Inicio/Tickets tabs)  
**Parent discovery:** [`prd-first-customer-field-technician.md`](./prd-first-customer-field-technician.md)

## Introduction

Mobile bottom tabs already exist (`MobileBottomTabBar`, shared `nav-items.ts`, Playwright `e2e/mobile-bottom-tabs.spec.ts`) with **Inicio · Tickets · Clientes · Más**. For the first field customer, thumb navigation must match **notebook verbs**, not office nouns: **what is today**, **write a job**, **who is the client**, **everything else**.

This slice retargets the four tabs without redesigning desktop sidebar IA. **Hoy** and **Anotar** routes may gain dedicated pages in later epics; tabs ship first with `/dashboard` and `/tickets/create` so the customer returns to a familiar native-feel shell.

## Goals

- Four-tab mobile bar: **Hoy · Anotar · Clientes · Más**
- **Hoy** → `/dashboard` (active when on dashboard; later also `/hoy` if split)
- **Anotar** → `/tickets/create` (active on create and nested create paths; later `/anotar`)
- **Clientes** → `/clients` (unchanged)
- **Más** → opens existing mobile sidebar sheet
- Desktop (`md+`) sidebar unchanged
- Tabs hidden when sticky form action bar owns the bottom edge (existing behavior)
- Shared nav config so sidebar labels and tabs stay aligned where they overlap

## User Stories

### US-001: Field tab definitions in shared nav config
**Description:** As a developer, I want Hoy and Anotar defined in the shared nav module so sidebar and bottom tabs do not drift.

**Acceptance Criteria:**
- [ ] `nav-items.ts` (or successor) defines mobile tab entries: Hoy (`/dashboard`), Anotar (`/tickets/create`), Clientes (`/clients`)
- [ ] Tickets list (`/tickets`) is **not** a primary tab; reachable via Hoy widgets, Más, or in-app links
- [ ] Icons appropriate for field copy (e.g. Calendar/Home for Hoy, Pen/Plus for Anotar — product choice in implementation)
- [ ] `MOBILE_TAB_ITEMS` order: Hoy, Anotar, Clientes (then Más button in tab bar component)
- [ ] Typecheck/lint passes

### US-002: Mobile bottom tab bar shows Hoy / Anotar / Clientes / Más
**Description:** As a field technician on Android, I want bottom tabs labeled Hoy, Anotar, Clientes, and Más so I can reach daily work with my thumb.

**Acceptance Criteria:**
- [ ] Tab bar renders only below `md` (existing breakpoint)
- [ ] Visible labels: **Hoy**, **Anotar**, **Clientes**, **Más**
- [ ] Hoy navigates to `/dashboard`; Anotar to `/tickets/create`; Clientes to `/clients`
- [ ] Active tab: Hoy on `/dashboard` (and `/hoy` if added later); Anotar on `/tickets/create` and paths under it; Clientes on `/clients` and nested client paths
- [ ] Permission gating unchanged (`tickets.read` / `clients.read` as today)
- [ ] Safe-area bottom inset respected
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill (mobile viewport)

### US-003: Coexist with sticky form action bars
**Description:** As a user on Anotar / ticket create or edit, I want the sticky save bar unobstructed by tabs.

**Acceptance Criteria:**
- [ ] When `TripledMobileStickyActionBar` is visible, bottom tabs hidden (existing `useMobileChrome` behavior)
- [ ] List/dashboard pages reserve bottom padding for tab height + safe area
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Sidebar consistency
**Description:** As a user opening Más, I want sidebar entries to still include Tickets list and other office routes without duplicating tab destinations confusingly.

**Acceptance Criteria:**
- [ ] Sidebar still lists Tickets, Cobranza, Recordatorios, etc.
- [ ] Optional: sidebar shows **Hoy** alias or keeps **Inicio** label pointing to `/dashboard` — document chosen copy in PR
- [ ] No second “Más” menu system
- [ ] Typecheck/lint passes

### US-005: Mobile E2E for field tabs
**Description:** As a maintainer, I want Playwright coverage so field tabs do not regress to Inicio/Tickets.

**Acceptance Criteria:**
- [ ] Update `e2e/mobile-bottom-tabs.spec.ts`: tabs show Hoy, Anotar, Clientes, Más on `/dashboard`
- [ ] Navigate Anotar → `/tickets/create`; tabs hidden when sticky CTA present
- [ ] Navigate Clientes from tab
- [ ] Typecheck/lint passes

### US-006: Release checklist
**Description:** As a release owner, I want a smoke line for field tabs before the customer returns.

**Acceptance Criteria:**
- [ ] `tasks/mobile-release-checklist.md` or new `tasks/field-release-checklist.md` includes: confirm Hoy/Anotar/Clientes/Más on Android PWA

## Functional Requirements

- FR-1: Mount tab bar from authenticated `(app)` layout (existing `app-mobile-chrome.tsx`).
- FR-2: Más opens the same mobile sidebar sheet as today (`setOpenMobile(true)`).
- FR-3: System-only destinations stay in Más / sidebar, not primary tabs.
- FR-4: `getLongestMatchingHref` must not mark Hoy active when user is on `/tickets` list only — Tickets is not a tab.
- FR-5: When Anotar epic adds `/anotar`, update Anotar tab href in one config place only.

## Non-Goals

- Dedicated `/hoy` or `/anotar` pages (later epics)
- Campo mode flag to show Inicio/Tickets for office users (optional follow-up)
- Redesigning desktop sidebar
- Adding Cobranza or Recordatorios as tabs
- Offline behavior changes

## Design Considerations

- Spanish labels exactly: **Hoy**, **Anotar**, **Clientes**, **Más**
- Touch targets ~44px (existing h-14 pattern)
- Anotar tab should feel primary (center or second position — prefer order: Hoy | Anotar | Clientes | Más)

## Technical Considerations

- Existing files: `src/lib/nav-items.ts`, `src/components/mobile-bottom-tab-bar.tsx`, `src/contexts/mobile-chrome-context.tsx`, `e2e/mobile-bottom-tabs.spec.ts`
- Anotar active state: include `/tickets/create` in tab href matching; exclude `/tickets` list
- Breakpoint: `MOBILE_BREAKPOINT_PX` / `md` = 768

## Success Metrics

- Field technician reaches Hoy, Anotar, and Clientes in one tap each
- No double bottom chrome on Anotar create flow
- Customer PWA install lands on Hoy tab visually after login redirect to `/dashboard`

## Dependencies

- None blocking; pairs with `prd-technician-solo-mode.md` (Hoy-first dashboard content) but tabs can ship first

## Open Questions

- Sidebar label for `/dashboard`: keep **Inicio** in sidebar while tab says **Hoy**, or rename both to **Hoy**? **Default: tab Hoy, sidebar Inicio until solo-mode PRD unifies copy.**
