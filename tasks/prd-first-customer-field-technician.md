# PRD: First-customer value — field electrician / HVAC / consultancy (discovery)

**Status:** 📋 Reference — **do not implement from this file yet**  
**Kind:** Product discovery / opportunity map (not a slice epic)  
**Audience:** Product + engineering deciding what would make the first paying user actually open ZigZag every workday  
**Related (already in repo, not sufficient alone):** `prd-mobile-pwa-offline.md`, `prd-native-feel-pwa.md`, `prd-native-feel-offline-snapshots.md`, `prd-client-service-schedules.md`, `prd-onboarding-checklist.md`

This document is exhaustive on purpose. It includes incremental polish **and** radical product bets. Implementation is out of scope until a later `to-issues` / slice PRD pass.

---

## 1. Introduction / overview

ZigZag today is a **multi-tenant office SaaS**: Clients, catalog Services, Tickets, payments, server PDF receipts, Recurring service schedules, Presupuestos, Cobranza, RBAC, RFC/readiness gates, and a metrics Dashboard. It is installable as a PWA, but **Ticket / Client / Service data still require a live network**. Offline is an app-shell plus a “you have no internet” message.

The first customer is **not** that operator. He is a **solo (or nearly solo) field tradesman**:

- Electrical repair and maintenance for **houses and hotels**
- **A/C** repair, install, and preventive maintenance
- **Consultancy** in the same realm (surveys, recommendations, quotes)
- Works **mostly on an Android phone**
- Often in **places without internet** (roofs, basements, hotel machine rooms, rural houses)
- **Battery is scarce** (all day in the field, charger not guaranteed)
- **Not comfortable with technology**; his system of record was **paper notebooks**
- He **is not using ZigZag** and has **not said why**

The product’s landing copy already claims HVAC / mantenimiento / instalaciones and “del ticket al cobro.” The gap is not marketing. The gap is that ZigZag still behaves like a **desktop back office that happens to shrink to a phone**, while he needs a **digital notebook that works in the truck, on the roof, and in a hotel basement** — and that later helps him **get paid**.

**Core diagnosis:** ZigZag optimized for *correct invoicing by an office operator on Wi‑Fi*. The first customer needs *capture of work in 15 seconds with dirty hands, no signal, and a dying battery*. Until capture is faster and more trustworthy than the notebook, nothing else (PDF, charts, RBAC, RFC, CSV import) matters.

---

## 2. Goals of this document

- Explain, with product evidence, **why a notebook user would bounce** from current ZigZag.
- Map his **real jobs-to-be-done** (houses, hotels, A/C, electrical, consultancy).
- List **every high-value change** worth considering, including radical ones.
- Rank bets by **likely impact on daily use**, not by how well they fit the current architecture.
- Leave a **recommended sequence** so later PRDs can slice work without losing the north star.
- **Not** specify file-level implementation. **Not** authorize coding.

### Success for the *product* (once we later ship a slice of this)

He opens ZigZag **before the first job of the day** and **after the last job**, without being asked. The notebook stays in the glove box. Proxies:

- Time to record a job (name + what I did + amount + paid/pending) **under 30 seconds**, including offline.
- He can **find “what I did last time at Hotel X, piso 3, mini-split 12”** without calling anyone.
- He can **show or send a receipt / quote from the phone** the way he already uses WhatsApp.
- He **does not lose a day’s work** when the battery or signal dies.
- Setup does **not** require RFC, a service catalog, or a full fiscal address before the first note.

---

## 3. Who he is (working persona)

Call him **Don — técnico de campo**. Adjust names later; the constraints are the product.

| Constraint | Implication |
|------------|-------------|
| Solo or 1 helper | No dispatcher, no office clerk, no RBAC theater. If someone helps, it is often a spouse at home on Wi‑Fi. |
| Houses | One person, one WhatsApp, cash or transfer the same day, informal. |
| Hotels | Gerente / jefe de mantenimiento, many rooms and machines, POs, delayed payment, needs *proof* (photos, folio). |
| Electrical | Diagnosis, parts (breakers, cable, contactors), panels, safety notes, emergency call-outs. |
| A/C | Serial/model, filters, refrigerant, seasonal PM, many identical units in one property. |
| Consultancy | Walkthrough + photos + written recommendations + later presupuesto. Not a same-day cobro. |
| Android phone | Camera, WhatsApp, Maps, files. Not a laptop. Play Store is how “real apps” appear. |
| No internet | Offline is the **default work mode**, not a degraded banner. |
| Low battery | Dark UI, no polling, no heavy dashboards, sync when charging / on Wi‑Fi. |
| Notebook habits | Free text + numbers + dates. No “catalog.” No “ticket.” No “dashboard.” Fear of breaking the computer. |
| Spanish | Product language must be *trabajo, cliente, cobro, recibo, presupuesto, visita* — not SaaS English. |

He already has tools that work: **notebook, WhatsApp, camera roll, phone calls, cash**. ZigZag only wins if it **beats those at something he already feels** (forgetting a visit, losing a number, not getting paid, not remembering the last repair).

---

