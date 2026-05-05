# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Next.js with Turbopack
npm run build        # Production build
npm run lint         # ESLint

# Database
npx prisma migrate dev          # Run pending migrations
npx prisma migrate dev --name <name>  # Create + run a new migration
npx prisma generate             # Regenerate client after schema changes
npm run seed                    # Seed the database (ts-node)

# Testing
npm test                        # Run all Jest tests
npm run test:watch              # Watch mode
npm run test:coverage           # Coverage report
npm run test:e2e                # Playwright E2E (no tests written yet)
```

> **Note:** The Prisma client is generated to `src/generated/prisma` (not the default `node_modules`). Always run `npx prisma generate` after schema changes.
>
> **Database:** PostgreSQL. Use a `postgresql://...` URL in `DATABASE_URL` (see `.env.example`).

## Architecture

### Multi-tenancy
Every resource (Ticket, Client, Service, User, Role, Permission) is scoped by `company_id`. All DB queries must filter by `company_id` explicitly — Prisma does not enforce this automatically. Users with `company.is_system = true` are super-admins with cross-company access.

### Two data-access layers (both exist — this is intentional)
- **Server Actions** (`src/actions/`) — used by client components via `'use server'`. These are the primary way UI pages mutate data.
- **API Routes** (`src/app/api/`) — RESTful endpoints, used by some components and available for external access.

Several resources (clients, users, services, tickets) have logic in both layers. When editing, be careful not to fix one and miss the other.

### Authentication & session
- NextAuth v5 (beta) with `strategy: 'jwt'` and a `CredentialsProvider`.
- Configured in `src/lib/auth.ts`. The `auth()` helper is used both in middleware and API routes.
- Session extends the default NextAuth type (see `src/types/next-auth.d.ts`): adds `id`, `company_id`, `company_name`, `company_is_system`.
- `src/middleware.ts` protects `/` and `/dashboard/**`. API routes (`/api/**`) are **excluded** from middleware and must call `auth()` themselves.

### Company selection (client-side)
`src/contexts/company-context.tsx` holds the currently selected company in React state and persists it to `localStorage`. Components read from `useCompany()`. This is separate from the session's `company_id` — system users can switch context between companies.

### BigInt IDs
`Ticket.id` and `User.id` are `BigInt` in the Prisma schema. This causes JSON serialization errors unless converted. Use `convertBigIntToString()` from `src/lib/utils.ts` before returning data from API routes, or the `transformBigInt()` helper inside `src/app/api/users/route.ts`.

### Soft delete vs hard delete
Not all models use the same deletion strategy:
- **Soft delete** (`deleted_at` timestamp): User, Company, Ticket, Permission. Always filter with `deleted_at: null`.
- **Hard delete** (`.delete()`): Role, Client, Service.

### Error handling
- API routes should use `handleApiError()` from `src/lib/errors.ts`.
- Server actions should use `handleServerActionError()`. The standard return shape is `{ success: boolean, data?, error? }`, though some older actions return `{ user }` or throw directly — this is inconsistent.

### Known active bug
`src/actions/tickets.ts:146` attempts to write `sub_total` when creating `ServicesTickets` records, but that field does not exist in the Prisma schema. Any call to `updateTicket()` with services will fail at runtime.

## Key files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth config, JWT/session callbacks |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/errors.ts` | Error classes and API/action error handlers |
| `src/lib/security.ts` | Rate limiter, input sanitization, permission check (⚠️ `checkPermission` always returns `true`) |
| `src/lib/cache.ts` | Cache utilities (defined but not yet used in actions) |
| `src/middleware.ts` | Route protection |
| `src/contexts/company-context.tsx` | Selected company state + localStorage |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Initial data |
