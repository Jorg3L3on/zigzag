# Business Rules & Known Issues

> **Secondary context:** Prefer [AGENTS.md](../../AGENTS.md). Sections below were updated 2026-05-24.

## Ticket Lifecycle

1. **Create** — technician creates a ticket, optionally linking it to an existing `Client` or entering client details inline (`client_name`, `client_tel`)
2. **Add services** — one or more `Service` records are linked via `ServicesTickets`; `price` and `quantity` are stored per line
3. **Total** — `Ticket.total` is a stored Float (not computed by DB); the app must calculate it
4. **Finish** — `Ticket.finished = true` marks the job as done
5. **Delete** — soft delete: sets `deleted_at = now()`

## Permission System

Roles and permissions live in the DB (`Role`, `Permission`, `RolePermission`). `checkPermission()` in `src/lib/security.ts` enforces grants via `RolePermission`; system-company users bypass checks.

Missing permission definitions fail closed. Seed data must include every permission name used in code.

API routes should use `requireApiPermission()` from `src/lib/api-helpers.ts` where applicable.

## Company Access Rules

- Regular users: can only see resources where `company_id = their own company_id`
- System users (`company.is_system = true`): can access all companies
- Company management page (`/dashboard/companies`) is only meaningful for system users

## Client Denormalisation

`Ticket` stores both `client_id` (FK) and `client_name` / `client_tel` (strings). A ticket can be created without an existing `Client` record by filling in the name/tel strings directly. When a client is selected from the dropdown, those fields are also populated from the `Client` record.

## Soft-Delete Consistency

Not all code paths filter by `deleted_at: null`. When querying for a resource that supports soft delete, always add `deleted_at: null` to the where clause. Missing this causes "deleted" records to reappear.

## BigInt JSON Serialisation

`Ticket.id` and `User.id` are `BigInt`. API success responses should go through `ok()` from `src/lib/api-helpers.ts`:

```typescript
return ok(data);
```

## Cache Utilities

`src/lib/cache.ts` defines caching helpers but they are not yet used in any actions or routes. They are safe to adopt when performance becomes a concern.
