# PRD: Field program — Technician solo mode (Hoy-first home)

**Status:** 📋 Ready to implement — **Epic A, slice 2**  
**Program:** [`prd-field-program-decisions.md`](./prd-field-program-decisions.md)  
**Parent discovery:** [`prd-first-customer-field-technician.md`](./prd-first-customer-field-technician.md)  
**Pairs with:** [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md) (Epic A0 — Hoy · Anotar · Clientes · Más)  
**Out of scope here:** offline jobs ([`prd-offline-first-jobs.md`](./prd-offline-first-jobs.md)), dedicated `/anotar` ([`prd-job-capture-anotar.md`](./prd-job-capture-anotar.md))

## Introduction

ZigZag’s `/dashboard` is still an **office SaaS home**: KPI cards, revenue charts, month-range selectors, export controls, onboarding checklist pressure (RFC, catálogo, invitar equipo), and “Trabajo de hoy” buried under metrics for most personas. The first field customer needs the opposite: **Hoy is the product** — who to visit, what is overdue, quick cobro — with SaaS chrome demoted to **Más** or desktop-only paths.

Existing building blocks are already in the repo:

- `DashboardTechnicianDayWidget` + `technician-day-queue.ts` — unfinished tickets for today and overdue, with Llamar / WhatsApp / Cobrar actions
- `dashboard-metrics-client.tsx` — persona-based widget composition via `buildDashboardComposition` / `resolveDashboardPersona`
- `useTechnicianDayQueue` — server-backed day queue hook

**Solo mode** (also **modo campo**) is a tenant-scoped experience flag that:

1. Makes **Hoy** the primary dashboard content on mobile and simplified desktop
2. **Hides or demotes** charts, KPI grids, export month pickers, heavy onboarding, and office quick actions for solo tenants
3. Applies **Spanish field copy** (trabajo, visita, cobro — not Ticket/Dashboard jargon on the home surface)
4. Activates by **company setting** and/or **auto-default** when the tenant looks like a single field operator (one active user, no dismissed checklist need)

This slice does **not** require offline CRUD or a new `/hoy` route; it reshapes `/dashboard` and related copy. Bottom tabs (Epic A0) can ship before or alongside this PRD; solo mode assumes the user can reach Hoy via tab or sidebar.

## Goals

- Login and PWA open land on a **Hoy-first** `/dashboard` for campo tenants — not a metrics wall
- **Trabajo de hoy** (`DashboardTechnicianDayWidget`) is the **first meaningful content** above the fold on mobile
- Charts, multi-month KPI strip, PDF export controls, activity feed, and office onboarding checklist are **hidden** in solo mode (reachable via Más / sidebar where still permitted)
- **Spanish field language** on the home surface and technician widget (visita, trabajo, por cobrar — de-emphasize “ticket” in headings)
- **Campo mode resolution**: explicit `Company.settings.experience_mode = 'campo'` **or** auto-enable for single-user tenants until an admin opts into “vista oficina”
- **Battery-quiet home**: no chart lazy-load / Recharts mount on mobile solo dashboard; defer nonessential widgets
- Preserve **full office dashboard** for multi-user tenants, system users, and tenants that opt out of campo
- Unit tests for composition rules; Playwright smoke for mobile Hoy-first layout

## User Stories

### US-001: Campo mode flag in company settings
**Description:** As a developer, I want a typed company setting for experience mode so solo and office dashboards do not fork ad hoc.

**Acceptance Criteria:**
- [ ] Extend `CompanySettingsJson` with optional `experience_mode`: `'campo' | 'office'` (default `'office'` when absent)
- [ ] Pure helper `resolveExperienceMode(settings, signals)` returns `'campo' | 'office'` — see FR-2 for auto-default rules
- [ ] Server action or existing company update path can set `experience_mode` (admin-only); no new table
- [ ] Typecheck/lint passes
- [ ] Unit tests for resolve helper (explicit campo, explicit office, auto-default, opt-out)

### US-002: Auto-default campo for single-user tenants
**Description:** As a solo electrician on a fresh tenant, I want the app to feel like a field notebook without configuring a setting first.

