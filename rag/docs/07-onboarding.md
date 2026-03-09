# Developer Onboarding

## Prerequisites

- Node.js 18+
- MySQL 8+ (local or Docker)
- npm

## First-time Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Edit .env — set your database connection
#    DATABASE_URL="mysql://user:password@localhost:3306/tickets"
#    NEXTAUTH_SECRET="any-random-string"
#    NEXTAUTH_URL="http://localhost:3000"

# 4. Run database migrations
npx prisma migrate dev

# 5. Generate the Prisma client (output: src/generated/prisma)
npx prisma generate

# 6. Seed initial data
npm run seed

# 7. Start the dev server
npm run dev
```

App runs at http://localhost:3000.

## Key Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string |
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
# Make changes to prisma/schema.prisma, then:
npx prisma migrate dev --name describe-your-change
npx prisma generate   # regenerates src/generated/prisma
```

Always regenerate after schema changes — the app imports from `src/generated/prisma`, not `node_modules`.

## Adding a New Feature

1. Add/update the Prisma model if needed → migrate → generate
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
