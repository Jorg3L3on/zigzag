# API Routes & Server Actions

## API Routes (`src/app/api/`)

RESTful endpoints. Each is a standard Next.js Route Handler (`route.ts`).

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth handlers |
| `/api/clients`, `/api/clients/[clientId]` | GET, POST, PUT, DELETE | Client CRUD |
| `/api/companies` | GET, POST, PUT | Company management |
| `/api/services`, `/api/services/[id]` | GET, POST, PUT, DELETE | Service CRUD |
| `/api/tickets/[id]` | GET | Ticket detail |
| `/api/tickets/[id]/invoice` | GET | Server-generated invoice PDF |
| `/api/tickets/[id]/services` | GET, POST | Ticket service lines |
| `/api/tickets/[id]/services/[serviceId]` | PUT, DELETE | Ticket service line updates |
| `/api/users` | GET, POST | User management |

### API Route Pattern

```typescript
import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { ticket } from '@/db/schema';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { unauthorized, companyId } = await requireApiPermission('tickets.read');
    if (unauthorized || !companyId) return unauthorized;

    const data = await db.query.ticket.findMany({
      where: and(eq(ticket.company_id, companyId), isNull(ticket.deleted_at)),
    });

    return ok(data);
  } catch (err) {
    return fail('GN001', 500, 'server');
  }
}
```

## Server Actions (`src/actions/`)

Used by client components via `'use server'`. Preferred for mutations from UI.

| File | Purpose |
|------|---------|
| `tickets.ts` | createTicket, updateTicket, deleteTicket |
| `clients.ts` | createClient, updateClient, deleteClient |
| `users.ts` | createUser, updateUser, deleteUser |
| `services.ts` | createService, updateService, deleteService |
| `roles.ts` | createRole, updateRole, deleteRole |
| `permissions.ts` | createPermission, updatePermission, deletePermission |

### Server Action Pattern

```typescript
'use server';
import { handleServerActionError } from '@/lib/errors';
import { requireActionPermission } from '@/lib/security';
import { db } from '@/lib/db';
import { client } from '@/db/schema';

export async function createClient(data: ClientInput) {
  try {
    const { companyId } = await requireActionPermission('clients.write');

    const [created] = await db.insert(client).values({
      ...data,
      company_id: companyId,
    }).returning();

    return { success: true, data: created };
  } catch (err) {
    return handleServerActionError(err);
  }
}
```

### Return Shape

Standard: `{ success: true, data: T }` or `{ success: false, error: string }`.

Some older actions return `{ user }` directly or throw — this is inconsistent and should be fixed when touched.

## When to Use Which

| Scenario | Use |
|----------|-----|
| UI form submission (create/update/delete) | Server Action |
| External system needs an endpoint | API Route |
| Complex query with streaming | API Route |
| Simple mutation from a button/form | Server Action |