## 4. A day in his life (jobs ZigZag must serve)

Typical day, reconstructed from the trade — **not** from analytics (we have none from him):

1. **Night before / morning:** Who do I visit? Hotel maintenance contract, a house that called yesterday, an A/C that “no enfría,” a consultancy walkthrough.
2. **In the truck:** Address, phone of the contact, “what they said was wrong.”
3. **On site, often no signal:** Diagnose. Buy or use parts. Take before/after photos. Write what was done, parts, hours, money. Get a signature or a “págame la otra semana.”
4. **Quote path:** Hotel asks “cuánto sale cambiar dos condensadoras.” He walks, photos, writes a number, sends it on WhatsApp.
5. **Collect:** Cash, SPEI, “el administrador paga el viernes.” He must remember saldo.
6. **Follow-up:** A/C every 3 months; hotel electrical thermography or PM; house that still owes.
7. **End of day, maybe with signal and a charger:** What did I earn, who owes me, who do I visit tomorrow.

The notebook does 1–5 in **one page**. ZigZag currently splits that across **Client create → Ticket create (Datos) → Servicios from catalog → Finish → PDF → Cobranza → Recordatorios**, all **online**, after **company RFC + address readiness**.

That is not a mobile polish problem. It is a **workflow mismatch**.

---

## 5. Why he is probably not using it (hypotheses)

He has not told us why. Treat these as **ranked hypotheses to validate in one visit**, not as facts. Each is grounded in **what the product actually does today**.

### H1 — It does not work where the work happens (highest)

PWA caches the **shell**. Lists, saves, PDFs, and even the offline page tell him tickets need internet. On a roof or in a basement the notebook still works. ZigZag becomes a brick. Existing deferred work (`prd-native-feel-offline-snapshots.md`) is **read-only snapshots**, explicitly **not** offline create. That still loses to paper.

### H2 — Capture is slower and more fragile than paper

Ticket create is a **3-step wizard** (Datos → Servicios → PDF). Services must come from a **priced catalog**. Client wants **name + numeric phone**. Company production readiness wants **RFC, moneda, full address**. One job in a notebook: *“Hotel Palmas, mini-split 12, recarga, $2,500, dejó $1,000.”* In ZigZag that is minutes of forms, if he is allowed to start at all.

### H3 — Wrong home screen

Login copy promises “tickets de hoy,” and there **is** a “Trabajo de hoy” widget. The actual home is still a **metrics Dashboard** (ingresos, charts, onboarding checklist, attention widgets). A notebook user does not open software to see sparklines. He opens it to **do the next job** or **write the last one**.

### H4 — Mental model clash (Ticket / Servicio / Company)

His objects are: **persona, lugar, aparato, lo que hice, fotos, dinero.** ZigZag’s objects are: **Company, Client, Service catalog, Ticket, Payment, Schedule pair, Presupuesto document_kind.** Hotels are not “one Client with one address.” An A/C unit is not a Service row. Consultancy is not a finished Ticket with line items.

### H5 — Login and session feel like a bank, not a notebook

Email + password. JWT **8 hours**. Session expiry on a phone he barely understands means “the app broke.” Notebooks do not log out.

### H6 — No pictures, no “what I did” narrative

There is no first-class **job note**, **photo**, **voice memo**, **signature**, or **asset**. The PDF is a **recibo** of catalog lines. Hotels and insurance care about **before/after**. He already takes photos in the camera roll, disconnected from money.

### H7 — Setup wall and fear

Onboarding asks: Mi empresa (logo, RFC, moneda) → catálogo → clientes → primer ticket → equipo → PDF y recordatorios. For a man who wrote in notebooks, this is a **bureaucracy sim**. One confusing error toast (`AU001`, `CO011`, `GN002`) confirms “this is not for me.”

### H8 — WhatsApp is the real network; ZigZag is a side app

Quotes, “voy en camino,” “te debo,” photos, and even addresses already live in WhatsApp. ZigZag has `wa.me` helpers for saldo and visita — useful, but **opt-in from inside a web app he does not open**. The gravity well is WhatsApp, not `/dashboard`.

### H9 — Battery and “heavy website”

Charts, filters, sheets, steppers, server round-trips, camera unused. A PWA that must stay online **keeps the radio hot**. He will blame the app for a dead phone and go back to paper.

### H10 — We never replaced the notebook in a sitting

If nobody sat with him, typed **this week’s notebook into the app**, and showed “now search Hotel X,” he has **zero migrated memory**. Empty SaaS vs full notebook is not a fair fight.

### H11 — Language of money vs language of SAT

He wants a **recibo** he can send. The product also talks RFC, production readiness, multi-empresa. Fiscal completeness is valuable **later**; as a gate it blocks the only user.

Validate with a **90-minute ride-along**, not a survey. Watch him log three real jobs on paper. Time them. Then ask him to do the same in ZigZag **on airplane mode**. Record where he abandons.

---

## 6. Current product vs notebook (gap table)

