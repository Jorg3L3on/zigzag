# PRD: Field program — Send & Cobro (WhatsApp, receipts, Hoy surfacing)

**Status:** 📋 Ready to implement — **Epic D**  
**Program:** [`prd-field-program-decisions.md`](./prd-field-program-decisions.md)  
**Parent discovery:** [`prd-first-customer-field-technician.md`](./prd-first-customer-field-technician.md)  
**Depends on:** [`prd-offline-first-jobs.md`](./prd-offline-first-jobs.md) (job model + sync), [`prd-job-capture-anotar.md`](./prd-job-capture-anotar.md) (job cards / `/anotar`)  
**Pairs with:** [`prd-technician-solo-mode.md`](./prd-technician-solo-mode.md) (Hoy-first home), [`prd-native-feel-share-pdf.md`](./prd-native-feel-share-pdf.md) (PDF share helper — largely shipped)

## Introduction

The first field customer lives in **WhatsApp**. Quotes, “voy en camino,” saldo reminders, and receipts already happen in chat — not in `/cobranza` or ticket detail PDF buttons buried three taps deep.

ZigZag already has the plumbing:

- **`src/lib/whatsapp-share.ts`** — `buildWhatsAppBalanceShare`, `buildWhatsAppVisitMessage`, `buildWhatsAppDayVisitShare` (`wa.me` deep links, no Business API)
- **`src/lib/ticket-invoice-download.ts`** + **`PDFDownloadButton`** — fetch server PDF, Web Share sheet when online
- **`CobranzaList`** + **`CobranzaWhatsAppButton`** — office-style cobranza queue with per-row WhatsApp saldo
- **`DashboardTechnicianDayWidget`** — “Trabajo de hoy” cards with a single generic WhatsApp button (day visit only)

This epic makes **Enviar** and **Cobrar** first-class on **job cards** (Hoy queue, Anotar result, finished jobs) and surfaces **who still owes** on **Hoy** instead of hiding cobranza behind **Más**. When the network is available, share the branded PDF via the existing invoice pipeline. When it is not, generate a **simple offline receipt** (plain text via WhatsApp and/or an on-device image) so the technician can show proof before sync.

**Mental model for Don:** one card per job → tap **WhatsApp** → pick what to send (visita, recibo, saldo, presupuesto) → done. Cobro owed money is visible on **Hoy**, not a separate office module he must remember.

---

## Goals

- **WhatsApp as the primary send button** on field job cards (not a buried row action on ticket detail)
- **Four message types** from one entry point: visita / en camino, saldo reminder, presupuesto (quote text), recibo (PDF when online)
- **Reuse existing helpers** — extend `whatsapp-share.ts` and `ticket-invoice-download.ts`; do not fork PDF fetch or `wa.me` encoding
- **Offline receipt v1** — plain-text recibo and/or simple image receipt when `navigator.onLine === false` or PDF fetch fails for network reasons; no server round-trip required
- **Cobranza on Hoy** — overdue/partial balances visible in the technician home queue with one-tap WhatsApp saldo and **Cobrar**; full `CobranzaList` remains for office/helper use via **Más**
- **Spanish field copy** — “Enviar,” “Recibo,” “Saldo,” “Presupuesto,” “Voy en camino”; no error codes as headlines
- **No WhatsApp Business API** — client-initiated `wa.me` + Web Share only

---

## User Stories

### US-001: Unified WhatsApp send menu on job cards
**Description:** As a field technician, I want one **WhatsApp** button on each job card that opens send options so I do not hunt different screens for visita, saldo, quote, or recibo.

