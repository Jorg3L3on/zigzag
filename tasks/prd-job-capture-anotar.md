# PRD: Job capture — Anotar (one-screen field default)

**Status:** 📋 Ready to implement — **Epic C, field program**  
**Program:** [`prd-field-program-decisions.md`](./prd-field-program-decisions.md)  
**Depends on:** [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md) (Anotar tab exists; href retarget when this ships)  
**Offline sync:** [`prd-offline-first-jobs.md`](./prd-offline-first-jobs.md) (Epic B — true offline queue; this epic ships **online-first**, then wires sync)  
**Discovery:** [`prd-first-customer-field-technician.md`](./prd-first-customer-field-technician.md) (O-02, O-03)  
**Office fallback (unchanged):** [`/tickets/create`](/dashboard/tickets/create) — 3-step wizard (Datos → Servicios → PDF)

## Introduction

Field technicians record jobs in **one notebook line**: *who, what I did, how much, what they paid*. ZigZag’s default capture path today is a **3-step ticket wizard** at `/tickets/create` (client shell → catalog service lines → finish/PDF) that requires network, company production readiness (RFC/address), and at least one catalog line before finish.

**Anotar** is a dedicated **one-screen** capture flow at **`/anotar`**: thumb-first, Spanish verbs, ~15 seconds to save. It becomes the **default** for field users (bottom tab **Anotar**, deep links from Hoy). The existing wizard remains for **office operators** who need full catalog control, presupuesto paths, and step-by-step PDF review.

This epic delivers the **online-first** UI and server path. Offline durability (save with zero network, sync queue) is specified here but **implemented in** `prd-offline-first-jobs.md`; Anotar must not block on offline work shipping first.

## Goals

- Replace the 3-step wizard as the **default capture** for field/mobile users with a single screen reachable in one tab tap
- Median **Anotar → Guardado** under **15 seconds** on a mid-range Android phone (online, warm client list)
- Capture fields: **who** (client typeahead or inline new), **work_notes** (free text), **amount**, **paid / partial / unpaid**, **optional** catalog service suggestions (never required)
- New route **`/anotar`**; when shipped, bottom tab **Anotar** href updates from `/tickets/create` to `/anotar` in **one config place** (`nav-items.ts`)
- **No RFC / company production readiness block** on Anotar save (field program Q13)
- Preserve **`/tickets/create`** as documented fallback for office users (sidebar + Más)
- Ship **online-first**; define hooks/contracts so Epic B can enqueue the same payload offline without UI rewrite

## User Stories

### US-001: `work_notes` on Ticket (schema + migration)
**Description:** As a developer, I need a durable free-text field on jobs so field narrative is the source of truth, not only catalog line descriptions.

**Acceptance Criteria:**
- [ ] Add nullable `work_notes` column to `Ticket` in `src/db/schema.ts` (`text`, no arbitrary low length cap in DB)
- [ ] Drizzle migration generated and applied locally
- [ ] Existing tickets remain valid (`work_notes` null)
- [ ] Typecheck/lint passes

### US-002: `anotarCapture` server action (single save)
**Description:** As a field technician, I want one **Guardar** action that creates and finishes a job so I never visit a second “Servicios” step.

**Acceptance Criteria:**
- [ ] New server action (e.g. `anotarCapture` in `src/actions/tickets.ts` or `src/actions/anotar.ts`) accepts: `client_id` **or** inline new-client payload, `work_notes`, `total`, `paid`, optional `service_line_ids` / suggested lines
- [ ] Action runs in one transaction: create ticket → attach line(s) if any → set `work_notes` → finish with server-authoritative total
- [ ] When **no** catalog lines selected, create exactly **one synthetic line** (e.g. description from truncated `work_notes` or fixed label “Trabajo”) so existing `finishTicket` invariants (≥1 active line) hold **or** shared finish helper is extracted and reused without duplicating money logic
- [ ] **Skips** `assertCompanyProductionReady` for this action only (campo capture); branded PDF may remain unavailable until profile complete — no hard block on save
- [ ] Tenant scoping: `company_id`, client belongs to company, soft-deleted clients rejected (reuse existing helpers)
- [ ] Records `TicketAuditEvent` for create + finish (or equivalent combined event documented in action)
- [ ] Returns `{ success, data: { ticketId, ... } }` with BigInt ids stringified at boundary
- [ ] Unit tests: happy path, paid > total rejected, cross-tenant client rejected, zero/negative amount rejected, empty `work_notes` allowed or rejected per FR-4
- [ ] Typecheck/lint passes