| Notebook page | ZigZag today | Gap |
|---------------|--------------|-----|
| Scribble name / nick | Client with phone required; structured address optional | Too much structure up front |
| Place (“Hotel X, cuarto 214”) | Single Client.address | No Site / Room / Asset |
| What I did (free text) | Service catalog name + 120-char description | No job diary |
| Parts used | Not modeled (only Service lines) | Materials missing |
| Amount + paid / queda a deber | Ticket total/paid + Cobranza | OK conceptually; buried in forms |
| Date | ticket_date | OK |
| Photos | None | Critical miss |
| Phone number in margin | tel: and WhatsApp helpers exist | Must open the web app first |
| “Cada 3 meses el hotel” | ClientServiceSchedule (shipped) | Powerful but office-scheduled, online, catalog-tied |
| Quote in WhatsApp | Presupuestos module | Parallel SaaS flow, not chat |
| Find last visit | Lists + search (online) | No offline history, no asset history |
| Works with no signal | Shell + banner; data needs net | Deal-breaker |
| Never logs out | 8h JWT | Deal-breaker for low-tech |
| One object: the page | 8+ nav destinations | Cognitive overload |

**What is already close (do not throw away):**

- Spanish UI, recibo PDF, payments + Cobranza
- Presupuestos → convert to Ticket
- Recordatorios de servicio (A/C PM is the textbook case)
- “Trabajo de hoy” queue helpers and WhatsApp visita/saldo messages
- PWA install on Android, tel: links, ticket form drafts (localStorage)
- Mobile cards / filter sheets

Those are **office-grade features**. They become valuable **after** capture and offline are solved.

---

## 7. North-star product (even if radical)

**ZigZag for Don is not a dashboard. It is a durable field notebook with a cash register and a memory.**

One-screen daily loop:

1. **Hoy** — who to see (visits + overdue cobro + PM due).
2. **Anotar** — one fat button: voice and/or photos and/or “quién / qué / cuánto / pagó?”
3. **Enviar** — WhatsApp receipt or quote when there is signal.
4. **Cobrar** — who still owes, tap to remind on WhatsApp.
5. **Recordar** — next A/C or electrical visit, without a catalog philosophy course.

Everything else (RFC, charts, roles, CSV, system console, multi-tenant) is **back office** and should be hidden from him, possibly used only by a helper at home — or by us as concierge.

---

## 8. Opportunity catalog

Impact = how much it moves **daily use** for this person. Effort is technical/product invasiveness, not calendar time.

Legend: **P0** must-have to replace the notebook · **P1** makes him prefer the phone · **P2** wins hotels/consultancy · **P3** later / adjacent.

### 8.1 P0 — Replace the notebook (without these, polish is wasted)

#### O-01. Offline-first capture and history (radical vs current PWA policy)

**Change:** Local database on the phone (SQLite / IndexedDB durable store). Create, edit, and read Clients, jobs, notes, money, photos **with zero network**. Sync when signal returns. Conflict policy for a single operator: last-write-wins + “pendiente de subir” badge.

**Why it is tremendous:** Airplane mode is his office. Current policy (“no offline CRUD”) is an explicit decision to lose to paper.

**Radical option:** Native Android app (Play Store, WorkManager sync, real camera, storage). PWA background sync is weaker on Android when the browser is killed.

#### O-02. 15-second “Anotar trabajo” (kill the 3-step ticket wizard as the default)

**Change:** One screen: Who (type-ahead or “nuevo”), Where (optional), What happened (one text box), Amount, Paid now / queda a deber. Save. Catalog Services become **optional suggestions**, not a prerequisite.

**Why:** Matches the notebook line. Today’s Datos → Servicios → PDF is an invoice factory, not a field log.

#### O-03. Free-text job notes as the source of truth

**Change:** A `work_notes` (or equivalent) field that can be long, dictatable, and printed/shared. Line items are derived or optional.

**Why:** Electrical and HVAC work is narrative: “se cambió contactor, no era el capacitor.” A 120-character Service description cannot hold that.

#### O-04. Camera as a first-class field (before / after / plate / breaker)

**Change:** Attach photos to the job, compressed for battery and storage, queued offline. Show them on the job and optionally on the PDF or WhatsApp.

**Why:** Hotels, disputes, and his own memory. The camera roll is already his second notebook; ZigZag ignores it.

#### O-05. Hide the SaaS. Solo mode.

**Change:** A **Técnico** experience: no sidebar jungle, no Roles/Permisos/Empresas/Auditoría, no onboarding that demands a team invite, no RFC before the first note. Company fiscal profile is a later “Recibos bonitos” optional step.

**Why:** Cognitive load and fear. Multi-tenant RBAC is our problem, not his.

#### O-06. Auth that feels like a phone lock, not a bank

**Change:** PIN + biometrics (and stay signed in for weeks on this device). Session does not expire mid-job. Recovery via a printed/backup PIN he keeps in the same place as the old notebook.

**Why:** 8-hour JWT + email/password is a daily abandonment machine.

#### O-07. Battery-first field mode

**Change:** Default dark UI on OLED, no dashboard charts on the technician home, no polling, no motion, sync paused on low battery / cellular unless he taps “subir ahora.” Optional “modo ahorro”: text + numbers only, photos deferred.

