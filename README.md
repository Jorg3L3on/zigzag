# ZigZag — Ticket Management System

Multi-tenant ticket management built with **Next.js 16**, **Drizzle ORM**, and **PostgreSQL**.

## Features

- Multi-tenant data isolation by company
- Role-based permissions
- Tickets, clients, and service catalog
- Dashboard metrics and on-demand PDF export
- UI with shadcn/ui and Tailwind CSS

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack dev on port **3069**) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | NextAuth v5 (Credentials, JWT sessions) |
| Forms | React Hook Form + Zod |
| Tests | Jest, React Testing Library, Playwright (`e2e/`) |

## Prerequisites

- **Node.js 20.9+**
- **PostgreSQL 14+** (local, Docker, or hosted)
- npm

## Getting started

```bash
git clone https://github.com/Jorg3L3on/zigzag.git
cd zigzag
npm install
```

Copy [`.env.example`](.env.example) to `.env` (or `.env.local`) and set at least:

- `DATABASE_URL` — PostgreSQL URL (database name **`zigzag`** in examples)
- `DIRECT_URL` — optional locally; use Neon direct URL in production for migrations
- `NEXTAUTH_URL` — `http://localhost:3069` for local dev
- `NEXTAUTH_SECRET` or `AUTH_SECRET` — random secret (`openssl rand -base64 32`)

```bash
npm run db:generate   # after schema changes in src/db/schema.ts
npm run db:migrate    # apply migrations
npm run seed          # optional seed data
npm run dev           # http://localhost:3069
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (Turbopack, port 3069) |
| `npm run build` | Production build |
| `npm start` | Production server (port 3069) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate SQL migrations |
| `npm run db:migrate` | Apply migrations locally |
| `npm run migrate:deploy` | Apply migrations in production (`DIRECT_URL` when set) |
| `npm run db:studio` | Drizzle Studio |
| `npm run seed` | Seed via `scripts/seed.ts` |
| `npm run db:prod:setup` | `migrate:deploy` + seed (first-time prod only) |
| `npm test` | Jest unit/integration tests |
| `npm run test:watch` | Jest watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run test:e2e` | Playwright E2E tests |

## Project layout

```
src/
├── actions/       # Server Actions (primary mutations)
├── app/           # App Router pages and API routes
├── components/    # UI components
├── contexts/      # React context (e.g. company selection)
├── db/            # Drizzle schema
├── lib/           # Auth, DB client, errors, security
├── proxy.ts       # Route protection for / and /dashboard/**
└── types/
drizzle/           # SQL migrations
scripts/seed.ts    # Seed script
docs/              # Production runbook and ops notes
```

Contributor and architecture details: **[AGENTS.md](AGENTS.md)**. PRD → issues → PR workflow: **[docs/agents/workflow.md](docs/agents/workflow.md)** · **[CONTRIBUTING.md](CONTRIBUTING.md)**.

Optional RAG tooling over internal docs: **[rag/README.md](rag/README.md)** (`npm run rag:index`, `rag:search`, `rag:ask`).

## Testing

```bash
npm test
npm run test:e2e
```

CI-style Jest: `npm test -- --runInBand`.

## Mobile & PWA

Install ZigZag on a phone or tablet for quick access from the home screen. After install, the app opens on the **Dashboard** (`/dashboard`). If your session expired, sign in again.

**Internet required:** There is no offline mode in the current version. You need a network connection to load and save data (no service worker or offline sync).

### Español

**Instalar en iPhone (Safari)**

1. Abre ZigZag en Safari.
2. Toca **Compartir** → **Añadir a pantalla de inicio**.
3. Confirma el nombre **ZigZag** y toca **Añadir**.

**Instalar en Android (Chrome)**

1. Abre ZigZag en Chrome.
2. Toca el menú → **Instalar app** o **Añadir a pantalla de inicio** (según el dispositivo).
3. Confirma la instalación.

Tras instalar, la app abre en el **Panel** (`/dashboard`). Si la sesión expiró, inicia sesión de nuevo.

**Probar en la red local (opcional):** con `npm run dev` en el puerto **3069**, abre `http://<tu-ip>:3069` desde el teléfono en la misma Wi‑Fi.

### English

**Install on iPhone (Safari)**

1. Open ZigZag in Safari.
2. Tap **Share** → **Add to Home Screen**.
3. Confirm the name **ZigZag** and tap **Add**.

**Install on Android (Chrome)**

1. Open ZigZag in Chrome.
2. Tap the menu → **Install app** or **Add to home screen** (wording varies by device).
3. Confirm the install.

After install, the app opens on the **Dashboard** (`/dashboard`). Sign in again if your session expired.

**Test on your LAN (optional):** with `npm run dev` on port **3069**, open `http://<your-ip>:3069` from your phone on the same Wi‑Fi.

## Deployment (Vercel + Neon)

Use [`.env.production.example`](.env.production.example) for production variables. Full checklist, rollback, and incidents: **[docs/production-runbook.md](docs/production-runbook.md)**.

Summary:

1. Set `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` / `AUTH_SECRET` in Vercel.
2. Run `npm run migrate:deploy` against the target database before or as part of first deploy.
3. Optionally run `npm run db:prod:setup` once for seed data.
4. Deploy; `vercel.json` uses `npm run vercel-build` (`next build`).
5. Smoke-test `/api/health`, login, and a clients/services/tickets flow.

Pre-deploy locally: `npm run lint`, `npm test`, `npm run build`.

## Troubleshooting

| Issue | Check |
|-------|--------|
| DB connection | `DATABASE_URL`, Postgres running, database `zigzag` exists |
| Auth / redirects | `NEXTAUTH_URL` matches deployed URL; secret is set |
| Build | `rm -rf .next` and reinstall `node_modules` if needed |
| Migrations | Run `npm run migrate:deploy` with `DIRECT_URL` set |

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Jorge León.
