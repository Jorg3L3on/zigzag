# API Routes & Server Actions

## API Routes (`src/app/api/`)

RESTful endpoints. Each is a standard Next.js Route Handler (`route.ts`).

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth handlers |
| `/api/clients` | GET, POST, PUT, DELETE | Client CRUD |
| `/api/companies` | GET, POST, PUT, DELETE | Company management (system only) |
| `/api/services` | GET, POST, PUT, DELETE | Service CRUD |
| `/api/tickets` | GET, POST, PUT, DELETE | Ticket CRUD |
| `/api/users` | GET, POST, PUT, DELETE | User management |
| `/api/upload` | POST | File/logo upload |

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await prisma.model.findMany({
      where: { company_id: session.user.company_id, deleted_at: null },
    });

    return NextResponse.json({ data: convertBigIntToString(data) });
  } catch (err) {
    return handleApiError(err);
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
import { auth } from '@/lib/auth';
import { handleServerActionError } from '@/lib/errors';

export async function createClient(data: ClientInput) {
  try {
    const session = await auth();
    if (!session) throw new Error('Unauthorized');

    const client = await prisma.client.create({
      data: { ...data, company_id: session.user.company_id },
    });

    return { success: true, data: client };
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