### US-003: `/anotar` page (mobile-first one screen)
**Description:** As a field technician, I want one screen to anotar a job so capture feels like writing one notebook line.

**Acceptance Criteria:**
- [ ] New route `src/app/(app)/anotar/page.tsx` (and layout with `tickets.write` page gate matching create)
- [ ] Single scrollable form — **no** `TripledStepper`, **no** step 2/3 navigation
- [ ] Fields visible above the fold on mobile (Pixel 5 / 390px width): **Cliente**, **Qué hice** (`work_notes`), **Total**, **Pagó** (paid amount or quick toggles)
- [ ] Primary sticky CTA: **Guardar** (uses `TripledMobileStickyActionBar`; bottom tabs hidden per existing chrome rules)
- [ ] Default `ticket_date` = today (hidden or compact; editable via “Más opciones” collapse, not required for v1 happy path)
- [ ] Success: toast + navigate to ticket detail **or** Hoy with new job surfaced (product default: **ticket detail** so user can share PDF/WhatsApp in Epic D)
- [ ] `CompanyProductionNotice` **not** shown as a blocking banner on `/anotar`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill (mobile viewport)

### US-004: Client typeahead + inline “Nuevo cliente”
**Description:** As a field technician, I want to pick an existing client quickly or add a new one without leaving Anotar.

**Acceptance Criteria:**
- [ ] Client field is **typeahead/combobox** (search by name, phone) not a long `Select` dropdown
- [ ] Debounced search against tenant-scoped clients (reuse `getClients` or add lightweight search action)
- [ ] **Nuevo cliente** opens inline sheet/dialog with minimal fields: **name** (required), **phone** (recommended, `type="tel"`), email optional
- [ ] On inline create success, client is selected and focus returns to **Qué hice**
- [ ] Support `?clientId=` query param (same as create) for deep links from Hoy / recordatorios
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Free-text `work_notes` (primary narrative)
**Description:** As a field technician, I want a large text area for what I did so I can write like my notebook.

**Acceptance Criteria:**
- [ ] Label copy: **Qué hice** (or **Notas del trabajo** — pick one in implementation, document in PR)
- [ ] `textarea`, `text-base` on mobile (no iOS zoom regression), min height ~4 lines, auto-grow optional
- [ ] Optional: placeholder with example (“Mini-split no enfría, recarga gas, $2,500”)
- [ ] Value persisted to `Ticket.work_notes` on save
- [ ] Shown on ticket detail for campo users (read-only block); office wizard tickets may leave field empty
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Amount and paid / partial / unpaid
**Description:** As a field technician, I want to enter total and what they paid now so saldo is obvious.

**Acceptance Criteria:**
- [ ] **Total** numeric input (money keypad friendly on mobile)
- [ ] **Pagó** numeric input defaulting to total when user taps **Pagado completo** quick action
- [ ] Quick chips or segmented control: **Pagado** | **Parcial** | **Pendiente** — sets `paid` to total, partial (focus paid field), or `0`
- [ ] Client cannot submit `paid > total` (inline validation + server rejection)
- [ ] Partial state shows computed **Queda: $X** inline
- [ ] Finished ticket reflects `total` and `paid` consistent with existing Cobranza semantics
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Optional catalog service suggestions (not required)
**Description:** As a field technician, I want suggested services from my catalog when they help, but I must never be forced to pick one.