**Acceptance Criteria:**
- [ ] When `experience_mode` is unset, default to **`campo`** if tenant signals match: `activeUserCount <= 1` AND `totalUsers <= 1` (exclude system company)
- [ ] When `experience_mode` is unset and `activeUserCount > 1` OR `totalUsers > 1`, default to **`office`**
- [ ] Signals fetched server-side for dashboard load (reuse existing count queries or lightweight aggregate)
- [ ] Typecheck/lint passes
- [ ] Unit tests cover boundary: 1 user = campo, 2 users = office

### US-003: Solo dashboard composition module
**Description:** As a developer, I want a dedicated dashboard composition for campo so widget ordering is testable without a 500-line client component fork.

**Acceptance Criteria:**
- [ ] New pure module (e.g. `dashboard-campo-composition.ts`) defines widget list for solo mode: `technicianDay` first; optional compact `daySummary` (today $ / por cobrar count); **excludes** `charts`, `kpis` grid, `needsAttention` office variant, `quickActions` office grid, `activityFeed` on mobile
- [ ] Integrates with or extends `DashboardWidgetId` / composition builder without breaking admin/operator/viewer personas when `experience_mode !== 'campo'`
- [ ] Desktop `md+` in campo: still Hoy-first but may show a **single** compact KPI row (entradas hoy / por cobrar) — not Recharts
- [ ] Typecheck/lint passes
- [ ] Unit tests: campo composition excludes charts; office unchanged

### US-004: Hoy-first mobile dashboard layout
**Description:** As a field technician on Android, I want to open the app and immediately see today’s work, not charts or setup checklists.

**Acceptance Criteria:**
- [ ] On `/dashboard` with campo mode and viewport `< md`: **Trabajo de hoy** widget renders in the **first content slot** (after page intro)
- [ ] No `DashboardCharts` mount on mobile solo dashboard
- [ ] No 4-up KPI grid on mobile solo dashboard
- [ ] No month-range / export PDF controls on mobile solo dashboard
- [ ] No onboarding checklist widget on mobile solo dashboard (even if tenant is in SETUP)
- [ ] Loading skeleton for solo mobile matches reduced widget set (no chart skeleton)
- [ ] Typecheck/lint passes
- [ ] Verify in browser at mobile viewport (375×812): Hoy widget visible without scrolling past charts
- [ ] Verify in browser: bottom tab **Hoy** active on `/dashboard` when A0 tabs shipped

### US-005: Technician day widget — field copy refresh
**Description:** As Don, I want the home list to speak like my notebook, not like office software.

**Acceptance Criteria:**
- [ ] Card title **Trabajo de hoy** retained or shortened to **Hoy** in solo context (product choice documented in PR)
- [ ] Description uses field Spanish: e.g. “Visitas y trabajos pendientes de hoy y atrasados” — avoid “Tickets sin terminar” as primary copy in campo
- [ ] Secondary links: **Ver todos** → unfinished work list; **Por cobrar** → Cobranza — labels unchanged or “Saldo pendiente”
- [ ] Empty state: “No tienes visitas pendientes hoy. ¿Anotar un trabajo?” with CTA link to Anotar (`/tickets/create` until `/anotar`)
- [ ] Error state: plain Spanish, no error code as headline (align with `getErrorDisplayMessage` patterns)
- [ ] `data-testid="technician-day-widget"` preserved
- [ ] Typecheck/lint passes
- [ ] Verify in browser at mobile viewport: empty and populated states readable in sunlight contrast (existing tokens)

### US-006: Compact day summary strip (optional solo header)
**Description:** As a field technician, I want one glance at “cuánto entró hoy” and “quién me debe” without opening charts.

**Acceptance Criteria:**
- [ ] Below page intro, above day queue: **at most two** compact stat chips/cards: **Entró hoy** (cash collected today or paid today — use existing metrics or technician-day aggregates) and **Por cobrar** (count or total balance — link to Cobranza)
- [ ] Numbers formatted MXN; no sparklines
- [ ] Hidden when metrics fetch fails — day queue still works
- [ ] Typecheck/lint passes
- [ ] Verify in browser at mobile viewport: strip visible, tappable Por cobrar → `/cobranza`

### US-007: Hide office onboarding checklist in campo
**Description:** As a solo technician, I do not want RFC/catálogo/equipo checklist blocking my home screen.

