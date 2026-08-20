# Field program — locked product decisions (first customer)

**Status:** 📋 Reference — governs all `prd-field-*` and first-customer epics  
**Source:** [`prd-first-customer-field-technician.md`](./prd-first-customer-field-technician.md)  
**User unavailable:** First customer on vacation; these defaults stand until a ride-along overrides them.

Decisions from product planning (apply to field epics unless a later PRD explicitly supersedes).

| # | Question | Decision |
|---|----------|----------|
| Q1 | Primary user | **Solo field technician** (electrical / HVAC / consultancy); optional spouse/helper on web later |
| Q2 | Packaging | **PWA on Android first**; native Play Store app deferred unless offline sync fails on device |
| Q3 | Offline scope | **Create + edit jobs offline** with sync queue; single phone, last-write-wins; not read-only snapshots alone |
| Q4 | Home / default landing | **Hoy** (today’s work), not metrics dashboard — dashboard charts demoted or hidden in campo mode |
| Q5 | Capture default | **Anotar** one-screen flow; Service catalog optional; RFC not required to save a job |
| Q6 | Auth in the field | **Stay signed in on device** + optional PIN/biometrics; 8h JWT alone is insufficient for campo UX |
| Q7 | Mobile bottom tabs | **Hoy · Anotar · Clientes · Más** (see [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md)) |
| Q8 | Tab: Hoy | Label **Hoy**; route **`/dashboard`** until a dedicated `/hoy` exists; content = technician day queue first |
| Q9 | Tab: Anotar | Label **Anotar**; route **`/tickets/create`** until dedicated **`/anotar`** ships in job-capture epic |
| Q10 | Tab: Clientes | Unchanged — **`/clients`** |
| Q11 | Tab: Más | Opens **existing mobile sidebar sheet** (Cobranza, Recordatorios, Servicios, Mi empresa, admin) |
| Q12 | Desktop nav | **Sidebar unchanged** on `md+`; tabs are mobile-only |
| Q13 | Fiscal gates | **No RFC / readiness block** on Anotar save; branded PDF remains optional when profile complete |
| Q14 | Domain depth v1 | **No** Sites / equipos / PM checklists until ride-along; **yes** notes, photos, money, WhatsApp |
| Q15 | Return-day ritual | **Concierge**: install PWA icon, migrate notebook sample, teach **Hoy / Anotar / Cobrar** |
| Q16 | Implementation order | Program decisions → **bottom tabs + campo home** → offline jobs → Anotar UX → send/cobro |

## Relationship to native-feel PWA epic

[`prd-native-feel-bottom-tabs.md`](./prd-native-feel-bottom-tabs.md) shipped **Inicio · Tickets · Clientes · Más** for generic mobile polish. The **field program supersedes tab labels and destinations** for the first-customer track:

| Native-feel (generic) | Field program (first customer) |
|-----------------------|--------------------------------|
| Inicio → `/dashboard` | **Hoy** → `/dashboard` (Hoy-first content) |
| Tickets → `/tickets` | **Anotar** → `/tickets/create` (later `/anotar`) |
| Clientes → `/clients` | Clientes → `/clients` |
| Más → sidebar sheet | Más → sidebar sheet |

Code may use a **campo mode** flag or tenant setting later so office users keep Inicio/Tickets tabs; v1 may switch tabs globally if only one customer tenant is in campo.

## Future PRDs (field program)

| PRD | Priority | Notes |
|-----|----------|-------|
| [`prd-field-bottom-tabs.md`](./prd-field-bottom-tabs.md) | **P0 — Epic A0** | Retarget tabs; E2E |
| [`prd-technician-solo-mode.md`](./prd-technician-solo-mode.md) | **P0 — Epic A** | Hoy home, hide SaaS chrome |
| [`prd-offline-first-jobs.md`](./prd-offline-first-jobs.md) | **P0 — Epic B** | Local store + sync |
| [`prd-job-capture-anotar.md`](./prd-job-capture-anotar.md) | **P0 — Epic C** | Dedicated `/anotar` screen |
| [`prd-field-send-cobro.md`](./prd-field-send-cobro.md) | **P1 — Epic D** | WhatsApp, offline receipt |
| [`field-release-checklist.md`](./field-release-checklist.md) | **Parallel** | Return-day QA (not code epic) |
| [`FIELD-PROGRAM.md`](./FIELD-PROGRAM.md) | **Agent entry** | Handoff + issue registry |

## Out of scope (until ride-along)

- Native Android / Play Store (unless PWA blocked)
- WhatsApp bot as primary UI
- Sites, equipos, checklists, hotel OC, CFDI
- Replacing WhatsApp, Maps, or system camera

## Open questions (validate on return)

1. PWA icon install vs Play Store trust (Q5 in discovery PRD)
2. Consultancy vs repair mix (drives presupuesto priority)
3. Hotel payment delay and proof expectations (photos vs PDF vs signature)

Until answered, **offline capture (Q3) and Anotar speed (Q5) remain the design drivers.**

---

## Agent decisions (2026-08-20 — user on vacation)

Decisions we **would have asked** but locked so agents can proceed:

| # | Would have asked | Decision | Revisit |
|---|------------------|----------|---------|
| AD-1 | PWA or Play Store? | **PWA first** ([ADR 001](../docs/adr/001-field-program-pwa-first-packaging.md)) | If sync fails on device |
| AD-2 | One release or incremental? | **5 epic PRs to `main` sequentially** | — |
| AD-3 | Tabs for all users or campo only? | **Global Hoy/Anotar retarget v1** | If office users need Inicio/Tickets |
| AD-4 | Sidebar Inicio vs Hoy? | **Hoy** in campo sidebar; **Inicio** in office | Solo-mode epic |
| AD-5 | Anotar URL before `/anotar`? | Tab → **`/tickets/create`** until Epic C | Epic C slice 5 |
| AD-6 | Notes storage? | **`Ticket.work_notes`** column | — |
| AD-7 | Finish without catalog? | **Synthetic service line** in `anotarCapture` | — |
| AD-8 | IDB library? | **Dexie** + **`FieldJobStore`** | — |
| AD-9 | Multi-device sync? | **Last-write-wins, one phone** | — |
| AD-10 | Offline receipt? | **Text always; image if canShare** | Ride-along |
| AD-11 | After Anotar save? | **Navigate to ticket detail** | — |
| AD-12 | Auto campo mode? | **1 user ⇒ campo** | — |
| AD-13 | Second user joins? | **No auto-switch to office** | — |
| AD-14 | RFC on save? | **No block** on Anotar | — |
| AD-15 | WhatsApp API? | **No — wa.me only** | — |
| AD-16 | Sites/equipos in vacation? | **Deferred** | After return |
| AD-17 | Notebook migration? | **Concierge checklist**, not code | Return day |
| AD-18 | PR size? | **~26 slice PRs** → 5 feat branches | — |

**Agent entry:** [`FIELD-PROGRAM.md`](./FIELD-PROGRAM.md) · publish issues: `node scripts/publish-field-program-issues.mjs`