**Acceptance Criteria:**
- [ ] Job cards on **Hoy** (`DashboardTechnicianDayWidget` or successor **JobCard** component) expose a primary **WhatsApp** / **Enviar** control (not only “visita de hoy”)
- [ ] Tapping opens a bottom sheet or action menu (mobile-first) with options contextual to job state:
  - **Voy en camino / Visita** — uses `buildWhatsAppDayVisitShare` (today’s visit) or `buildWhatsAppVisitShare` (scheduled PM) when applicable
  - **Recordar saldo** — when `balanceDue > 0` and ticket finished; uses `buildWhatsAppBalanceShare`
  - **Enviar presupuesto** — when `document_kind === 'presupuesto'`; new `buildWhatsAppQuoteShare` (see US-004)
  - **Enviar recibo** — when ticket finished; online path uses PDF (US-003); offline path uses simple receipt (US-005)
- [ ] Options without a valid client phone are hidden or disabled with helper text: “Agrega un teléfono al cliente”
- [ ] Each option opens `wa.me` in a new tab/window or triggers Web Share (PDF / image) — user gesture only
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill (mobile viewport, Android-like share when available)

### US-002: Visit and en-camino messages from Hoy cards
**Description:** As a field technician, I want to send “estoy en camino” or a visit reminder from today’s job card so hotels and houses know I am coming.

**Acceptance Criteria:**
- [ ] Unfinished jobs on Hoy offer **Voy en camino** using `buildWhatsAppDayVisitMessage` / `buildWhatsAppDayVisitShare`
- [ ] Scheduled PM rows (when surfaced on Hoy from recordatorios epic) may use `buildWhatsAppVisitMessage` with `nextDueAt` + service name
- [ ] Message includes company name when available (existing helper behavior)
- [ ] Replaces or subsumes the current single-purpose WhatsApp button on `TechnicianDayCard` that only sends day-visit copy
- [ ] Typecheck/lint passes

### US-003: Share PDF recibo when online
**Description:** As a field technician with signal, I want to send the branded ticket PDF through the phone’s share sheet (WhatsApp, Files) from the job card.

**Acceptance Criteria:**
- [ ] **Enviar recibo (PDF)** calls `fetchAndDeliverTicketInvoice` from `src/lib/ticket-invoice-download.ts` with correct `ticketId`, `companyId`, and download filename convention
- [ ] On success with `navigator.canShare` + file support, opens system share sheet (same behavior as `PDFDownloadButton`)
- [ ] On share unsupported, falls back to download (existing behavior)
- [ ] Only offered for **finished** work tickets (`document_kind === 'ticket'`, `finished === true`); presupuestos use quote text path (US-004)
- [ ] Loading state on menu item (“Generando recibo…”) and user-facing errors via `presentActionError` / `PDF001` on timeout — not raw codes in the title
- [ ] Reuses `PDFDownloadButton` logic or a thin shared wrapper; no duplicate fetch/share implementation
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: WhatsApp presupuesto (quote text)
**Description:** As a field technician, I want to send a plain-language quote on WhatsApp from a presupuesto job card so I can close deals from the site without opening the office Presupuestos list.

**Acceptance Criteria:**
- [ ] Add `buildWhatsAppQuoteMessage` + `buildWhatsAppQuoteShare` to `src/lib/whatsapp-share.ts` (or colocated module imported by share menu)
- [ ] Message includes: company intro, client name, presupuesto/ticket id, total (`formatTicketListAmount`), optional short services summary (first N line names), validity hint if `valid_until` exists on presupuesto
- [ ] Spanish copy example tone: “Te enviamos el presupuesto #123 por $X para [servicios]. ¿Te confirmamos?”
- [ ] Menu shows **Enviar presupuesto** only for mutable presupuestos (`isPresupuestoTicket` + `isPresupuestoMutable`)
- [ ] Unit tests in `whatsapp-share.test.ts` for quote message formatting
- [ ] Typecheck/lint passes

### US-005: Simple offline receipt (text + optional image)
**Description:** As a field technician with no signal, I want to send or show a simple receipt immediately so the customer has proof before the server PDF exists.

