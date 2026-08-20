# Field program — release checklist (first customer return)

Manual QA before concierge install and ride-along. Run on **Android Chrome PWA** (installed to home screen) unless noted.

**Seed / test tenant:** single-user company with `experience_mode: 'campo'` or auto-default; field test user with `tickets.write` + `clients.read`.

---

## 1. Install & auth

- [ ] PWA installs from Chrome; icon on home screen; opens to `/dashboard`
- [ ] Login stays signed in across closing browser (campo session refresh)
- [ ] No unexpected logout after 8h simulated (document if still failing — session epic)

## 2. Bottom tabs (Epic A0)

- [ ] Tabs visible below 768px: **Hoy**, **Anotar**, **Clientes**, **Más**
<<<<<<< HEAD
- [ ] Hoy → `/dashboard`; Anotar → `/tickets/create` (or `/anotar` when shipped); Clientes → `/clients`
- [ ] Más opens sidebar sheet (Cobranza, Recordatorios, Tickets list reachable)
- [ ] Tabs **hidden** on Anotar/create when sticky **Guardar** bar visible
- [ ] Safe area: tabs not under gesture bar on notched phone
- [ ] Tickets list (`/tickets`) does **not** highlight Hoy as active
=======
- [ ] Hoy → `/dashboard`; Anotar → `/tickets/create` or `/anotar` when shipped; Clientes → `/clients`
- [ ] Más opens sidebar sheet (Cobranza, Recordatorios, Tickets list reachable)
- [ ] Tabs **hidden** on Anotar/create when sticky **Guardar** bar visible
- [ ] Safe area: tabs not under gesture bar on notched phone
>>>>>>> origin/feat/offline-first-jobs

## 3. Hoy home (Epic A)

- [ ] First screen shows **Trabajo de hoy** (or Hoy queue), not revenue charts
- [ ] No onboarding checklist blocking home on campo tenant
- [ ] Empty Hoy shows CTA to Anotar
- [ ] Llamar / WhatsApp on day cards when phone present

## 4. Anotar (Epic C)

- [ ] One-screen capture (no 3-step stepper as default)
- [ ] Save without RFC / service catalog
- [ ] Client typeahead + quick nuevo (name + phone)
- [ ] Qué hice (work notes), Total, Pagó / Pendiente
- [ ] Median capture ≤ 30s timed (3 sample jobs)

## 5. Offline (Epic B)

- [ ] Airplane mode: save job → “Guardado en el teléfono”
- [ ] Reload app offline → job still visible on Hoy
- [ ] Badge **Pendiente de subir** until sync
- [ ] Restore network → sync → job on server / list updates
- [ ] **Subir ahora** manual flush works

## 6. Send & cobro (Epic D)

- [ ] WhatsApp **Enviar** menu from job card (visita, saldo, recibo)
- [ ] Online: PDF share via Android share sheet
- [ ] Offline: **Recibo simple** text/image via WhatsApp
- [ ] **Por cobrar** strip on Hoy when balances owed
- [ ] Cobrar dialog from Hoy without opening ticket detail

## 7. Concierge day (return visit)

- [ ] Install icon on customer phone (you do it)
- [ ] Migrate 2 weeks of notebook entries together
- [ ] Teach only: **Hoy**, **Anotar**, **Cobrar** (WhatsApp send)
- [ ] Notebook stays as backup — do not discard paper day one

## 8. Regression

- [ ] Office tenant (`experience_mode: office`) still shows dashboard charts on desktop
- [ ] `/cobranza` full list unchanged
- [ ] Multi-tenant isolation: no other company’s jobs visible

---

**Sign-off:** _______________ **Date:** _______________ **Device model:** _______________
