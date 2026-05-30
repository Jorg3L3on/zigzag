# Error Handling

## Error Classes (`src/lib/errors.ts`)

```typescript
class AppError extends Error {
  constructor(message: string, public statusCode: number) { ... }
}
class NotFoundError extends AppError { constructor(msg) { super(msg, 404) } }
class UnauthorizedError extends AppError { constructor(msg) { super(msg, 401) } }
class ValidationError extends AppError { constructor(msg) { super(msg, 400) } }
```

## API Route Handler

```typescript
import { handleApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    // ...
  } catch (err) {
    return handleApiError(err);  // returns NextResponse with correct status code
  }
}
```

`handleApiError` maps known `AppError` subclasses to their HTTP status codes. Unknown errors return 500.

## Server Action Handler

```typescript
import { handleServerActionError } from '@/lib/errors';

export async function createTicket(data) {
  try {
    // ...
    return { success: true, data: ticket };
  } catch (err) {
    return handleServerActionError(err);  // returns { success: false, error: string }
  }
}
```

## Security (`src/lib/security.ts`)

### Rate Limiting
```typescript
import { rateLimit } from '@/lib/security';
// Returns { success: boolean } — check before processing
const limit = rateLimit(req);
if (!limit.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
```

### Input Sanitization
```typescript
import { sanitizeInput } from '@/lib/security';
const cleanName = sanitizeInput(rawName);  // strips dangerous chars
```

### Permission Check
```typescript
import { checkPermission } from '@/lib/security';
const allowed = await checkPermission(session.user.id, companyId, 'tickets.write');
```

## Common Patterns

### Soft-delete guard
```typescript
const item = await db.query.ticket.findFirst({
  where: and(
    eq(ticket.id, id),
    eq(ticket.company_id, companyId),
    isNull(ticket.deleted_at),
  ),
});
if (!item) throw new NotFoundError('Ticket not found');
```

### Unauthorised guard
```typescript
const session = await auth();
if (!session) throw new UnauthorizedError('Login required');
```