**Acceptance Criteria:**
- [ ] When offline (`!navigator.onLine`) or PDF fetch fails with a network-classified error, **Enviar recibo** offers **Recibo simple** instead of blocking
- [ ] **Text path:** build a plain-text recibo (client, date, work summary, total, paid, saldo, ticket/job id, company name) and open `wa.me` with that body via `buildWhatsAppHref`
- [ ] **Image path (v1):** generate a lightweight receipt image on-device (canvas or existing renderer stub) with the same fields; share via `navigator.share({ files })` when supported, else copy/save fallback
- [ ] Offline receipt does **not** require RFC, production readiness, or synced server ticket — uses **local job snapshot** from offline job model when ticket id is still pending sync (display local id / “pendiente de subir”)
- [ ] After sync, PDF path (US-003) becomes available for the same job without duplicate UX
- [ ] Copy explains: “Sin internet — recibo simple. El PDF oficial se envía cuando haya señal.”
- [ ] Typecheck/lint passes
- [ ] Manual test: airplane mode → finish job → Enviar recibo → text or image share works

### US-006: Saldo reminder from job card and cobranza row
**Description:** As a field technician, I want to WhatsApp a saldo reminder from the job card or cobranza context so collection happens in the same chat thread as the job.

**Acceptance Criteria:**
- [ ] Finished jobs with `balanceDue > 0` show **Recordar saldo** in send menu using `buildWhatsAppBalanceShare` (same message as `CobranzaWhatsAppButton`)
- [ ] `CobranzaWhatsAppButton` remains on `CobranzaList` — behavior unchanged; job card path is additive for field UX
- [ ] Saldo message includes ticket id, client name, balance, company intro (existing helper)
- [ ] Typecheck/lint passes

### US-007: Cobranza surfaced on Hoy (not buried in Más)
**Description:** As a field technician, I want to see who owes me money on **Hoy** so I do not forget hotel payments without opening a separate Cobranza page.

**Acceptance Criteria:**
- [ ] Hoy home (`/dashboard` campo mode) includes a **Por cobrar** section above or beside “Trabajo de hoy” when there are finished tickets with `balanceDue > 0`
- [ ] Section shows top N rows (e.g. 5) sorted by urgency: partial first, then oldest ticket_date, highest balance — reuse `summarizeCobranzaRows` / `CobranzaRow` shape from `src/lib/cobranza.ts`
- [ ] Each row: client name, saldo, aging hint; actions: **WhatsApp** (saldo), **Cobrar** (collect dialog), **Ver** (ticket detail)
- [ ] Header link **Ver toda la cobranza** → `/cobranza` (full `CobranzaList` unchanged)
- [ ] Empty state omitted when nothing owed (no noise)
- [ ] Section visible without opening **Más** sidebar; counts also reflected in Hoy header chip (e.g. “3 por cobrar”)
- [ ] Does not duplicate full `CobranzaFilterBar` on Hoy — filters stay on `/cobranza`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-008: Cobrar from Hoy job and cobranza cards
**Description:** As a field technician, I want to register a payment from the Hoy cobranza strip or finished job card so I do not navigate to ticket detail #cobranza.

**Acceptance Criteria:**
- [ ] **Cobrar** opens existing `TicketListCollectPaymentDialog` with ticket id, total, paid, companyId
- [ ] On success, local Hoy cobranza strip and job card saldo update without full page reload (optimistic or refetch)
- [ ] Same validation as ticket list collect (amount > 0, not above balance)
- [ ] Typecheck/lint passes

### US-009: Send actions after Anotar save
**Description:** As a field technician who just saved a job in Anotar, I want an immediate **Enviar** prompt so proof goes out while I am still with the customer.

**Acceptance Criteria:**
- [ ] After successful save on `/anotar` (or `/tickets/create` until Anotar ships), show success state with **Enviar por WhatsApp** using the same send menu component as Hoy job cards
- [ ] If job marked finished + paid in full, default highlight **Enviar recibo**; if presupuesto, highlight **Enviar presupuesto**; if balance due, highlight **Recordar saldo** or **Recibo** as appropriate
- [ ] Dismissible — user can tap **Listo** to return to Hoy
- [ ] Typecheck/lint passes