**Why:** A dead phone is worse than no software. He will uninstall anything that smells like it drains the battery.

#### O-08. Concierge notebook migration (process, not only software)

**Change:** We (or a helper) sit with him and enter **90 days of notebook** as jobs + clients + next visits. Train on **three** actions only: Hoy, Anotar, Cobrar.

**Why:** Empty app vs full notebook. Features do not beat incumbents that already hold memory.

---

### 8.2 P1 — Make the phone better than paper

#### O-09. Home = Hoy, not Dashboard

**Change:** Installed app and login land on **Trabajo de hoy**: visits, unfinished jobs, overdue cobro, PM due. Metrics charts move to a weekly “números” page he can ignore.

**Why:** Aligns with the login promise and the existing technician-day widget — make it the product, not a widget under KPIs.

#### O-10. Giant targets, one job per screen, no filter sheets for daily use

**Change:** Technician UI: 48–56px controls, numeric keypad for money, no TanStack-style dense filters on the happy path. Search is a single box (“Palmas”, “mini-split”, “debe”).

**Why:** Dirty hands, sun, low literacy with forms.

#### O-11. Voice notes → text (Android speech-to-text)

**Change:** Hold to talk on the note field. Optional later: parse “cobré mil quinientos” into paid amount.

**Why:** Faster than typing; closer to how he thinks. Works poorly offline unless on-device recognition is used — plan for both.

#### O-12. WhatsApp as the send button (quotes, receipts, “voy en camino,” saldo)

**Change:** Every job has **WhatsApp**: share compressed photos, a text quote, a PDF when online, “estoy en camino,” “saldo $X.” Prefill from job. No WhatsApp Business API required at first (`wa.me` already exists).

**Why:** That is how houses and hotel contacts already communicate. Email is optional; WhatsApp is not.

#### O-13. Share PDF / image receipt without hunting the download

**Change:** Finish job → “Enviar recibo” → Android share sheet (WhatsApp, Files). Fallback: a **simple image receipt** generated on-device so it works offline (PDF can wait for sync).

**Why:** Server PDF needs network and a finished Ticket. He needs *something* to show the customer **now**. Native-feel share-PDF is necessary but not sufficient without an offline receipt.

#### O-14. Money the way he speaks it

**Change:** Paid / falta. Cash vs transferencia vs “me paga el hotel el viernes” (due date). Partial payments without a dialog nested in ticket detail. Daily “cuánto entré hoy” as a single number, not a chart suite.

**Why:** Cobranza exists but is an office queue. He thinks in pockets and promises.

#### O-15. Call / navigate / WhatsApp from the job card

**Change:** One tap: call contact, open Maps to the site, WhatsApp. Save geo when he has signal; allow dropped pin or “cerca de.”

**Why:** The notebook margin is a phone number; the phone should do phone things.

#### O-16. Drafts that survive kill, crash, and airplane mode

**Change:** Durable local drafts for the current note (stronger than ticket `localStorage` drafts). Never lose a half-written job if Chrome dies.

**Why:** Low-tech users do not “save.” They assume paper cannot vanish; software can.

#### O-17. Spanish, notebook words, no error codes in his face

**Change:** “No hay internet. Tu nota está guardada en el teléfono.” Never `GN002` as the headline. Hide Ticket/Dashboard/RFC until settings.

**Why:** Error catalog is for us; he reads it as “I broke it.”

#### O-18. Install path a child could follow

**Change:** We install it **for him** on the Android (PWA or Play Store). Icon labeled **ZigZag** or **his business name**. No “Add to Home screen” documentation as the strategy.

**Why:** He will not self-serve a PWA install from README.

---

### 8.3 P2 — Houses vs hotels, A/C, electrical, consultancy (domain depth)

#### O-19. Sites, not only Clients

**Change:** Client = who pays / who WhatsApps. Site = house or hotel. Optional **room / piso / área**. Jobs hang off a Site.

**Why:** “Hotel Palmas” has many jobs; the gerente is one person. Current Client.address cannot model this.

#### O-20. Assets / equipos (especially A/C)

**Change:** Mini-split #, marca, modelo, serial, ubicación, refrigerant notes, last service, photo of the data plate. History per machine.

**Why:** This is the actual recurring object in HVAC and hotel electrical (tableros, bombas, plantas). Client+Service schedules are a blurry proxy.

#### O-21. Preventive maintenance checklists (A/C and electrical)

**Change:** Simple checklists: filtros, lavado serpetín, amperaje, presiones (optional), torque, termografía foto. Completing the list **is** the job note.

**Why:** Hotels pay for PM. A blank text box does not remind him what “mantenimiento” includes. Recordatorios already know **when**; checklists know **what**.

#### O-22. Materials / parts used (electrical + HVAC)

**Change:** Quick add: cable 12 AWG 8m, pastilla 30A, capacitor 45/5, gas R410. Optional inventory later; v1 is just “qué usé” for the receipt and for reordering.

**Why:** Cost and customer trust. Catalog Services as finished products hide parts.

#### O-23. Emergency / after-hours flag and rate

