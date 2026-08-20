# PRD: Field program — Offline-first jobs (create / edit + sync)

**Status:** 📋 Ready to implement — **Epic B**  
**Integration branch:** `feat/offline-first-jobs`  
**Program:** [`prd-field-program-decisions.md`](./prd-field-program-decisions.md)  
**Supersedes write scope in:** [`prd-native-feel-offline-snapshots.md`](./prd-native-feel-offline-snapshots.md) (read-only snapshots remain complementary, not sufficient)  
**Parent discovery:** [`prd-first-customer-field-technician.md`](./prd-first-customer-field-technician.md)  
**Builds on:** [`prd-pwa-offline-shell.md`](./prd-pwa-offline-shell.md) (app shell + `NetworkStatusBanner`; data still network-only today)

## Introduction

The first field customer (solo electrical / HVAC / consultancy technician on Android) must **create and edit jobs with zero network** — a basement, roof, or hotel machine room cannot send him back to paper. Today ZigZag is installable as a PWA with an offline **app shell**, but **Ticket mutations go through Server Actions that require a live connection**. [`prd-native-feel-offline-snapshots.md`](./prd-native-feel-offline-snapshots.md) explicitly scoped **read-only** IndexedDB list snapshots and `localStorage` form drafts, not durable offline CRUD or a sync queue.

Program decision **Q3** in [`prd-field-program-decisions.md`](./prd-field-program-decisions.md) locks the opposite for the field track: **create + edit jobs offline** with a **sync queue when online**, **last-write-wins on a single phone**, **tenant-scoped local keys**, and **no service-worker caching of API JSON** (shell-only SW policy unchanged). Discovery PRD [`prd-first-customer-field-technician.md`](./prd-first-customer-field-technician.md) ranks offline capture as **P0 — replace the notebook** (H1, O-01).

This epic introduces a **local job store** (IndexedDB), an **outbox queue** for mutations, **sync status UI** in Spanish (`pendiente de subir`), and a **sync adapter** that pushes to existing Ticket Server Actions when connectivity returns — without pretending the server works offline or serving stale tenant data from the SW.

**In scope for v1:** offline create/edit of field jobs mapped to **Ticket** rows (who, notes, amount, paid, client references). **Out of scope for v1:** offline PDF generation, multi-device CRDT, photo/audio queues (later epics), Sites/Assets.

---

## Goals

- Persist **field jobs locally** in IndexedDB so create/edit survives airplane mode, process death, and PWA cold start (after at least one authenticated online session).
- Queue **create and update** operations in a durable **outbox**; flush automatically when online and on explicit user retry.
- Show clear **sync status** on each job and globally (`pendiente de subir`, `subiendo…`, `subido`, `error al subir`).
- Apply **last-write-wins** conflict policy for **one primary phone** per technician (no merge UI in v1).
- **Integrate with existing Ticket Server Actions** when online (`createTicket`, `updateTicket`, `finishTicket`, payment helpers as needed) via a sync adapter — no duplicate REST mutation routes.
- Enforce **tenant isolation** in all local keys and sync payloads (`company_id` + session user scope).
- Keep **service worker policy unchanged**: NetworkOnly for `/api/**`, RSC, and Server Action POSTs; no cached tenant JSON.
- Add **Playwright offline E2E** proving offline create → local persist → online sync → server-visible job.

---

## User Stories

### US-001: Local job model in IndexedDB
**Description:** As a field technician, I want jobs saved on my phone with who, notes, amount, and payment info so I can work without signal.

**Acceptance Criteria:**
- [ ] IndexedDB database `zigzag-field` (name TBD in implementation) with versioned schema
- [ ] `LocalJob` record includes at minimum:
  - `localId` (UUID, stable on device)
  - `companyId` (number, required)
  - `userId` (string/BigInt string, creator)
  - **Who:** `clientId` (optional server id), `clientName`, `clientTel` (required for create per current ticket rules)
  - **Notes:** `workNotes` (string, long text — field narrative; maps to server on sync)
  - **Money:** `total` (number), `paid` (number), derived `balanceDue` for UI only
  - **Refs:** `ticketDate` (ISO date), optional `serverTicketId` (bigint string after first successful sync)
  - **Sync meta:** `syncStatus`, `syncError` (user-safe Spanish), `localUpdatedAt`, `serverUpdatedAt` (when known), `outboxSeq`
