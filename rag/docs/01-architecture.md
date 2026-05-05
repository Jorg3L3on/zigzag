# Project Architecture

## Overview

tickets2.0 is a multi-tenant ticket management system built with:

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM (client generated to `src/generated/prisma`)
- **Auth**: NextAuth v5 (beta) with JWT strategy
- **UI**: Tailwind CSS + Radix UI + shadcn/ui components
- **Validation**: Zod + React Hook Form

## Two Data-Access Layers

The project intentionally has two parallel layers for mutating data:

### Server Actions (`src/actions/`)

- Used by client components via the `'use server'` directive
- Primary way for UI pages to mutate data
- Files: `tickets.ts`, `clients.ts`, `users.ts`, `services.ts`, `roles.ts`, `permissions.ts`
- Return shape: `{ success: boolean, data?, error? }` (some older ones return `{ user }` or throw)

### API Routes (`src/app/api/`)

- RESTful endpoints available for external consumers
- Used by some components directly
- Endpoints: `/api/auth`, `/api/clients`, `/api/companies`, `/api/services`, `/api/tickets`, `/api/users`, `/api/upload`
- Must call `auth()` themselves — middleware does NOT protect them

When editing logic, always check both layers. A bug in one often exists in the other.

## Folder Structure

``` txt
src/
├── actions/          # Server actions ('use server')
├── app/
│   ├── api/          # REST API routes
│   ├── dashboard/    # Protected pages (account, clients, companies, permissions, roles, services, tickets, users)
│   └── login/        # Public auth page
├── components/
│   ├── account/      # Account management
│   ├── clients/      # Client CRUD UI
│   ├── modals/       # Shared modal dialogs
│   ├── pdf/          # PDF generation
│   ├── services/     # Service CRUD UI
│   ├── tickets/      # Ticket CRUD UI
│   └── ui/           # Base Radix UI / shadcn components
├── contexts/         # React contexts (company-context)
├── generated/prisma/ # Auto-generated Prisma client (DO NOT EDIT)
├── hooks/            # Custom React hooks
├── lib/              # Core utilities
│   ├── auth.ts       # NextAuth config
│   ├── cache.ts      # Cache utilities (defined, not yet used in actions)
│   ├── db.ts         # Prisma singleton
│   ├── errors.ts     # Error classes and handlers
│   ├── security.ts   # Rate limiter, input sanitization, checkPermission
│   └── utils.ts      # General utilities incl. convertBigIntToString
└── types/            # TypeScript type extensions
```

## Middleware

`src/middleware.ts` protects `/` and `/dashboard/**` routes. API routes (`/api/**`) are excluded and must protect themselves by calling `auth()`.

## Key Conventions

- All IDs use `company_id` for tenant scoping
- `Ticket.id` and `User.id` are `BigInt` — must call `convertBigIntToString()` before JSON serialisation
- Prisma client lives at `src/generated/prisma`, not `node_modules/@prisma/client`
- Run `npx prisma generate` after any schema change