**Change:** Toggle “urgencia / nocturno” that applies a multiplier or a fixed visita fee.

**Why:** Common in electrical and A/C. Easy money lost if every job looks the same.

#### O-24. Consultancy = visita de diagnóstico (different from cobro)

**Change:** Job type: **Reparación**, **Mantenimiento**, **Instalación**, **Consultoría**. Consultancy produces: photos, findings, recommended work, optional presupuesto. May have a visit fee or be free to win the hotel.

**Why:** Forcing consultancy into “finished Ticket + catalog lines + PDF invoice” is the wrong document.

#### O-25. Presupuesto from the site (photos + voice → quote)

**Change:** Walk the hotel, snap units, dictate “dos condensadoras, mano de obra, 3 días.” Generate a **plain-language quote** he sends on WhatsApp. Convert to work when they say sí (Presupuestos already convert — the capture path is the hole).

**Why:** Quotes happen **in the building**, often offline. The Presupuestos list is an office inbox.

#### O-26. Hotel packet: folio, OC/PO, contact role, “no cobrar en recepción”

**Change:** Fields hotels actually use: orden de compra, nombre del gerente, “facturar a…”, payment delay. Recibo that looks professional enough for administración.

**Why:** Houses pay cash; hotels pay on paper trail. One Client form does both badly.

#### O-27. Signature on glass

**Change:** Customer signs the phone (offline). Store with the job. Optional on receipt.

**Why:** Proof of work for hotels and for “él dijo que sí.”

#### O-28. Find last time (the feature that beats paper)

**Change:** Search by site, asset, “fuga,” “no enfría,” date. Timeline per hotel / per machine. This is the **killer** vs notebooks (notebooks do not search).

**Why:** He will switch for **memory**, not for invoices. Paper is faster to write; software is faster to remember — only if history is there (see O-08).

#### O-29. Maps / ruta del día

**Change:** Ordered list of today’s sites, open in Google Maps / Waze. Manual order (he knows traffic). No automated routing required at first.

**Why:** Useful; not sufficient alone. Do after Hoy + Anotar.

#### O-30. Recurring visits that feel like a calendar, not a pair table

**Change:** “Este mini-split cada 3 meses” from the job screen in one tap. Use existing ClientServiceSchedule **or** move the rule onto the Asset. Notify on the Hoy list. Optional Android notification in the morning (needs native or Web Push + install).

**Why:** A/C maintenance is recurring revenue. The current Recordatorios UI is a management table for staff, not a field reminder.

#### O-31. Warranty / “si falla en 30 días”

**Change:** Mark a repair as guaranteed until date. Hoy shows callbacks. Stops double-charging and arguments.

**Why:** Common trade practice, invisible in current Ticket.

#### O-32. Simple “gastos del día” (gasolina, refacciones)

**Change:** Optional cash-out so “cuánto gané” is not vanity revenue.

**Why:** Notebook often has a second column for gastos. Skip if it distracts; add if he already tracks it.

---

### 8.4 P2/P3 — Getting paid and looking official (after capture works)

#### O-33. On-device “recibo simple” + later SAT-quality PDF

**Change:** Two documents: (a) **nota** for the customer now, (b) branded PDF when online and company profile exists. Do not block (a) on RFC.

**Why:** Readiness gates invert the value: he needs the note more than the SAT-looking PDF.

#### O-34. SPEI / datos para transferir

**Change:** Company CLABE / tarjeta as a tap-to-share WhatsApp message (“págame aquí”) plus “ya pagué” confirmation later.

**Why:** Houses increasingly transfer. He should not retype CLABE.

#### O-35. Bluetooth thermal printer (hotel / street)

**Change:** Print 58mm receipt from the phone. Radical but aligned with “not good with technology” — printing feels real.

**Why:** Some customers still want paper. Only after digital send works.

#### O-36. CFDI / factura electrónica

**Change:** Real Mexican invoicing. **Do not lead with this.** It is high effort, high fear, and not why he uses a notebook. Offer when hotels demand factura.

**Why:** Mentioned so we do not pretend receipts are facturas. Keep the distinction honest in the UI (the product already moved toward “Recibo”).

---

### 8.5 Radical bets (consider seriously; they can dwarf UI polish)

These are **allowed** in this document. They may mean ZigZag-the-SaaS is the wrong shape for customer #1.

#### R-01. Native Android app as the real product; web becomes the home office

Play Store, true background sync, camera, files, battery APIs, PIN. Spouse uses web Cobranza on Wi‑Fi. Current Next.js stays the sync server.

#### R-02. WhatsApp-native product (gravity well)

He sends photos + voice to a business WhatsApp; ZigZag files the job. He almost never opens our UI. Extreme: a WhatsApp bot is the app.

#### R-03. Photograph the notebook (bridge, not destination)

Weekly: take pictures of paper pages; we transcribe (human concierge first, OCR later). Lowers switching cost. Risk: delays learning the new habit.

#### R-04. Voice journal of the whole day

At 8pm he talks for three minutes; the system splits jobs. High magic, high error cost. Pair with confirm cards (“¿esto está bien?”).

