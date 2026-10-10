# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Next.js with Turbopack on port 3069
npm run build        # Production build
npm run lint         # ESLint

# Database: Drizzle is canonical
npm run db:generate      # Generate SQL migrations from src/db/schema.ts
npm run db:migrate       # Apply pending local migrations (refuses remote DBs; pass the local URL explicitly)
npm run migrate:deploy   # Apply production migrations with DIRECT_URL when set
npm run db:studio        # Open Drizzle Studio
npm run seed             # Seed through scripts/seed.ts

# Testing
npm test                        # Jest unit/integration tests
npm test -- --runInBand         # CI-style Jest run
npm run test:watch              # Watch mode
npm run test:coverage           # Coverage report
npm run test:e2e                # Playwright E2E (prod build on port 3070; PLAYWRIGHT_USE_DEV=1 for turbopack dev)
npm run lighthouse:mobile       # Lighthouse mobile baseline (prod server on 3070; needs E2E creds)
npm run seed:perf               # 10k tickets / 1k clients for query-budget baseline
npm run query:audit             # EXPLAIN ANALYZE + ms budgets (docs/query-budget.md)
```
> **Database:** PostgreSQL. Use a `postgresql://...` URL in `DATABASE_URL`; production migrations should prefer `DIRECT_URL`. The database name in examples is **`zigzag`**.
> `.env.local` overrides `.env` for the app, Playwright, `drizzle-kit` and scripts (`scripts/load-env.cjs`). E2E mutates data, so run it only against a local or disposable database; `e2e/global-setup.ts` refuses a `*.neon.tech` URL unless `E2E_ALLOW_REMOTE_DB=1`.

## Architecture

### Multi-tenancy
Every resource (Ticket, Client, Service, User, Role, Permission) is scoped by `company_id`. All DB queries must filter by `company_id` explicitly; Drizzle does not enforce this automatically. Users with `company.is_system = true` are super-admins with explicit cross-company access.

### Two data-access layers
- **Server Actions** (`src/actions/`) are the **canonical** path for dashboard UI reads and all mutations on core resources (Tickets, Clients, Services, Users, Companies).
- **API Routes** (`src/app/api/`) are reserved for **non-UI consumers**: NextAuth, health checks, cron jobs, realtime/SSE, and binary/streaming downloads (ticket invoice PDF, company export bundles). Company operator sub-routes (logo upload, offboard, readiness, entitlements) remain REST where multipart or download semantics require them.

Do not add duplicate mutation handlers in API routes for resources that already have Server Actions. IDOR and RBAC coverage for tenant-owned CRUD lives in `src/lib/*-actions.test.ts` and `docs/idor-audit-matrix.md`.

### Authentication & session
- NextAuth v5 (beta) uses JWT sessions with a CredentialsProvider.
- Configured in `src/lib/auth.ts`.
- Session types are extended in `src/types/next-auth.d.ts` with `id`, `company_id`, `company_name`, and `company_is_system`.
- `src/proxy.ts` protects `/` and `/dashboard/**` at the routing edge. API routes are excluded from proxy and must call `auth()` or `requireSession()`.

### Company selection
`src/contexts/company-context.tsx` stores the selected company in React state and localStorage. This is separate from the session's `company_id`; system users can switch context between companies.

### Mi empresa hub (team and roles)
- Tenants manage their company at `/company` (layout `src/app/(app)/company/layout.tsx`): tabs **Datos** (`company.manage`), **Equipo** (`/company/equipo`, `users.read`) and **Roles** (`/company/roles`, `/company/roles/[id]`, `/company/roles/nuevo`, `roles.read`). Tab model in `src/lib/company-hub.ts`.
- Hub actions never take a company id: `src/actions/team.ts` and `src/actions/company-roles.ts` scope to the caller's company and write through the core `users.ts` / `roles.ts` actions.
- Roles are edited as a Ver/Editar matrix over the existing keys (`src/lib/role-matrix.ts`); keys outside the matrix are preserved. Shared global roles (`company_id` null) are copy-on-write: saving one creates a company-owned copy and moves that company's users onto it.
- Lockout guards in `src/lib/team-guards.ts`: nobody deactivates themselves (US006); a tenant never loses its last `users.write` / `roles.write` holder through a user or role change (US007, RL006); roles in use cannot be deleted (RL005).
- `/users`, `/roles`, `/permissions` (Catálogo de permisos) are system-operator pages: tenants are redirected to the hub (`redirectTenantToCompanyHub`) and the pages also call `requireSystemPage()`. The sidebar *Administración* group is empty, hence hidden, for tenants (`filterSystemNavItems`).

