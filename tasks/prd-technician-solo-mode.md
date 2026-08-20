# PRD: Field program — Technician solo mode (Hoy-first home)

**Status:** 📋 Ready to implement — **Epic A, slice 2**  
**Program:** [`prd-field-program-decisions.md`](./prd-field-program-decisions.md)  
**Parent discovery:** [`prd-first-customer-field-technician.md`](./prd-first-customer-field-technician.md)  
**Pairs with:** [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md) (Epic A0)  
**Agent entry:** [`FIELD-PROGRAM.md`](./FIELD-PROGRAM.md)

## Introduction

ZigZag’s `/dashboard` is still an **office SaaS home**. The first field customer needs **Hoy as the product** — who to visit, what is overdue, quick cobro — with charts and onboarding checklist demoted.

**Solo / campo mode** is a tenant-scoped `Company.settings.experience_mode` flag (`campo` | `office`) with auto-default for single-user tenants.

## Goals

- Hoy-first `/dashboard` for campo tenants on mobile
- Hide charts, KPI grid, onboarding checklist on mobile campo home
- Spanish field copy; battery-quiet (no Recharts on mobile campo)
- Office dashboard unchanged for multi-user / explicit office mode
- Mi empresa toggle: Campo vs Oficina

## User Stories

### US-001: Campo mode flag in company settings
**Description:** As a developer, I want a typed company setting for experience mode.

**Acceptance Criteria:**
- [ ] `CompanySettingsJson.experience_mode`: `'campo' | 'office'` (default participates in auto-default)
- [ ] Pure `resolveExperienceMode(settings, signals)` with unit tests
- [ ] Admin can set via company update (`company.manage`)
- [ ] Typecheck/lint passes

### US-002: Auto-default campo for single-user tenants
**Description:** As a solo technician, I want campo without configuring settings.

**Acceptance Criteria:**
- [ ] Unset mode + `totalUsers <= 1` + non-system company ⇒ `campo`
- [ ] Unset + multiple users ⇒ `office`
- [ ] Unit tests for boundaries

### US-003: Solo dashboard composition module
**Description:** As a developer, I want testable widget ordering for campo.

**Acceptance Criteria:**
- [ ] Pure module defines campo widgets: `technicianDay` first; excludes charts, KPI grid, activity feed, onboarding on mobile
- [ ] Office composition unchanged when not campo
- [ ] Unit tests

### US-004: Hoy-first mobile dashboard layout
**Description:** As a field technician, I want today’s work immediately on open.

**Acceptance Criteria:**
- [ ] Mobile campo: `DashboardTechnicianDayWidget` first content slot
- [ ] No `DashboardCharts` mount on mobile campo
- [ ] No onboarding checklist on mobile campo
- [ ] SSR passes `initialExperienceMode` to avoid chart flash
- [ ] Verify mobile viewport

### US-005: Technician day widget — field copy
**Description:** As Don, I want notebook language on the home list.

**Acceptance Criteria:**
- [ ] Description: visitas/trabajos pendientes (not “Tickets sin terminar” primary)
- [ ] Empty state CTA → Anotar
- [ ] Errors without raw codes as headline

### US-006: Compact day summary strip
**Description:** As a technician, I want entró hoy + por cobrar at a glance.

**Acceptance Criteria:**
- [ ] Two chips max: Entró hoy, Por cobrar → `/cobranza`
- [ ] Hidden on metrics failure
- [ ] Verify mobile viewport

### US-007: Hide onboarding checklist in campo
**Description:** As a solo technician, I do not want RFC checklist on home.

**Acceptance Criteria:**
- [ ] `shouldShowOnboardingChecklist` false when campo
- [ ] Checklist still on Mi empresa
- [ ] Unit test

### US-008: Demote schedules/activity on mobile campo
**Description:** As a technician, I want PM only when due today.

**Acceptance Criteria:**
- [ ] Schedules widget only if overdue/due-today on mobile campo
- [ ] Activity feed hidden in campo v1

### US-009: Page intro copy for Hoy
**Description:** As a technician, I want “Tu día en el campo” not “Resumen de operación”.

**Acceptance Criteria:**
- [ ] Subtitle and breadcrumb **Hoy** in campo
- [ ] Verify mobile viewport

### US-010: Sidebar nav copy alignment
**Description:** As a user in Más, sidebar `/dashboard` label **Hoy** in campo.

**Acceptance Criteria:**
- [ ] Campo: sidebar **Hoy**; office: **Inicio**
- [ ] Verify Más sheet

### US-011: Office dashboard unchanged
**Description:** As multi-user office, I keep charts.

**Acceptance Criteria:**
- [ ] `experience_mode === 'office'` unchanged dashboard
- [ ] Verify desktop

### US-012: Toggle vista oficina in Mi empresa
**Description:** As admin, I can switch back to office dashboard.

**Acceptance Criteria:**
- [ ] **Experiencia de inicio** toggle saves `experience_mode`
- [ ] Dashboard updates on next navigation
- [ ] Verify browser

### US-013: System users exempt from campo auto-default
**Description:** As system operator, I never get stripped dashboard.

**Acceptance Criteria:**
- [ ] System company / no tenant selected → never campo composition

### US-014: Session visibility refresh on campo home
**Description:** As a technician, I want session refresh on dashboard focus.

**Acceptance Criteria:**
- [ ] Reuse native-feel session visibility refresh if merged; else minimal implementation
- [ ] No polling on Hoy home

### US-015: Tests and E2E
**Description:** As maintainer, prevent chart leak into campo home.

**Acceptance Criteria:**
- [ ] Jest: resolveExperienceMode, composition, checklist
- [ ] Playwright mobile: technician-day-widget visible, no chart canvas

### US-016: Release checklist line
**Description:** As release owner, campo smoke documented.

**Acceptance Criteria:**
- [ ] `tasks/field-release-checklist.md` includes campo Hoy-first smoke

## Functional Requirements

- FR-1–FR-12: See full spec in git history / agent handoff; key: campo overrides widget list; auto-default single user; no RFC gate on home view.

## Non-Goals

- `/hoy` route split, offline CRUD, Anotar page, bottom tabs, PIN auth, sites/assets

## Dependencies

- **Soft:** [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md)
- **Blocks:** nothing hard

## Open Questions (defaults locked)

| Q | Default |
|---|---------|
| Card title | Keep “Trabajo de hoy” on card; page **Hoy** |
| KPI strip on mobile | Yes, two chips |
| Auto-switch on 2nd user | No — admin toggles |