**Acceptance Criteria:**
- [ ] `shouldShowOnboardingChecklist` returns false when experience mode is **`campo`**, regardless of activation signals
- [ ] Checklist remains available from **Mi empresa** / guías for users who navigate there deliberately
- [ ] Dismissing checklist not required for campo home to feel clean
- [ ] Typecheck/lint passes
- [ ] Unit test: campo + empty tenant → checklist hidden

### US-008: Demote schedules and activity feed on mobile solo
**Description:** As a field technician, I want PM reminders only if they matter today — not a full office widget grid under my visit list.

**Acceptance Criteria:**
- [ ] `DashboardServiceSchedulesWidget`: on mobile campo, show **only** if there are overdue or due-today schedules; otherwise omit section entirely
- [ ] `DashboardActivityFeed` hidden on mobile campo (desktop md+ may show collapsed or omitted — default: hidden in campo everywhere v1)
- [ ] Recordatorios still reachable via Más → sidebar → Recordatorios
- [ ] Typecheck/lint passes
- [ ] Verify in browser at mobile viewport: with no due schedules, only Hoy (+ optional summary) visible

### US-009: Page intro and breadcrumb copy for Hoy
**Description:** As a field technician, I want the top of the screen to say Hoy, not Dashboard.

**Acceptance Criteria:**
- [ ] `DashboardPageIntro` subtitle in campo: **“Tu día en el campo”** or **“Visitas y cobros de hoy”** — not “Resumen de tu operación”
- [ ] Breadcrumb / `TripledPageHeader`: mobile campo shows **Hoy** instead of **Dashboard** (desktop may keep Dashboard or Hoy — default: **Hoy** everywhere in campo)
- [ ] Greeting unchanged (Hola, {name})
- [ ] Typecheck/lint passes
- [ ] Verify in browser at mobile viewport: header copy matches field program

### US-010: Sidebar nav copy alignment
**Description:** As a user opening Más, I want sidebar labels to stay coherent with Hoy tab naming.

**Acceptance Criteria:**
- [ ] When campo: sidebar entry for `/dashboard` label **Hoy** (was **Inicio**); icon unchanged
- [ ] Office mode: sidebar keeps **Inicio**
- [ ] Tickets list remains **Tickets** in sidebar (not a tab in A0)
- [ ] System-only routes unchanged
- [ ] Typecheck/lint passes
- [ ] Verify in browser: Más sheet shows Hoy → `/dashboard` in campo

### US-011: Office dashboard unchanged for non-campo tenants
**Description:** As a multi-user office operator, I want the existing metrics dashboard so my workflow is not regressed.

**Acceptance Criteria:**
- [ ] `experience_mode === 'office'` (explicit or default for multi-user) renders existing `buildDashboardComposition` behavior
- [ ] Charts, KPIs, needs attention, quick actions, activity feed unchanged for office
- [ ] Onboarding checklist rules unchanged for office
- [ ] Typecheck/lint passes
- [ ] Verify in browser at desktop viewport: charts still render for office tenant

### US-012: Toggle vista oficina in Mi empresa (admin)
**Description:** As a tenant admin who later hires office staff, I want to switch back to the full dashboard.

**Acceptance Criteria:**
- [ ] Mi empresa (or Ajustes) section: **Experiencia** toggle or select — **Campo (técnico solo)** / **Oficina (equipo)**
- [ ] Requires `company.manage` (or equivalent)
- [ ] Saves `experience_mode` to company settings JSON
- [ ] Dashboard reflects change on next navigation without redeploy
- [ ] Copy explains: “Campo oculta gráficas y configuración inicial en Inicio; Oficina muestra el panel completo.”
- [ ] Typecheck/lint passes
- [ ] Verify in browser: toggle office → charts return on dashboard

### US-013: System and cross-tenant users exempt from campo auto-default
**Description:** As a system operator, I must not get a stripped dashboard when supporting tenants.

**Acceptance Criteria:**
- [ ] `company.is_system === true` OR session `company_is_system` with no tenant selected → never campo composition
- [ ] System user viewing a selected tenant uses **that tenant’s** `experience_mode`, not system auto-rules
- [ ] Typecheck/lint passes

### US-014: Session visibility refresh on campo home (lightweight)
**Description:** As a field technician on a long shift, I want the app to refresh my session when I return to the app without hitting an 8-hour wall mid-visit.