### Mobile & responsive UI
- Dashboard lists use **TanStack Table** on desktop and **card layout** below `md` (768px). See [.cursor/rules/lists-and-responsive-tables.mdc](.cursor/rules/lists-and-responsive-tables.mdc).
- **List filters below `lg`:** dense filters open in a bottom Sheet via `ListFilterBarShell` (`src/components/list-filter/`); search + chips stay outside. Resource bars: `*-filter-bar.tsx` (tickets, clients, services, companies, etc.).
- Breakpoint constant: `MOBILE_BREAKPOINT_PX` in `src/lib/breakpoints.ts`; hook: `src/hooks/use-mobile.tsx`.
- Sidebar renders as a **sheet** on narrow viewports (`src/components/ui/sidebar.tsx`).
- **Mobile dock:** floating liquid-glass dock (`src/components/mobile-bottom-dock.tsx`) with Hoy · Tickets · + · Presupuestos · Más; tabs and + actions come from `MOBILE_TAB_ITEMS` / `MOBILE_CREATE_ACTIONS` in `src/lib/nav-items.ts`. Glass recipes live in `src/components/toolbar-glass.ts` + `.liquid-glass*` in `globals.css`; content clears the dock via `--dock-clearance` (`src/lib/ui/dock-clearance.ts`), so pages never add their own bottom padding for it.
- **Buttons are always `<Button>`** (default variant = solid blue `bg-primary`). No inline gradients on buttons; `src/lib/no-purple-gradients.test.ts` fails on `to-purple-` / `to-violet-` / `from-blue-600 to-`. Shared motion primitives (`BlurFade`, `NumberTicker`, `BottomSheet`, `ActionSwap`) live in `src/components/motion/` and respect `prefers-reduced-motion`.
- **PWA:** `src/app/manifest.ts` — `start_url` `/dashboard`, icons under `public/icons/` (plus `src/app/{favicon.ico,icon.png,icon.svg,apple-icon.png}`, `public/logo.png`, `public/brand/`), all built from `assets/brand/` by `npm run icons:generate`; never edit the outputs by hand. Production service worker (`@serwist/turbopack`) caches the app shell only; Ticket/Client/Service **reads** require network. Field **offline job create/edit** uses IndexedDB + outbox (`src/lib/field-jobs/`, see `tasks/prd-offline-first-jobs.md`).
- Mobile initiative PRDs and status: [tasks/INDEX.md](tasks/INDEX.md), [tasks/prd-mobile-program-decisions.md](tasks/prd-mobile-program-decisions.md). Manual release checklist: [tasks/mobile-release-checklist.md](tasks/mobile-release-checklist.md). E2E: `npm run test:e2e` (desktop + `mobile-chrome` Pixel 5); mobile-only: `npm run test:e2e:mobile`.

### Document lines and materials
- A ticket or presupuesto line is a `ServicesTickets` row: a catalog line (`service_id` set, reads the Service) or an inline line (`service_id` null, its own `name`/`description`, ZIG-I5). Line input union and limits: `src/lib/ticket-service-line-schema.ts`; inserts go through `insertServiceLines` (`src/lib/service-lines-server.ts`); readers use `src/lib/service-line-display.ts`.
- **Materiales (ZIG-I10, migration 0029):** `Material` is the company catalog (name unique per company among active rows, case-insensitive; no page yet). `ServiceMaterial` holds a catalog Service's default materials (quantity, price override; null = catalog price), edited in the Servicios form. `TicketLineMaterial` rows hang under one `ServicesTickets` line and are **snapshots** (name, unit, quantity, price copied on save; `material_id` null = inline material with the Nuevo chip).
- **Money rule (ZIG-I12):** `roundMoney` rounds to cents through `toFixed(6)` (no relative epsilon: it used to add cents above ~$5M). Every amount is rounded **per line and per material** and the total is the sum of those rounded amounts (`sumLineTotals`, `sumMaterialTotals`, `lineTotalWithMaterials`), so what a document prints always adds up and the composer, `syncTicketTotal` and the PDF agree. The PDF payload prints stored values; it never recomputes totals with float math. **Total cap:** `Ticket.total` is numeric(12,2), so a document total above `MAX_TICKET_TOTAL` ($9,999,999,999.99) is refused with `TC011` before it reaches Postgres (`assertTicketTotalWithinCap`); line limits live in `src/lib/composer-limits.ts` and mirror the Zod schemas. Service quantities take two decimals (0.01–9,999.99, `ServicesTickets.quantity` numeric(10,2) since migration 0030). Server validation failures return `issues[]` (line + field) that the composer marks.
- **Pricing rule:** line amount = `quantity × price` + Σ `material.quantity × material.price`. Material quantities are absolute for the line (not multiplied by the service quantity). `syncTicketTotal` sums active materials of active lines, so Ticket `total`, Cobranza and the PDF follow. Helpers: `lineTotalWithMaterials` / `sumMaterialTotals` in `src/lib/money.ts`.
- Catalog material ids are always checked against the caller's company (`loadCatalogMaterials`); Guardar en mi catálogo finds or creates the Material by name in the same transaction (`findOrCreateMaterial`). `updateServiceTicket` replaces a line's whole material set when `materials` is sent; conversion copies materials with the lines. Materials are not in Anotar/offline capture or the services CSV.