- [ ] Optional v1 fields allowed but not required: `email`, `finished` flag
- [ ] Jobs scoped by `companyId`; switching company context (system user or `company-context`) shows only that tenant’s local jobs
- [ ] Typecheck/lint passes

### US-002: Offline create job
**Description:** As a field technician offline on Anotar, I want to save a new job immediately so I trust the app like a notebook.

**Acceptance Criteria:**
- [ ] When `navigator.onLine === false` (or Server Action fails with network error), save path writes to IndexedDB instead of calling Server Actions
- [ ] Save succeeds locally with toast: **“Guardado en el teléfono”** (not a fake “subido” success)
- [ ] New job appears in local **Hoy** / job list with badge **“Pendiente de subir”**
- [ ] Required fields for local save match field capture minimum: client name, phone, work notes (may be empty string if product allows — align with Anotar epic), total ≥ 0
- [ ] No RFC, service catalog, or company production-readiness gate blocks local save (program Q13)
- [ ] Typecheck/lint passes
- [ ] Verify in browser: airplane mode create on `/tickets/create` (or `/anotar` when it exists)

### US-003: Offline edit job
**Description:** As a field technician, I want to edit a job I created offline (or previously synced) while still offline.

**Acceptance Criteria:**
- [ ] Edit updates `LocalJob` in IndexedDB and enqueues outbox operation (`update` or coalesced `upsert`)
- [ ] Jobs with `serverTicketId` record pending changes without mutating server until sync
- [ ] Last local edit wins over prior local state (single device)
- [ ] UI shows **“Pendiente de subir”** after edit until sync completes
- [ ] Typecheck/lint passes
- [ ] Verify in browser: edit offline job, reload page, values restored from IndexedDB

### US-004: Outbox queue
**Description:** As a developer, I want a durable outbox so mutations are not lost if the app closes mid-sync.

**Acceptance Criteria:**
- [ ] Outbox store (same DB or separate object store) with entries: `id`, `companyId`, `localJobId`, `operation` (`create` | `update`), `payloadSnapshot`, `createdAt`, `attempts`, `lastAttemptAt`, `lastError`
- [ ] Coalesce multiple pending updates for the same `localJobId` into one outbound payload (last-write-wins)
- [ ] Outbox processed **FIFO per company** when online
- [ ] Failed entries remain with incremented `attempts`; user can retry manually
- [ ] Successful sync removes or marks completed outbox entries
- [ ] Typecheck/lint passes

### US-005: Sync when online
**Description:** As a field technician, I want my phone to upload pending jobs when I have signal without retyping them.

**Acceptance Criteria:**
- [ ] On `online` event and on app foreground (visibility change), sync runner attempts to drain outbox if session is valid
- [ ] **Create path:** sync adapter calls `createTicket` with mapped fields, then applies amount/paid via established ticket financial actions (`updateTicket` / `finishTicket` / payment recording — implementation chooses minimal sequence documented in PR)
- [ ] **Update path:** sync adapter calls `updateTicket` (and payment delta helpers if `paid` changed) for `serverTicketId`
- [ ] `workNotes` maps to server field agreed in implementation (v1 default: `Ticket.work_notes` when Epic C shipped, else `Ticket.document` and/or single synthetic service line titled “Trabajo de campo” — document mapping in PR)
- [ ] On success: store `serverTicketId`, set `syncStatus: synced`, clear `syncError`, update `serverUpdatedAt`
- [ ] On recoverable failure: `syncStatus: error`, Spanish message, keep local truth; user can tap **“Reintentar subida”**
- [ ] Sync does not run for logged-out users
- [ ] Typecheck/lint passes