### US-010: Shared JobCard component and send menu module
**Description:** As a developer, I want one job card + send menu used by Hoy, Anotar success, and offline queue so WhatsApp behavior does not drift.

**Acceptance Criteria:**
- [ ] Extract `JobCard` (or `FieldJobCard`) + `JobWhatsAppSendMenu` under `src/components/field/` (or `jobs/`)
- [ ] Props accept unified **job snapshot** type from offline job model (local id, server id when synced, client tel/name, totals, document_kind, finished, work notes summary)
- [ ] `DashboardTechnicianDayWidget` migrates to `JobCard` or wraps it without losing `data-testid="technician-day-widget"`
- [ ] Typecheck/lint passes

### US-011: Network-aware send behavior
**Description:** As a field technician, I want the app to choose PDF vs recibo simple automatically so I am not asked to retry a dead network PDF.

**Acceptance Criteria:**
- [ ] Send menu uses existing `classifyClientError` / `presentActionError` from `src/lib/network-awareness.ts`
- [ ] Online + finished ticket → PDF path first; on network failure, offer recibo simple without losing entered data
- [ ] Offline → skip PDF fetch; recibo simple only
- [ ] Banner/toast never shows `GN002` as primary message; use Spanish field copy
- [ ] Typecheck/lint passes

### US-012: Tests and E2E for field send & cobro
**Description:** As a maintainer, I want unit and Playwright coverage so WhatsApp helpers and Hoy cobranza surfacing do not regress.

**Acceptance Criteria:**
- [ ] Extend `whatsapp-share.test.ts` for quote + offline receipt text builders
- [ ] Unit test: send menu option visibility given job state (unfinished vs finished, presupuesto vs ticket, balanceDue, phone missing)
- [ ] E2E (mobile viewport): Hoy shows por cobrar strip when seed has unpaid finished ticket; WhatsApp link href contains encoded saldo text; send menu opens
- [ ] `npm test` and targeted `npm run test:e2e` pass

### US-013: Field release checklist
**Description:** As a release owner, I want return-day QA steps for send/cobro before the customer ride-along.

**Acceptance Criteria:**
- [ ] `tasks/field-release-checklist.md` (or `tasks/mobile-release-checklist.md`) includes: Enviar menu on Hoy card, offline recibo simple, PDF share online, por cobrar on Hoy, saldo WhatsApp from cobranza strip

---

## Functional Requirements

- **FR-1:** All WhatsApp text links MUST use `buildWhatsAppHref` / normalized phone from `src/lib/whatsapp-share.ts` — no ad-hoc `wa.me` strings in components.
- **FR-2:** PDF delivery MUST use `fetchAndDeliverTicketInvoice` from `src/lib/ticket-invoice-download.ts` for online recibo; authenticated `GET /api/tickets/[id]/invoice` unchanged.
- **FR-3:** Send menu MUST be user-gesture initiated only (tap); no background WhatsApp opens or auto-send.
- **FR-4:** Job card send actions MUST respect RBAC: read-only users see disabled/hidden write actions; collect requires ticket write permission (same as `canWriteTickets`).
- **FR-5:** Multi-tenant: all job/cobranza data scoped by `company_id` from session / selected company context; WhatsApp messages must not leak other tenants’ names.
- **FR-6:** Presupuestos excluded from cobranza rows (`isWorkTicket`) — quote send uses presupuesto path only; no saldo reminder on draft quotes without conversion.
- **FR-7:** Offline receipt MUST work from local job snapshot when server ticket id is absent; after sync, server id used in messages/PDF filename.
- **FR-8:** Hoy **Por cobrar** section MUST query the same cobranza semantics as `getCobranzaList` / `CobranzaRow` (finished tickets, balance due, exclude soft-deleted, exclude presupuestos).
- **FR-9:** Full **`CobranzaList`** page at `/cobranza` remains the canonical filtered queue; Hoy section is a **summary strip**, not a replacement.
- **FR-10:** CLABE / transfer details sharing (future) MUST NOT block this epic; optional follow-up in `whatsapp-share.ts`.
- **FR-11:** BigInt ticket ids converted to string before WhatsApp message body (consistent with `convertBigIntToString` conventions).
- **FR-12:** Accessibility: send menu items have discernible names; icon-only WhatsApp buttons keep `aria-label` with ticket/job id.