### PDF invoices
- Generated on demand on the server: `GET /api/tickets/[id]/invoice`.
- Design 2a, the only layout for every tenant: spec in [docs/pdf-design-2a/](docs/pdf-design-2a/README.md) (`README.md` measurements, `receipt-template.html` reference, `sample-data.json`).
- Code in `src/lib/receipt-pdf/` (server-only): `payload.ts` (`buildReceiptPdfPayload` → `ReceiptPdfPayload`), `render.ts` (`renderReceiptPdf`, jsPDF, US Letter), `layout.ts` (every measurement, in CSS px), `fonts/` (IBM Plex from `assets/fonts/ibm-plex/`; regenerate with `npm run pdf-fonts:generate`). Unit tests read the text layer with `src/test/pdf-text.ts` and write fixture PDFs to `test-results/pdf/`.
- Rules (pinned in Plania, ZIG-I11): no IVA row and no CFDI note; a presupuesto prints no Estado (meta column 3 is the concept count, big figure *Total del presupuesto*); a recibo keeps the Estado pill (*Pendiente de pago* / *Pago parcial* / *Pagado*) and *Saldo por pagar*. ZIG-I12: `work_notes` print as a *Notas* / *Condiciones y notas* block under the totals; rows grow instead of clamping; emoji and other glyphs the Plex fonts lack are stripped (`src/lib/pdf-text-support.ts`, checked against the font files) and the composer warns; table cells drop the currency code when 10-digit amounts would crowd Concepto. Materials (ZIG-I10) print as `· Nombre` sub-rows under their concept, with *Servicios* / *Materiales* totals rows only when a document has materials. The company tagline is `settings.tagline` (*Lema o giro*, max 60) from Mi empresa › Datos › Configuración.
- Deliberate deviations from the HTML reference: no kerning (jsPDF), the big figure stacks label over value when both do not fit the 280px panel, numeric columns grow (16px air) for wide amounts, and the colophon (`Página n de N`) is on every page while the footer is last-page only.
- Fidelity check: fill `docs/pdf-design-2a/receipt-template.html` with `sample-data.json`, screenshot it in Chromium at 816×1056, and overlay it on the PDF rasterized at 96 dpi (`pdftoppm -r 96`); positions match to ≤1px except kerning.
- UI download: `src/components/pdf-download-button.tsx` (must not accept uploaded PDFs in production).

### BigInt IDs
`Ticket.id` and `User.id` are BigInt in Drizzle. Convert them before JSON responses with `convertBigIntToString()` from `src/lib/utils.ts`, or a route-local transform helper.

### Delete behavior
- **Soft delete** (`deleted_at` timestamp): User, Company, Ticket, Permission, Client, Service.
- **Role** currently has `deleted_at` but is still hard-deleted in some flows; treat this as a schema/model decision to normalize.
- Always filter soft-deleted resources with `deleted_at: null` / `isNull(model.deleted_at)`.

### Error handling
- API routes should use `ok()`, `fail()`, `requireSession()`, and `requireApiPermission()` from `src/lib/api-helpers.ts` where RBAC applies.
- Server actions should use `handleServerActionError()` or the established `{ success, data?, error?, errorType? }` shape.
- User-facing codes: `src/lib/error-catalog.ts` (55 codes).

### Observability
- `src/proxy.ts` sets `x-request-id` on app and API requests/responses (generated if absent).
- `requireActionAuth` / `requireSession` bind the id into request context so `logger` and `captureException` include `requestId` automatically.
- `/api/health` returns `requestId` in JSON for smoke-test correlation. See [docs/observability.md](docs/observability.md).