**Acceptance Criteria:**
- [ ] Reuse or implement visibility-based session refresh per [`prd-native-feel-session.md`](./prd-native-feel-session.md) US-001 when user lands on dashboard with campo mode
- [ ] No always-on polling on Hoy home
- [ ] `maxAge` 8h unchanged; no PIN/biometrics in this slice
- [ ] Typecheck/lint passes

### US-015: Unit and E2E coverage
**Description:** As a maintainer, I want regressions caught when office widgets leak into campo home.

**Acceptance Criteria:**
- [ ] Jest: `resolveExperienceMode`, campo composition, onboarding suppressed
- [ ] Playwright (mobile project): login as campo tenant → `/dashboard` shows `technician-day-widget`, does **not** show chart canvas/recharts container
- [ ] Playwright: office tenant still shows KPI/chart region (or skip if no seeded office fixture — document seed requirement)
- [ ] Typecheck/lint passes

### US-016: Release checklist line
**Description:** As a release owner validating before the customer returns, I want a explicit solo-mode smoke step.

**Acceptance Criteria:**
- [ ] `tasks/field-release-checklist.md` or `tasks/mobile-release-checklist.md` includes: campo tenant → Hoy-first home, no checklist, Anotar reachable
- [ ] Documents seed user / company with `experience_mode: 'campo'` or single-user auto-default

## Functional Requirements

- FR-1: **Experience mode** is stored in `Company.settings.experience_mode` (`'campo' | 'office'`); missing key participates in auto-default (FR-2).
- FR-2: **Auto-default**: unset + `totalUsers <= 1` + `activeUserCount <= 1` + non-system company ⇒ **`campo`**; otherwise **`office`**.
- FR-3: **Campo dashboard widgets (mobile `< md`)**: page intro → optional day summary strip → `DashboardTechnicianDayWidget` → conditional urgent schedules only → **no** charts, KPI grid, exports, activity feed, onboarding checklist, office quick actions.
- FR-4: **Campo dashboard (desktop `md+`)**: Hoy-first; may show compact day summary; **no** Recharts; optional single-row KPIs (entradas hoy, por cobrar) only — no month selector.
- FR-5: **Persona resolution**: `resolveDashboardPersona` still applies for permissions; campo composition **overrides widget list** when experience mode is campo (operator persona alone is insufficient — admins of solo shops still get campo if mode says so).
- FR-6: **Technician day queue** continues to use `technician-day-queue.ts` / `useTechnicianDayQueue`; no API contract change required for this slice.
- FR-7: **Navigation**: sidebar `/dashboard` label **Hoy** in campo; tab bar **Hoy** from A0 PRD when shipped.
- FR-8: **RBAC**: hiding UI does not remove permissions; Cobranza, Tickets, Servicios remain in Más/sidebar with existing gates.
- FR-9: **Performance**: do not mount `DashboardCharts` dynamic import when campo mobile; use composition gate before dynamic import.
- FR-10: **Copy catalog**: campo home strings live in one module (e.g. `campo-copy.ts`) for testability and future i18n — Spanish field terms per program decisions.
- FR-11: **Session**: optional client keep-alive on dashboard mount in campo only (FR-14 scope); does not extend JWT maxAge.
- FR-12: **Seed / concierge**: seed script or docs note for first customer company — set `experience_mode: 'campo'` explicitly for deterministic demos.

## Non-Goals