---

## Non-Goals

- **WhatsApp Business API**, Cloud API, message templates, or server-side message delivery
- WhatsApp bot as primary UI (see discovery PRD R-02)
- Email/SMS receipt delivery
- Changing invoice PDF layout/renderer (`fintech-invoice-renderer.ts`) beyond what existing PDF already shows
- CFDI / fiscal invoice over WhatsApp
- Auto-scheduling payment reminders or cron-driven WhatsApp
- Replacing **`CobranzaList`** or moving cobranza to its own bottom tab (stays under **Más** for full queue)
- Bluetooth thermal printing
- Sharing job photos in this epic (defer to `prd-job-media.md` — text/PDF/image receipt only here)
- Sites/equipos-specific message templates until sites epic exists

---

## Design Considerations

- **Primary verb on card:** **Enviar** or WhatsApp icon with green accent; secondary: **Cobrar**, **Llamar**, **Abrir**
- Send menu: bottom **Sheet** on mobile (`ListFilterBarShell` patterns); dropdown on desktop if same card appears in sidebar context
- **Por cobrar on Hoy:** compact cards matching technician day card visual language (rounded-xl, saldo prominent in tabular nums)
- Offline recibo image: monochrome, large type, company name + “RECIBO SIMPLE” header — readable in sun; not a mini clone of fintech PDF
- Do not surface SaaS paths (“Ir a Cobranza module”) in empty states — use “Nadie te debe” / “Todo cobrado”
- Spanish labels: **Enviar**, **Voy en camino**, **Recordar saldo**, **Enviar presupuesto**, **Enviar recibo**, **Recibo simple (sin internet)**

---

## Technical Considerations

### Existing modules (reuse, extend — do not rewrite)

| Module | Role in this epic |
|--------|-------------------|
| `src/lib/whatsapp-share.ts` | Balance, visit, day-visit; add quote + offline receipt text builders |
| `src/lib/ticket-invoice-download.ts` | Online PDF fetch → share/download |
| `src/components/pdf-download-button.tsx` | Reference UX for loading/error; wrap for send menu |
| `src/components/cobranza/cobranza-list.tsx` | Full queue unchanged |
| `src/components/cobranza/cobranza-whatsapp-button.tsx` | Pattern for saldo icon button |
| `src/lib/cobranza.ts` | Row shape, filters, summarize for Hoy strip |
| `src/actions/cobranza.ts` | `getCobranzaList` for Hoy data fetch |
| `src/components/dashboard/dashboard-technician-day-widget.tsx` | Migrate cards to shared JobCard + send menu |
| `src/lib/network-awareness.ts` | Offline vs server error classification |

### Job model dependency (offline + Anotar epics)

Send menu and offline receipt require a **client-side job snapshot** type (see `prd-offline-first-jobs.md`):

- Local id (`localJobId`) + optional synced `ticketId`
- `clientName`, `clientTel`, `workNotesSummary`, `total`, `paid`, `balanceDue`, `finished`, `document_kind`, `ticketDate`, `companyName`
- Pending-sync badge when `ticketId` null

Until offline epic lands, JobCard may accept server-fetched `TechnicianDayTicket` + `CobranzaRow` adapters; **US-005 offline receipt** is blocked for purely server-backed cards without local snapshot.

### Offline receipt image (v1 implementation sketch)