### US-006: Sync status UI
**Description:** As a field technician, I want to see which jobs are still only on my phone.

**Acceptance Criteria:**
- [ ] Job cards / detail show badge states:
  - **Pendiente de subir** — local changes not yet on server
  - **Subiendo…** — active sync for this job
  - **Subido** — synced (badge may hide when clean)
  - **Error al subir** — with short reason + retry action
- [ ] Global indicator when any job pending (e.g. count in Hoy header or banner adjunct — must not duplicate/conflict with `NetworkStatusBanner`)
- [ ] Copy is Spanish; no raw error codes (`TC001`, `GN002`) as primary text
- [ ] Offline banner still explains connectivity; sync badge explains upload state
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Conflict policy (single phone, last-write-wins)
**Description:** As a product owner, I want a simple conflict rule for one technician phone without merge UI.

**Acceptance Criteria:**
- [ ] **Device-local:** last edit to a `LocalJob` wins
- [ ] **Server vs device (v1):** if server row `updated_at` is newer than last successful sync snapshot **and** local has pending changes, **local pending wins** on next sync (overwrite server) — logged in audit via normal ticket update; no CRDT
- [ ] Document assumption: **one primary phone**; spouse/web edits are rare; if detected, show non-blocking warning after sync: **“Este trabajo se actualizó en otro lugar. Se guardó la versión del teléfono.”**
- [ ] No offline edits to jobs deleted on server until online reconcile marks local copy **“Eliminado en la nube”** (read-only archive or soft-hide — pick one in PR)
- [ ] Typecheck/lint passes

### US-008: Read path — local + server merge for lists
**Description:** As a field technician, I want Hoy and job lists to show today’s work including offline-only jobs.

**Acceptance Criteria:**
- [ ] List queries merge server tickets (when online) with local jobs where `syncStatus !== synced` or `serverTicketId` missing
- [ ] Dedupe by `serverTicketId` when synced
- [ ] Offline-only: list renders from IndexedDB without network
- [ ] Optional: retain read-only snapshots from native-feel epic as fallback for **historical** server lists when offline — not a substitute for local jobs
- [ ] Typecheck/lint passes

### US-009: Security and tenant scoping
**Description:** As a security reviewer, I want offline data isolated per company and never synced to the wrong tenant.

**Acceptance Criteria:**
- [ ] All IndexedDB keys / indexes include `companyId` (and schema version)
- [ ] Sync adapter always passes `company_id` from session-selected company context, never from client-supplied hidden fields alone
- [ ] Clearing local data on logout (or on company switch for system users) — policy: **purge tenant keys** for previous company or entire DB on logout; document choice in PR
- [ ] No API JSON in service worker cache (regression test / code comment in `sw.ts`)
- [ ] IDOR rules unchanged on server; local store is not a bypass — sync still calls `requireTicketWrite`
- [ ] Typecheck/lint passes

### US-010: Playwright offline E2E
**Description:** As a maintainer, I want automated proof that offline create syncs after reconnect.

**Acceptance Criteria:**
- [ ] New spec e.g. `e2e/mobile-offline-jobs.spec.ts` on `mobile-chrome` project
- [ ] Flow: login online → navigate to Anotar → `context.setOffline(true)` → fill minimal job → save → assert **Pendiente de subir** → reload → assert data persists → `setOffline(false)` → trigger/wait for sync → assert server-backed list or detail shows job (network idle or poll Server Action result)
- [ ] Uses existing `e2e/helpers/auth.ts` skip pattern
- [ ] CI-stable (no arbitrary `waitForTimeout` without bound)
- [ ] Typecheck/lint passes

### US-011: Unit tests for sync adapter and store
**Description:** As a developer, I want Jest coverage for outbox coalescing, tenant keys, and sync mapping.