### Production constraints
- Drizzle is the only schema, migration, and seed workflow.
- PDF files are generated on demand from ticket data; production routes must not accept uploaded PDFs.
- Ticket payments and status changes require immutable audit events in `TicketAuditEvent`.

## Key files

| File | Purpose |
|------|---------|
| `src/db/schema.ts` | Drizzle schema and row types |
| `drizzle/` | SQL migrations applied by Drizzle |
| `drizzle.config.ts` | Drizzle Kit configuration |
| `src/lib/db.ts` | Drizzle database client singleton |
| `src/lib/auth.ts` | NextAuth config, JWT/session callbacks |
| `src/lib/errors.ts` | Error classes and API/action error handlers |
| `src/lib/security.ts` | Input sanitization, rate limiter, permission checks |
| `src/lib/api-helpers.ts` | API response and DB-backed session helpers |
| `src/proxy.ts` | Route protection |
| `src/contexts/company-context.tsx` | Selected company state + localStorage |
| `scripts/seed.ts` | Initial Drizzle seed data |

## Agent skills

Configuration for PRD/issue skills (`start-work`, `prd`, `to-prd`, `to-issues`, `implement-issue`, `fix-bug`, `ship-feature`, `release`, `validate-issues`). Full workflow: [docs/agents/workflow.md](docs/agents/workflow.md). **Branches:** [docs/agents/deployment.md](docs/agents/deployment.md): `sandbox` is the integration branch; slice PRs → `feat/<slug>` → `sandbox`; only Jorge merges `sandbox` → `main` (production).

### Issue tracker

GitHub Issues on **Jorg3L3on/zigzag** via the `gh` CLI. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

Canonical roles map 1:1 to GitHub labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) plus optional `type:*` labels. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Single-context: **AGENTS.md** (this file) is the primary domain/architecture reference; optional `CONTEXT.md` and `docs/adr/` later. See [docs/agents/domain.md](docs/agents/domain.md).

Dashboard list pages (TanStack table + mobile cards): [.cursor/rules/lists-and-responsive-tables.mdc](.cursor/rules/lists-and-responsive-tables.mdc).

### Deployment (Vercel)

**`main` = production** (only branch Vercel builds; see `git.deploymentEnabled` in `vercel.json`). **`sandbox`** is the integration branch: initiatives branch `feat/<slug>` off `sandbox`, slice PRs merge into `feat/<slug>` (agents squash-merge once CI is green), and the final PR goes **`feat/<slug>` → `sandbox`**; standalone fixes PR straight into `sandbox`. Agents open but never merge PRs into `sandbox`, and never target `main`: **only Jorge merges `sandbox` → `main`**. Nothing below `main` gets a preview deploy, so verify locally. Ports 3069 and 3071 are Jorge's dev servers; agents use 3072+. See [docs/agents/deployment.md](docs/agents/deployment.md).

## Cursor Cloud specific instructions

### Services overview

ZigZag is a multi-tenant ticket management / invoicing app. The only required service is **PostgreSQL 16** (local) and the **Next.js dev server** (`npm run dev`, port 3069).

### Non-obvious gotchas

- **PostgreSQL must be started manually**: Run `sudo pg_ctlcluster 16 main start` before any DB commands. The database name is `zigzag`.
- **Seed user passwords**: The seed script uses pre-existing bcrypt hashes whose plaintext is unknown. To log in locally, update a user's password hash in the DB after seeding: `node -e "require('bcryptjs').hash('YOUR_PASSWORD', 10).then(h => console.log(h))"` then `UPDATE "User" SET password = '<hash>' WHERE email = '<email>';`.
- **Migration guards**: `drizzle.config.ts` refuses `migrate`, `push` and `studio` against a non-local database unless `ALLOW_REMOTE_DB_MIGRATE=1` (Vercel builds and GitHub Actions are exempt), because drizzle-kit loads `.env` (production Neon) before `.env.local`. To migrate the local copy: `DATABASE_URL="$(grep ^DATABASE_URL= .env.local | cut -d= -f2-)" npm run db:migrate`. CI also runs `npm run check:migrations` on PRs: a migration with `DROP TABLE/COLUMN`, `TRUNCATE`, `DELETE FROM`, `UPDATE ... SET` or a column type change fails unless it carries `-- data-loss-ok: <reason>`.
- **DB setup sequence**: After starting PostgreSQL, run `npm run db:migrate` then `npm run seed`. Use `npx drizzle-kit push --force` only if migrations fail to apply cleanly.