**Acceptance Criteria:**
- [ ] Collapsible section **Servicios sugeridos** (collapsed by default)
- [ ] Shows frequently used or search-matched catalog services as tappable chips/cards; multi-select optional
- [ ] Selected services add real `services_tickets` lines with catalog price × qty 1; **total** remains user-entered unless product rule sums lines (default: **user total wins**, lines informational for PDF — document in FR-6)
- [ ] Saving with **zero** selected services succeeds (synthetic line path from US-002)
- [ ] No navigation to `/tickets/[id]/services` required
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-008: Retarget Anotar bottom tab to `/anotar`
**Description:** As a field technician, I want the Anotar tab to open the new one-screen flow.

**Acceptance Criteria:**
- [ ] `nav-items.ts`: Anotar tab `url` → `/anotar` (single source of truth)
- [ ] Active tab state includes `/anotar` and nested paths; **excludes** `/tickets/create` once retargeted (create remains in sidebar)
- [ ] `e2e/mobile-bottom-tabs.spec.ts` updated: Anotar → `/anotar`
- [ ] Typecheck/lint passes

### US-009: Office fallback link to full wizard
**Description:** As an office operator, I want the full ticket wizard when I need catalog precision or PDF step review.

**Acceptance Criteria:**
- [ ] On `/anotar`, discreet link **Creación completa (oficina)** → `/tickets/create` (visible on `md+` or under “Más opciones” on mobile — prefer **Más opciones** to avoid clutter)
- [ ] Sidebar **Tickets → Nuevo** (or equivalent) still points to `/tickets/create`
- [ ] README or in-app copy not required in v1; link label makes intent clear
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-010: Update deep links (optional pass)
**Description:** As a product owner, I want primary field CTAs to land on Anotar while office/dashboard widgets can keep create URLs until campo mode exists.

**Acceptance Criteria:**
- [ ] Document in PR which links change in v1 vs later (`dashboard-quick-actions`, schedule “crear ticket”, notification bell) — **default v1:** only bottom tab + any explicit “Anotar” CTAs on Hoy/solo-mode; **defer** bulk href migration if campo flag not yet shipped
- [ ] If Hoy/solo-mode PRD is merged first, its primary CTA → `/anotar`
- [ ] Typecheck/lint passes

### US-011: Draft persistence (online localStorage)
**Description:** As a field technician, I want my half-written anotación recovered if I accidentally leave the screen.

**Acceptance Criteria:**
- [ ] Reuse or extend `ticket-form-drafts` pattern with key scoped to `/anotar`
- [ ] Draft clears on successful save
- [ ] Does not replace offline queue (Epic B); localStorage is best-effort online-only
- [ ] Typecheck/lint passes

### US-012: RBAC and permissions
**Description:** As a viewer without write access, I must not open Anotar.

**Acceptance Criteria:**
- [ ] `/anotar` layout gates `tickets.write` same as `/tickets/create`
- [ ] E2E or unit coverage for direct URL denial (extend `ticket-write-page-access.test.ts`)
- [ ] Typecheck/lint passes

### US-013: Playwright — Anotar happy path (online)
**Description:** As a maintainer, I want E2E proof that one-screen capture works on mobile.

**Acceptance Criteria:**
- [ ] New or extended spec: mobile viewport, navigate to `/anotar`, select/create client, enter notes + total, save, assert ticket appears finished with correct total
- [ ] Runs in CI `mobile-chrome` project
- [ ] Typecheck/lint passes

### US-014: Offline integration contract (Epic B handoff)
**Description:** As a developer wiring offline jobs, I want Anotar’s payload shape stable so the sync queue does not duplicate business rules.