**Acceptance Criteria:**
- [ ] Tests for: outbox coalesce, local job CRUD, company-scoped queries, sync success/failure state transitions
- [ ] Mock Server Actions; do not require IndexedDB in Jest (use fake/idb mock or extracted pure functions)
- [ ] Typecheck/lint passes

### US-012: Documentation and release checklist
**Description:** As a release owner, I want docs to state offline **write** behavior accurately.

**Acceptance Criteria:**
- [ ] README Mobile & PWA section: shell offline + **local job capture** + sync queue (not full offline CRM)
- [ ] `tasks/mobile-release-checklist.md` or `tasks/field-release-checklist.md`: airplane-mode create/edit + sync smoke steps
- [ ] AGENTS.md: one line pointing to this PRD for field offline writes
- [ ] Typecheck/lint passes

---

## Functional Requirements

- **FR-1:** Local persistence MUST use **IndexedDB** (not `localStorage` alone) for job records and outbox; `localStorage` drafts may remain as ephemeral UX until save commits to IndexedDB.
- **FR-2:** Every `LocalJob` and outbox entry MUST include **`companyId`** matching session-selected tenant.
- **FR-3:** Offline save MUST NOT call Server Actions; online save MAY write through local store first (optimistic) or directly to server — implementation must not double-create; prefer **local-first write** for Anotar field flow.
- **FR-4:** Sync MUST use existing **`src/actions/tickets.ts`** mutations when online; no parallel `/api/tickets` CRUD.
- **FR-5:** Sync runner MUST be idempotent: retried `create` for same `localId` must not create duplicate server tickets (track `serverTicketId` after first success).
- **FR-6:** UI MUST distinguish **connectivity** (`NetworkStatusBanner`) from **upload queue** (`pendiente de subir`).
- **FR-7:** Field local save MUST NOT be blocked by **`assertCompanyProductionReady`** (program Q13); server may still enforce on non-field paths — sync adapter or field flag must align with solo-mode / Anotar epic.
- **FR-8:** Service worker MUST remain **NetworkOnly** for tenant data per `src/app/sw.ts` (or Serwist equivalent).
- **FR-9:** Logout MUST clear or invalidate local tenant data per security policy (FR in US-009).
- **FR-10:** Playwright offline job sync test MUST run in CI on `mobile-chrome`.
- **FR-11:** Schema version field on local DB for forward-compatible migrations/clears.
- **FR-12:** Soft-delete of tickets on server: local copy handling documented; v1 may hide from Hoy with status **“Eliminado”** after online reconcile.

---

## Non-Goals

- **Full CRDT / multi-device merge UI** — single phone, last-write-wins only
- **Offline PDF generation or invoice download** in v1 (defer to [`prd-field-send-cobro.md`](./prd-field-send-cobro.md) / share epic)
- **Offline Client CRUD sync** — v1 may reference `clientId` when known; creating clients offline is optional stretch, not required
- **Offline Service catalog edits**
- **Photo / audio attachment queue** (separate media epic)
- **Background Sync API as sole transport** — may be best-effort adjunct only (see Technical Considerations)
- **Caching API JSON or RSC payloads in the service worker**
- **Sites, equipos, checklists** (field program Q14)
- **Native Android app / Play Store packaging** (program Q2 — revisit only if PWA sync fails on device)
- **Replacing Server Actions with a new sync REST API**

---

## Design Considerations

- Visual language: notebook trust — **“Guardado en el teléfono”** feels success; **“Pendiente de subir”** is neutral, not alarming
- Badge placement: job list cards (mobile) and ticket detail header; avoid cluttering sticky save bar
- Retry: single obvious control **“Subir ahora”** in Más or sync status sheet when pending count > 0
- Empty offline state: **“No hay trabajos guardados. Anota el primero.”**
- Do not show “subido” toast until server confirms

---

## Technical Considerations

### IndexedDB vs Dexie