- Dedicated `/hoy` route (reuse `/dashboard` until traffic proves split needed)
- Offline queue, local drafts, or sync badges ([`prd-offline-first-jobs.md`](./prd-offline-first-jobs.md))
- One-screen **Anotar** capture ([`prd-job-capture-anotar.md`](./prd-job-capture-anotar.md))
- Bottom tab bar implementation ([`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md))
- PIN, biometrics, or multi-day “remember device” auth
- Removing RFC/readiness gates on ticket **create** (handled in capture/offline epics; solo mode only **hides** onboarding **checklist** on home)
- Hiding Cobranza, Presupuestos, Servicios, Users, Roles from sidebar — only demote from **home**
- Sites, equipos, PM checklists, WhatsApp send redesign
- Dark theme default / battery saver mode (follow-up epic)
- System operator console changes

## Design Considerations

- Visual priority: **one primary column** on mobile — day cards with 48px+ touch targets (existing technician card actions)
- Empty Hoy: friendly CTA to **Anotar**, not illustration-heavy SaaS empty state
- Day summary strip: notebook metaphor — big numbers, no chart junk
- Do not show production-blocked company wall on Hoy home; readiness banners belong on Mi empresa and Anotar flows
- Sunlight: rely on existing contrast tokens; avoid thin gray helper text for primary actions
- Terminology map (campo home):

  | Office (avoid on Hoy) | Campo (prefer) |
  |----------------------|----------------|
  | Dashboard | Hoy |
  | Ticket (heading) | Trabajo / visita |
  | Métricas / Desempeño | (hidden) |
  | Inicio rápido checklist | (hidden on home) |

## Technical Considerations

- **Key files to touch:**
  - `src/components/dashboard/dashboard-metrics-client.tsx` — branch on experience mode; gate chart/KPI mounts
  - `src/lib/dashboard-composition.ts` — extend or sibling `dashboard-campo-composition.ts`
  - `src/components/dashboard/dashboard-technician-day-widget.tsx` — copy props or `variant="campo"`
  - `src/app/(app)/dashboard/page.tsx` — pass experience mode / intro subtitle
  - `src/lib/company-schema.ts` / `CompanySettingsJson` — `experience_mode`
  - `src/lib/company-onboarding-checklist.ts` — respect campo in `shouldShowOnboardingChecklist`
  - `src/lib/nav-items.ts` — conditional sidebar title Hoy vs Inicio
  - `src/actions/dashboard.ts` or company loader — expose experience mode + user counts to client
- **Detection query:** count non-deleted users for company_id; cache per request on dashboard SSR
- **Client hydration:** pass `initialExperienceMode` from server to avoid flash of office charts (FOUC)
- **Testing:** extend `dashboard-composition.test.ts`; widget tests for `DashboardTechnicianDayWidget` empty copy; E2E mobile viewport
- **Feature flag alternative:** env `CAMPO_DEFAULT=1` for first-customer only deploy — prefer company settings for persistence

## Success Metrics

- Campo tenant on Android PWA: **≤ 1 scroll** to see first job card or empty Anotar CTA after login
- **0** Recharts/chart DOM nodes on mobile campo dashboard (automated E2E assertion)
- First customer (concierge): reports home shows “my day” not “graphs” (qualitative on return visit)
- Office tenants: no change in dashboard engagement metrics (no regression signal in support tickets)
- Median time from `/dashboard` paint to tapping Llamar/WhatsApp on a day card **≤ 5s** (manual timing on mid Android)

## Dependencies

- **Optional, non-blocking:** [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md) — Hoy tab label reinforces IA; solo mode can ship on current Inicio tab
- **Uses existing:** `DashboardTechnicianDayWidget`, `technician-day-queue.ts`, `dashboard-metrics-client.tsx`, company settings JSON
- **Informs later epics:** offline jobs and Anotar should read same `experience_mode` for consistent chrome hiding
- **Blocked by nothing** for implementation start; **pairs best with** A0 tabs before customer return

## Open Questions

| # | Question | Default for implementation |
|---|----------|----------------------------|
| OQ-1 | Rename widget title **Trabajo de hoy** → **Hoy** on card? | **Keep “Trabajo de hoy”** on card; page-level **Hoy** in header/tab |
| OQ-2 | Show compact KPI strip on mobile campo? | **Yes** — two chips max (entró hoy, por cobrar) |
| OQ-3 | Desktop campo: any charts at all? | **No Recharts**; optional two KPI cards only |
| OQ-4 | Auto-switch to office when second user invited? | **No auto-switch** — admin toggles explicitly; optional toast hint only |
| OQ-5 | Where does Experiencia toggle live? | **Mi empresa** bottom section **Experiencia de inicio** |
| OQ-6 | Session refresh in this slice or native-feel session PRD? | **Implement minimal visibility refresh** here if not already merged; else link issue |
| OQ-7 | Include `needsAttention` widget in campo? | **No** — day queue + por cobrar link covers urgency |
| OQ-8 | Platform home for system users? | **Unchanged** — never campo |

Until ride-along overrides, ship with these defaults.