**Acceptance Criteria:**
- [ ] Export typed `AnotarCaptureInput` / payload schema shared by UI, server action, and (later) offline queue adapter
- [ ] UI submit handler calls single `submitAnotarCapture()` indirection that today invokes server action and tomorrow can write to local queue when offline
- [ ] When offline (Epic B): show **Guardado en el teléfono — se sube cuando haya señal**; no silent data loss
- [ ] Document contract in epic B PRD cross-link; **implementation of queue in Epic B**, not this epic
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: **`/anotar`** is the default capture route for the **Anotar** mobile bottom tab after this epic ships.
- FR-2: One-screen form fields (minimum): **client** (existing or new), **`work_notes`**, **`total`**, **`paid`**; **`ticket_date`** defaults to today.
- FR-3: **`anotarCapture`** (name may vary) performs create + finish atomically; server is authoritative on money; client-supplied totals on finish are ignored per existing integrity rules.
- FR-4: **`work_notes`** may be empty on save for v1 **or** require ≥1 non-whitespace character — **default: optional** (technician might only enter money + client); if empty, synthetic line description uses **“Trabajo”**.
- FR-5: **No** `assertCompanyProductionReady` on Anotar save; other ticket flows unchanged.
- FR-6: **Optional catalog lines:** if present, persist as normal `services_tickets`; **user-entered `total`** is persisted on finish unless implementation chooses to auto-sum lines — if both exist, **server validates** `total` equals sum of lines within tolerance **or** lines adjust to match total (pick one: **default validate sum = total when lines selected; when no lines, synthetic line price = total**).
- FR-7: **`/tickets/create`** remains available indefinitely as the **office / full wizard** fallback; not deprecated.
- FR-8: Anotar page **must not** use the 3-step stepper or redirect to `/tickets/[id]/services` on save.
- FR-9: Successful save produces a **finished** ticket (`finished = true`) with payment row semantics consistent with `finishTicket`.
- FR-10: All queries filter by `company_id` and `deleted_at IS NULL` per multi-tenant rules.
- FR-11: BigInt ticket ids converted for JSON/client boundaries via existing helpers.
- FR-12: Online v1 **requires network** for save; offline banner behavior unchanged; Epic B adds offline save without changing field layout.

## Non-Goals

- **True offline save and sync** (Epic B — `prd-offline-first-jobs.md`)
- Photos, voice notes, speech-to-text (later field epics)
- WhatsApp send / share PDF from Anotar success (Epic D — `prd-field-send-cobro.md`)
- Replacing or removing **`/tickets/create`** wizard
- Presupuesto / quote capture on `/anotar` (quotes stay on presupuestos flow)
- RFC, fiscal address, or readiness gates on save
- Forcing catalog service lines or service catalog setup before first job
- Sites, equipos, asset registry, PM checklists
- Campo vs office tab split (optional follow-up flag); v1 may retarget Anotar tab globally for first customer tenant
- Redesigning ticket detail / invoice PDF layout (show `work_notes` on detail is in scope; PDF template changes are optional follow-up)
- Auto-migrating every `href="/tickets/create"` in the codebase in v1 (documented incremental pass)

## Design Considerations

- **Language:** Spanish field labels — **Cliente**, **Qué hice**, **Total**, **Pagó**, **Guardar**; tab label stays **Anotar**.
- **Thumb zone:** Primary **Guardar** in sticky bottom bar; money fields large (`h-12`, `text-base` on mobile).
- **Density:** No dashboard chrome, no stepper, no card stack mimicking office wizard; one visual group.
- **Empty state:** First-time user sees placeholder example in `work_notes`, not onboarding checklist.
- **Errors:** Use existing toast + error catalog patterns; network errors surface retry-friendly copy.
- **Reuse:** `ClientForm` patterns, `TripledMobileStickyActionBar`, `TripledMobileAppBar` (title **Anotar**, back → Hoy `/dashboard` or `/hoy` when exists).
- **Accessibility:** Labels linked, validation `aria-describedby`, sticky CTA not obscured by keyboard (existing patterns).

## Technical Considerations