#### R-05. Split apps: Campo vs Casa

Campo: Hoy / Anotar / Cobrar / WhatsApp. Casa: numbers, RFC, PDF, recordatorios, presupuestos. Same data. Stops scaring him with Mi empresa.

#### R-06. Local-first single-user SKU; freeze multi-tenant features in that SKU

One technician, one company, no system console in his build. Our platform can still host him as a tenant.

#### R-07. Hardware kit

Phone sleeve, power bank, cheap thermal printer, printed 4-digit PIN card, home-screen setup done by us. Product + service.

#### R-08. Human operator in the loop (concierge SaaS)

He WhatsApps a real person (us) for 30 days; we enter ZigZag. Software learns his phrases. Expensive but might be the only way a notebook user crosses the chasm.

#### R-09. SMS / “marcar *123” fallback

If Android + data is still too much: miss calls or SMS codes to log “job done.” Only if ride-along shows even a simple app fails.

#### R-10. Do not sell him ZigZag-as-is; sell a vertical “Eléctrico & Clima”

Preloaded checklists, asset types, Spanish copy, sample hotel PM plan. Generic ticket SaaS feels like “not my oficio.”

#### R-11. Abandon charts, CSV, RBAC depth, operator console **in his UI forever**

Those remain for *us* and future multi-user shops. For Don they are anti-features.

#### R-12. Be the memory, partner with WhatsApp + Maps + Camera; do not rebuild them

Deep links > cloning chat or navigation. ZigZag stores **structured memory and money**; other apps are the pipes.

---

### 8.6 What would *not* add tremendous value (for him)

Doing these **instead of P0** is how we keep shipping while he stays on paper:

- More dashboard analytics / Lighthouse points / visual redesign of lists
- CSV service import, unified audit module, system operator console
- RBAC matrices, plan limits, multi-company switcher
- Pixel-perfect PDF layout, SAT-looking invoices before capture exists
- iOS polish
- Bottom tabs that still open **online-only** empty lists
- Read-only IndexedDB snapshots (better than nothing, still loses to notebook)
- Onboarding checklist that starts with RFC
- Inviting a team he does not have

Native-feel PWA slices (tabs, splash, pull-to-refresh) **help after** offline capture and Hoy-home exist. They are not the reason he will switch.

---

## 9. User stories (exhaustive, still discovery-grain)

Stories below describe **Don** and a possible **helper at home**. They are not implementation slices.

