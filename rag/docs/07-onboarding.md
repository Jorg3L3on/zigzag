# Developer Onboarding

> **Canonical reference:** [README.md](../../README.md) and [AGENTS.md](../../AGENTS.md). Commands below use **Drizzle**, not Prisma.

## Prerequisites

- Node.js 20.9+
- PostgreSQL 14+ (local or Docker)
- npm

## First-time Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Edit .env — set your database connection
#    DATABASE_URL="postgresql://user:password@localhost:5432/zigzag"
#    NEXTAUTH_SECRET="any-random-string"
#    NEXTAUTH_URL="http://localhost:3069"

# 4. Generate migrations (after schema changes) and apply
npm run db:generate   # only when src/db/schema.ts changed
npm run db:migrate

# 5. Seed initial data
npm run seed

# 7. Start the dev server
npm run dev
```

App runs at http://localhost:3069 (see `package.json` dev script port).

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://...`) |
| `NEXTAUTH_SECRET` | Random string for JWT signing |
| `NEXTAUTH_URL` | Base URL of the app |
| `ANTHROPIC_API_KEY` | For RAG question answering (optional) |

## Daily Development Commands

```bash
npm run dev           # Start with Turbopack hot reload
npm run lint          # ESLint check
npm test              # Jest unit tests
npm run test:watch    # Jest in watch mode
npm run test:coverage # Coverage report
```

## Database Changes

```bash
# Edit src/db/schema.ts, then:
npm run db:generate   # writes SQL under drizzle/
npm run db:migrate    # apply locally
```

Production: `npm run migrate:deploy` (uses `DIRECT_URL` when set).

## Adding a New Feature

1. Add/update the Drizzle schema in `src/db/schema.ts` → generate → migrate
2. Add a **server action** in `src/actions/` for UI mutations
3. Add an **API route** in `src/app/api/` if external access is needed
4. Always scope queries by `company_id`
5. Use `handleApiError` / `handleServerActionError` for error handling
6. For BigInt fields, call `convertBigIntToString()` before JSON response

## Project Conventions

- Components: `src/components/<feature>/` — Radix + Tailwind, shadcn style
- Forms: React Hook Form + Zod validation
- Toasts: `sonner` library via `toast.success()` / `toast.error()`
- Tables: `@tanstack/react-table`