| Approach | Pros | Cons |
|----------|------|------|
| **Raw IndexedDB** + small wrapper | Zero dependency, matches native-feel offline PRD guidance | Boilerplate for indexes, migrations |
| **Dexie.js** | Schema versioning, queries, React hooks patterns | +~20KB gzip; team must learn Dexie API |

**Recommendation:** **Dexie** (or equivalent thin ORM) for `LocalJob`, outbox, and `companyId` indexes — unless bundle budget forbids; document choice in implementing PR. Either way, expose a **`FieldJobStore`** module so UI does not touch IDB directly.

### `FieldJobStore` module (required abstraction)

All UI and sync code MUST go through a single module, e.g. `src/lib/field-jobs/field-job-store.ts`:

- `saveLocalJob(job)` — create or update IndexedDB + enqueue outbox
- `getLocalJobs(companyId, filters)` — tenant-scoped queries
- `getOutboxPending(companyId)` — pending upload count
- `markSyncing(localId)` / `markSynced(localId, serverTicketId)` / `markSyncError(localId, message)`
- `purgeCompany(companyId)` / `purgeAll()` — logout / company switch
- Pure functions extracted for Jest (mapping, coalesce, dedupe)

UI hooks (`useFieldJobs`, `useSyncStatus`) wrap this module; components never open Dexie/IDB directly.

### Local schema (illustrative)

```
LocalJob {
  localId: string (uuid)
  companyId: number
  userId: string
  clientId?: number
  clientName: string
  clientTel: string
  workNotes: string
  total: number
  paid: number
  ticketDate: string (ISO date)
  serverTicketId?: string
  syncStatus: 'local-only' | 'pending' | 'syncing' | 'synced' | 'error'
  syncError?: string
  localUpdatedAt: string
  lastSyncedAt?: string
  schemaVersion: number
}

OutboxEntry {
  id: string
  companyId: number
  localJobId: string
  operation: 'create' | 'update'
  payload: object (snapshot)
  createdAt: string
  attempts: number
}
```

### Sync adapter ↔ Server Actions

1. **Create:** `createTicket({ client_name, client_tel, client_id?, ticket_date, company_id, document: workNotes })` → obtain `id` → set total/paid via `updateTicket` and/or `finishTicket` with a **single placeholder service line** if server requires lines to finish (document in PR; may need seeded “Trabajo general” service per company or field-mode bypass — coordinate with [`prd-job-capture-anotar.md`](./prd-job-capture-anotar.md)).
2. **Update:** `updateTicket(serverId, { ...fields, company_id })` + payment delta if needed.
3. **Audit:** rely on existing `TicketAuditEvent` recording from server actions post-sync.
4. **Preferred sync target after Epic C:** `anotarCapture` with same payload shape as Anotar UI when job originated from field capture.

### Background Sync limitations (Android PWA)

- **`sync` event / Periodic Background Sync** is **unreliable** when the PWA is not installed, when Chrome kills the SW, or on OEM battery savers — **do not depend on it alone**.
- **Primary flush triggers:** `window.online` event, `document.visibilitychange` → visible, manual **“Subir ahora”**, and optional **`navigator.serviceWorker.ready` + one-shot Background Sync** as enhancement when `registration.sync.register('zigzag-outbox')` is supported.
- **Session:** sync requires valid JWT/session; if expired, queue stays pending until re-auth (pairs with [`prd-native-feel-session.md`](./prd-native-feel-session.md) / solo-mode long-lived device auth).
- **Battery:** defer non-urgent flush on low battery optional (P2); v1 may sync immediately on online for simplicity.

### Relationship to read-only snapshots

[`prd-native-feel-offline-snapshots.md`](./prd-native-feel-offline-snapshots.md) may still ship **read-only list snapshots** for historical server data when offline. **This epic owns writable jobs.** Snapshots must not imply unsynced local jobs are on the server.

### Files likely touched (non-exhaustive)