1. As Don, I want to write a job with no internet, so that a basement or roof does not send me back to paper.
2. As Don, I want that job to still be there after the phone reboots, so that I trust the app like a notebook.
3. As Don, I want one button “Anotar,” so that I do not hunt Tickets / Servicios / PDF.
4. As Don, I want to type or dictate what I did in my own words, so that the note matches how I think.
5. As Don, I want to take before and after photos on the job, so that the hotel and I remember the machine.
6. As Don, I want photos to wait on the phone until there is signal, so that the camera still works offline.
7. As Don, I want to enter an amount and whether they paid, so that cobro is part of the same note.
8. As Don, I want to save a job without RFC or a service catalog, so that setup does not block work.
9. As Don, I want to stay logged in on my phone, so that the app does not “break” every night.
10. As Don, I want a PIN or fingerprint, so that email passwords are not my problem.
11. As Don, I want the app to open on today’s jobs, so that I do not see charts I do not use.
12. As Don, I want huge buttons, so that I can use it with dirty hands.
13. As Don, I want the app to use little battery, so that I can finish the day.
14. As Don, I want a dark screen in dim machine rooms, so that I can read it.
15. As Don, I want to tap Llamar, so that I do not copy numbers.
16. As Don, I want to tap WhatsApp, so that I talk to the customer where they already are.
17. As Don, I want to tap Cómo llegar, so that Maps opens to the house or hotel.
18. As Don, I want to send “voy en camino” without typing, so that hotels know I am coming.
19. As Don, I want to send a receipt on WhatsApp, so that I do not print or email.
20. As Don, I want a simple receipt even offline, so that I can show something before sync.
21. As Don, I want to send a quote from the site, so that I do not redo numbers at night.
22. As Don, I want quotes to become work when they say yes, so that I do not capture twice.
23. As Don, I want to see who owes me, so that hotels that pay later do not disappear.
24. As Don, I want to WhatsApp a saldo reminder, so that cobro happens in the same chat.
25. As Don, I want cash vs transferencia vs “paga el viernes,” so that promises are visible.
26. As Don, I want to share my CLABE, so that houses can transfer without asking twice.
27. As Don, I want Client = the person, so that “Don Pepe” and “Hotel Palmas” are not the same kind of thing.
28. As Don, I want a Site for the hotel, so that many rooms live under one place.
29. As Don, I want a room or piso on a job, so that I find the unit next time.
30. As Don, I want each mini-split or tablero as an equipo, so that history is per machine.
31. As Don, I want to photograph the data plate, so that I do not copy serials wrong.
32. As Don, I want “mantenimiento cada 3 meses” in one tap, so that PM is not a separate admin website.
33. As Don, I want tomorrow’s Hoy to show those visits, so that I do not keep a second calendar.
34. As Don, I want an A/C checklist, so that I do not forget filtros and limpieza.
35. As Don, I want an electrical checklist for tableros, so that hotel PM is consistent.
36. As Don, I want to list parts I used, so that the customer sees why it costs that.
37. As Don, I want an urgencia toggle, so that night calls bill correctly.
38. As Don, I want a consultoría job type, so that a survey is not a fake invoice.
39. As Don, I want findings + photos from consultancy to feed a presupuesto, so that advice becomes work.
40. As Don, I want a hotel OC/folio field, so that administración can pay.
41. As Don, I want a signature on the phone, so that “recibido” is proof.
42. As Don, I want to search “Palmas fuga,” so that the notebook’s worst trait (no search) is beaten.
43. As Don, I want last visit on this equipo, so that I know what I already changed.
44. As Don, I want today’s sites in order, so that I can open Maps per stop.
45. As Don, I want a warranty date, so that callbacks are planned.
46. As Don, I want “cuánto entré hoy,” so that I know the day without a dashboard.
47. As Don, I want optional gastos, so that gasoline does not look like profit.
48. As Don, I want Spanish words only, so that Ticket/Dashboard/RFC do not shame me.
49. As Don, I want errors to say what to do, so that I do not think I broke the phone.
50. As Don, I want someone to put my old notebook into the app, so that day one already has memory.
51. As Don, I want only three things to learn, so that I am not trained like an office clerk.
52. As a helper at home, I want the full web Cobranza/PDF/RFC screens, so that I can support Don without him seeing them.
53. As Don, I want sync when I reach Wi‑Fi or a charger, so that the field day never waits on a spinner.
54. As Don, I want a badge “sin subir,” so that I know the phone still holds the truth.
55. As Don, I want the app to work if Chrome was killed, so that Android battery saver does not erase the day.
56. As Don, I want Play Store or a home icon we install, so that I open it like WhatsApp.
57. As Don, I want not to invite a team, so that onboarding does not ask for employees I do not have.
58. As Don, I want not to fill 10 address fields for a house I already know, so that Clients are a name and a pin.
59. As Don, I want hotel contacts (gerente vs mantenimiento vs recepción), so that I WhatsApp the right person.
60. As Don, I want to attach a voice memo if typing fails, so that I can record in the truck.
61. As Don, I want tomorrow morning a reminder of visitas, so that I do not open a calendar app.
62. As Don, I want to pause a hotel PM if they asked to wait, so that Hoy stays honest.
63. As Don, I want unfinished jobs to roll to tomorrow, so that open work cannot hide.
64. As Don, I want to duplicate last year’s hotel PM as this season’s plan, so that I do not rebuild the year.
65. As Don, I want a printed backup of the week (optional), so that if the phone dies I am not blind.
66. As us, we want a ride-along script, so that we stop guessing which hypothesis is true.

---

## 10. Functional requirements (vision-level, not build-ready)

- FR-1: A technician SKU/mode must allow creating a job **offline** with who/what/amount/paid.
- FR-2: Jobs, notes, and photos must persist **on device** until sync succeeds.
- FR-3: Sync must be **explicitly queued**, visible, and retryable; never silent data loss.
- FR-4: Technician home must be **Hoy**, not metrics.
- FR-5: Service catalog, RFC, and full Company address must be **optional** for capture and simple receipts.
- FR-6: Photos must attach to jobs with compression and offline queue.
- FR-7: WhatsApp share for visit, saldo, quote, and receipt must be one tap from the job.
- FR-8: Auth on the technician device must **not** expire on an 8-hour office JWT without a field-safe alternative.
- FR-9: UI copy must be Spanish field language; error codes must not be the primary message.
- FR-10: Domain model must eventually distinguish **Client, Site, Asset, Job type** (repair / PM / install / consult).
- FR-11: Recurring PM must be creatable from the job/asset, and appear on Hoy.
- FR-12: A helper or system operator may use the existing office modules without forcing them into Don’s home screen.
- FR-13: Battery mode must disable polling, charts, and nonessential motion on the technician home.
- FR-14: Search must work on **local** history, not only server lists.

---

## 11. Technical considerations (for later design, not this sprint)

- Current architecture (Server Actions, network-only SW, JWT 8h, no media store) **cannot** meet P0 without a new sync + attachment layer.
- Options: (A) local-first PWA + background sync, (B) Capacitor/React Native Android + same API, (C) WhatsApp/concierge with humans writing to current ZigZag.
- Multi-tenancy and RBAC can remain on the server; the technician client should **not expose** them.
- Photos: object storage, aggressive compression, EXIF stripping, quota, and “Wi‑Fi only upload” for battery.
- Single-user sync is much easier than multi-device CRDT; prefer **one phone as primary**.
- On-device speech recognition vs Google’s online STT: offline jobs need a fallback (audio file queued).
- Do not cache tenant HTML in the service worker as a fake offline mode; that is a security/staleness trap already called out in native-feel PRDs.

---

## 12. Design considerations

