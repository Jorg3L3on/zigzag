# Business Rules & Known Issues

## Ticket Lifecycle

1. **Create** — technician creates a ticket, optionally linking it to an existing `Client` or entering client details inline (`client_name`, `client_tel`)
2. **Add services** — one or more `Service` records are linked via `ServicesTickets`; `price` and `quantity` are stored per line
3. **Total** — `Ticket.total` is a stored Float (not computed by DB); the app must calculate it
4. **Finish** — `Ticket.finished = true` marks the job as done
5. **Delete** — soft delete: sets `deleted_at = now()`

## Known Active Bug

**`src/actions/tickets.ts:146`** — The `updateTicket` server action attempts to write a `sub_total` field to `ServicesTickets` records:

```typescript
// ❌ Bug: sub_total does not exist in the Prisma schema / DB
await prisma.servicesTickets.create({
  data: { service_id, ticket_id, quantity, price, sub_total },  // crashes
});
```

Any call to `updateTicket()` with services will fail at runtime with a Prisma validation error.

**Fix**: Remove `sub_total` from the `data` object. The total should be computed as `quantity * price` at the application layer and stored in `Ticket.total`.

## Permission System

Roles and permissions exist in the DB (`Role`, `Permission`, `RolePermission`), but `checkPermission()` in `src/lib/security.ts` **always returns `true`**. The permission check is not yet enforced. Any UI showing/hiding based on permissions is informational only.

## Company Access Rules

- Regular users: can only see resources where `company_id = their own company_id`
- System users (`company.is_system = true`): can access all companies
- Company management page (`/dashboard/companies`) is only meaningful for system users

## Client Denormalisation

`Ticket` stores both `client_id` (FK) and `client_name` / `client_tel` (strings). A ticket can be created without an existing `Client` record by filling in the name/tel strings directly. When a client is selected from the dropdown, those fields are also populated from the `Client` record.

## Soft-Delete Consistency

Not all code paths filter by `deleted_at: null`. When querying for a resource that supports soft delete, always add `deleted_at: null` to the where clause. Missing this causes "deleted" records to reappear.

## BigInt JSON Serialisation

`Ticket.id` and `User.id` are `BigInt`. Always convert before returning from API routes:

```typescript
import { convertBigIntToString } from '@/lib/utils';
return NextResponse.json(convertBigIntToString(data));
```

Or use the `transformBigInt()` helper in `src/app/api/users/route.ts`.

## Cache Utilities

`src/lib/cache.ts` defines caching helpers but they are not yet used in any actions or routes. They are safe to adopt when performance becomes a concern.