- Canvas 390×520px @2x or SVG → PNG blob → `File` for `navigator.share`
- Fields: company, client, date, description (truncated work notes), total, pagado, saldo, folio
- No external font CDN required — system stack or bundled Inter
- Store generator in `src/lib/offline-receipt.ts` with unit tests for text layout/truncation

### Performance / battery

- No polling for cobranza on Hoy; refetch on dashboard focus or pull-to-refresh (existing native-feel patterns)
- PDF fetch timeout remains 60s (`PDF_DOWNLOAD_TIMEOUT_MS`); do not increase for field

---

## Success Metrics

- Field technician sends ≥1 WhatsApp message (visita, saldo, quote, or recibo) from a **job card** without opening ticket detail (qualitative + event if analytics added later)
- Median taps from Hoy card to WhatsApp compose ≤ 2 (open menu → choose option)
- Offline recibo simple succeeds in airplane-mode manual test on Android Chrome PWA
- **Por cobrar** visible on Hoy when seed data has unpaid finished tickets; user reaches saldo WhatsApp without navigating **Más → Cobranza**
- Zero regression on `CobranzaList` and existing `CobranzaWhatsAppButton` behavior

---

## Dependencies

| Dependency | Why | Blocking? |
|------------|-----|-----------|
| [`prd-offline-first-jobs.md`](./prd-offline-first-jobs.md) | Local job snapshot, pending-sync ids, offline finish flow | **Partial** — online-only send/cobro (US-001–004, 006–008) can ship on server tickets; **US-005 offline receipt** and pending-sync copy need job model |
| [`prd-job-capture-anotar.md`](./prd-job-capture-anotar.md) | Job cards on `/anotar`, post-save Enviar prompt (US-009) | **Partial** — Hoy + dashboard path can ship first |
| [`prd-technician-solo-mode.md`](./prd-technician-solo-mode.md) | Hoy-first layout, demote metrics, campo copy | Soft — cobranza strip should land in solo-mode layout slot |
| [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md) | Hoy tab → `/dashboard` | Already specified |
| [`prd-native-feel-share-pdf.md`](./prd-native-feel-share-pdf.md) | PDF Web Share helper | **Done** — `ticket-invoice-download.ts` |
| PostgreSQL + existing Ticket/Payment/Cobranza server actions | Data for cobranza strip | Required |

**Suggested slice order within Epic D:**

1. Shared send menu + quote helper + Hoy card integration (online WhatsApp + PDF)
2. Hoy **Por cobrar** strip + collect from card
3. Offline recibo simple (after offline job model)
4. Anotar post-save Enviar (after `/anotar`)

---

## Open Questions

1. **Send menu default:** When multiple options apply (finished + saldo + online), which is pre-highlighted — **Recibo PDF** or **Recordar saldo**? **Default: Recibo if paid in full; Saldo if balance due; Presupuesto if quote.**
2. **Offline image vs text only for v1:** Ship both or text-first? **Default: text always; image when `canShare` files — same as PDF share fallback philosophy.**
3. **Hoy cobranza row limit:** Top 5 vs scrollable list? **Default: top 5 + Ver toda la cobranza.**
4. **Include CLABE in saldo WhatsApp message** when company has transfer details? **Default: defer — saldo message unchanged in v1.**
5. **Presupuesto PDF:** Share presupuesto PDF via same invoice endpoint or text-only v1? **Default: text-only v1 via US-004; PDF share follow-up if endpoint supports presupuesto kind.**

Validate items 1–2 on customer return ride-along (proof preference: photos vs PDF vs text).

---

## Relationship to discovery opportunities

| Discovery ID | This PRD |
|--------------|----------|
| O-12 WhatsApp as send button | US-001–004, US-006 |
| O-13 Share PDF / offline receipt | US-003, US-005 |
| O-14 Money / cobro visibility | US-007, US-008 |
| O-09 Home = Hoy | US-007 cobranza strip on Hoy |
| Program Q15 teach **Hoy / Anotar / Cobrar** | US-007–009, US-013 checklist |