- **Existing create flow:** `src/app/(app)/tickets/create/page.tsx` — 3 steps (Datos → Servicios → PDF); uses `createTicket` then separate services + `finishTicket`. Anotar **must not** fork this UI.
- **Finish invariant:** `finishTicket` currently requires ≥1 active service line (`EmptyTicketFinishError`). Anotar action must satisfy this via synthetic line or shared finish refactor — prefer **one internal helper** to avoid duplicating advisory lock + payment insert logic.
- **Production guard:** `assertCompanyProductionReady` in `createTicket` — bypass only on Anotar action, not globally.
- **Nav:** `src/lib/nav-items.ts` — update Anotar tab href; `getLongestMatchingHref` for active state.
- **Drafts:** `src/lib/ticket-form-drafts.ts` — extend or parallel module for `/anotar`.
- **Tests:** `src/lib/tickets-actions.test.ts`, new `anotar-capture.test.ts`, `e2e/` mobile spec.
- **Permissions:** `PERMISSIONS.tickets.write` via existing page layout pattern.
- **Offline handoff:** Epic B consumes same zod schema; Serwist shell already caches app routes — `/anotar` included in shell once route exists.

## Success Metrics

- Median time **open Anotar tab → Guardado** ≤ **15 s** in timed ride-along (online, 20+ sample jobs)
- ≥ **80%** of new jobs from field tenant created via `/anotar` within 2 weeks of ship (vs `/tickets/create`)
- Zero production incidents of RFC/readiness blocking field save on Anotar path
- E2E mobile Anotar spec green in CI
- Support tickets mentioning “too many steps to create ticket” decrease after ship (qualitative first customer)

## Dependencies

| Dependency | Relationship |
|------------|--------------|
| [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md) | **Soft —** Anotar tab should exist (may still point at `/tickets/create` until this epic updates href) |
| [`prd-offline-first-jobs.md`](./prd-offline-first-jobs.md) | **Hard for offline; soft for v1 ship** — online-first UI ships without Epic B; Epic B wires queue to same payload |
| [`prd-technician-solo-mode.md`](./prd-technician-solo-mode.md) | **Optional parallel** — Hoy CTAs should target `/anotar` when both exist |
| [`prd-ticket-creation-integrity.md`](./prd-ticket-creation-integrity.md) | **Align** — Anotar must respect tenant/money integrity; may reuse hardened finish helpers as they land |
| [`prd-field-send-cobro.md`](./prd-field-send-cobro.md) | **Follow-on** — share/send after save from ticket detail |

## Implementation Phases

### Phase 1 — Online Anotar (this epic, shippable alone)

1. Schema: `work_notes`
2. Server: `anotarCapture` + tests
3. UI: `/anotar` page + client typeahead + money + optional suggestions
4. Nav: tab href → `/anotar`; E2E
5. Fallback link → `/tickets/create`

### Phase 2 — Offline wire-up (Epic B)

1. `submitAnotarCapture()` routes to local queue when offline
2. Background sync pushes to `anotarCapture`
3. Pending badge on Hoy / ticket list

## Open Questions

1. **Post-save navigation:** ticket detail vs Hoy list — **default: ticket detail** for immediate PDF/share in Epic D.
2. **Synthetic line label:** fixed **“Trabajo”** vs first line of `work_notes` — **default: truncate `work_notes` to column limit, else “Trabajo”.**
3. **Service suggestions default expanded?** **default: collapsed** to keep 15 s path clean.
4. **Require client always?** **default: yes** (name minimum for new); anonymous jobs deferred.
5. **Global tab retarget vs campo flag?** **default: global retarget** for first customer; campo flag in follow-up if office users complain.

## References

- Field locked decisions: [`prd-field-program-decisions.md`](./prd-field-program-decisions.md) (Q5, Q9, Q13, Q16)
- Current wizard (fallback): `/tickets/create` — `src/app/(app)/tickets/create/page.tsx`
- Bottom tab epic: [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md)
- Offline epic (future): `prd-offline-first-jobs.md`