- Visual metaphor: **lined notebook + big numeric money**, not fintech dashboard.
- One primary CTA per screen, thumb-reachable, Spanish verb: Anotar, Guardar, Enviar, Cobrar.
- Progressive disclosure: advanced fields (OC, serial, checklist) behind “Más datos.”
- Empty states that say “Aquí van tus trabajos. El primero puede ser el de ahora.” not SaaS illustrations.
- Never show a production-blocked Company wall on Anotar.
- Accessibility still matters (contrast in sun), but **simplicity > completeness**.

---

## 13. Non-goals **of this document**

- No implementation, schema migrations, or slice issues from this file until product picks a first epic.
- No promise to ship all opportunities.
- No iOS-first work.
- No CFDI as a launch requirement for Don.
- No replacing WhatsApp, Maps, or the system camera.
- No weakening tenant isolation on the server while adding a technician client.

---

## 14. Recommended sequencing (when we later implement)

Do **not** start with visual native-feel or PDF chrome.

1. **Learn:** Ride-along + time three real jobs on paper vs current app (airplane mode). Confirm H1–H11.
2. **Concierge:** Enter his notebook; install the icon; teach Hoy / Anotar / Cobrar even on today’s online app if needed — as a stopgap, be honest about signal.
3. **Epic A — Field notebook v1:** Offline capture + notes + money + Hoy home + solo mode + stay-signed-in + battery-quiet UI. (O-01–O-07, O-09–O-11, O-16–O-17.)
4. **Epic B — Send and cobro:** WhatsApp + offline simple receipt + saldo list. (O-12–O-15, O-14, O-34.)
5. **Epic C — Memory:** Photos + search + sites. (O-04, O-19, O-28.)
6. **Epic D — Oficio:** Assets, PM checklists, job types, parts. (O-20–O-25, O-30.)
7. **Epic E — Hotels/consultancy polish:** PO, signature, quotes from site, warranty. (O-24–O-27, O-31.)
8. **Packaging decision:** Stay PWA vs native Android vs WhatsApp-first (R-01/R-02) — make this after Epic A prototypes, not before.

Existing modules (Recordatorios, Presupuestos, Cobranza, PDF, native-feel tabs) **plug into Epics B–E**; they are not Epic A.

**If we can only do five things:** (1) offline anotar, (2) Hoy as home, (3) photos, (4) WhatsApp send, (5) concierge migration. That set beats a year of SaaS features.

---

## 15. Success metrics (later)

- He records ≥80% of paid jobs in ZigZag within 30 days of concierge install (self-report + data).
- Median time Anotar → Guardar < 30s on a mid Android, offline.
- Zero lost jobs after process death / airplane mode in field tests.
- Notebook pages per week → 0 for work notes (photos of paper do not count as success unless we chose R-03 as a bridge).
- Unsolicited WhatsApp from him using the app in the field (qualitative).

Vanity: Lighthouse, PDF aesthetics, number of nav items shipped.

---

## 16. Open questions (ask him on the ride-along)

Use lettered options when you interview; do not block this discovery file on answers.

1. Where does the notebook actually fail him today?  
   A. Forgetting who owes money  
   B. Forgetting what he did last time at a hotel  
   C. Losing pages / rain / unreadable writing  
   D. Looking unprofessional vs hotels  
   E. Other
2. What must work with **no bars**?  
   A. Only reading today’s list  
   B. Writing the job + photos  
   C. Showing a receipt  
   D. Everything including quotes
3. Who else might use this?  
   A. Only him  
   B. Spouse at home  
   C. A helper in the field  
   D. Hotel client (portal) — unlikely v1
4. How does he want to send proof?  
   A. WhatsApp photos  
   B. WhatsApp PDF  
   C. Paper  
   D. Does not send proof today
5. Packaging he would trust?  
   A. Icon we put on the phone (PWA)  
   B. Play Store app  
   C. Only WhatsApp with a human/bot  
   D. Keep paper; he does not want this
6. Consultancy share of the week? (hours vs repairs) — drives O-24 priority.
7. Typical hotel payment delay and whether OC/factura is demanded.
8. Phone model, Android version, storage, and whether he uses WhatsApp Business.

Until those are answered, **treat H1 (offline capture) and H2 (speed vs paper) as the default design drivers.**

---

## 17. Suggested later artifacts (not this PRD)

When ready to build, split — do **not** implement from this file:

| Later file | Scope |
|------------|--------|
| `prd-technician-solo-mode.md` | Hide SaaS, Hoy home, copy, auth lifetime |
| `prd-offline-first-jobs.md` | Local store, queue, sync, conflict, tests |
| `prd-job-capture-anotar.md` | One-screen capture, notes, money, voice |
| `prd-job-media.md` | Photos/audio queue, compression, WhatsApp |
| `prd-sites-and-assets.md` | Client vs Site vs equipo |
| `prd-field-pm-checklists.md` | A/C + electrical PM; hook to schedules |
| Packaging ADR in `docs/adr/` | PWA vs Android vs WhatsApp-first |

Update this discovery file if ride-along evidence kills or promotes a hypothesis.