| Area | Path / module |
|------|----------------|
| Local store | `src/lib/field-jobs/` (new) — `FieldJobStore`, types, outbox, sync-runner |
| UI hooks | `src/hooks/use-field-jobs.ts`, sync badge components |
| Anotar / ticket create | `src/app/.../tickets/create`, future `/anotar` |
| Hoy list merge | dashboard technician widgets, tickets list cards |
| SW policy | `src/app/sw.ts` — verify NetworkOnly unchanged |
| E2E | `e2e/mobile-offline-jobs.spec.ts` |
| Tests | `src/lib/field-jobs/*.test.ts` |

### Branch convention

Implement on **`feat/offline-first-jobs`**; slice PRs merge to feature branch; one PR **`feat/offline-first-jobs` → `main`** when epic ships ([`docs/agents/deployment.md`](../docs/agents/deployment.md)).

---

## Dependencies

| Dependency | Relationship |
|------------|--------------|
| [`prd-pwa-offline-shell.md`](./prd-pwa-offline-shell.md) | **Required** — shell + banner shipped |
| [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md) | **Recommended before or parallel** — Anotar tab reaches create flow |
| [`prd-field-program-decisions.md`](./prd-field-program-decisions.md) | **Required** — Q3 offline scope, Q13 fiscal gates |
| [`prd-first-customer-field-technician.md`](./prd-first-customer-field-technician.md) | **Reference** — discovery north star, H1 offline hypothesis |
| `prd-technician-solo-mode.md` | **Optional but paired** — Hoy-first lists, hide SaaS chrome, long-lived session; offline jobs can ship before solo mode if Anotar uses local store |
| [`prd-job-capture-anotar.md`](./prd-job-capture-anotar.md) | **Follows or overlaps** — dedicated `/anotar` should use same `FieldJobStore`; epic B can start on `/tickets/create` |
| [`prd-native-feel-offline-snapshots.md`](./prd-native-feel-offline-snapshots.md) | **Complementary** — read-only snapshots optional |
| Server: ticket financial rules | `finishTicket` requires service lines today — sync adapter may need field-mode placeholder service (coordination issue) |

**Program order (Epic B):** after bottom tabs + optional solo mode; **before or parallel with** Anotar UX epic (Epic C).

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Offline create → reload → data still present | **100%** in manual field test matrix (airplane mode, process kill) |
| Offline create → online sync → job visible on server | **100%** in Playwright E2E + manual smoke |
| Duplicate server tickets from retry | **0** in E2E and soak test |
| Wrong-tenant local read after company switch | **0** (QA checklist) |
| Median time offline save feedback | **< 300 ms** perceived (local write only) |
| User-visible sync state | Every unsynced job shows **Pendiente de subir** within one navigation |
| Production SW regression | No cached `/api` responses (existing policy tests pass) |

**Qualitative (first customer):** After concierge install, technician records ≥1 real job fully offline in the field and sees it on server that evening without re-entry.

---

## Open Questions

1. **workNotes → server mapping:** `Ticket.work_notes` (Epic C) vs `Ticket.document` only — default v1: prefer `work_notes` when column exists, else `document` + synthetic service line label from first line of notes.
2. **Placeholder service:** seed global “Trabajo de campo” per company vs relax `finishTicket` empty-lines check for field-sync origin (prefer minimal server change — decide in implementing PR).
3. **Offline client create:** allow `clientName`/`clientTel` only locally and `createClient` on sync, or require picking existing client when online at least once?
4. **Purge policy on logout:** wipe entire IndexedDB vs per-`companyId` store delete.
5. **Dexie vs raw IDB:** bundle budget sign-off.

Until ride-along overrides, **offline capture (program Q3) remains the design driver**; conflict UI stays minimal (single phone).

---

## Out of Scope (explicit v1 boundary)

- Offline presupuestos / quote documents
- Multi-user concurrent edit on same ticket
- Full offline Cobranza queue (read local `paid`/`total` only; collection reminders stay online)
- iOS-specific Background Sync behavior (test Android PWA first)
