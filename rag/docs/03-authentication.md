# Authentication & Session

## Stack

- **Library**: NextAuth v5 (`next-auth@5.0.0-beta.31`)
- **Strategy**: JWT (no database sessions)
- **Provider**: `CredentialsProvider` (email + password)
- **Config file**: `src/lib/auth.ts`

## Session Shape

The default NextAuth session is extended in `src/types/next-auth.d.ts`:

```typescript
interface Session {
  user: {
    id: string;            // User.id as string (BigInt → string)
    name: string;
    email: string;
    company_id: number;
    company_name: string;
    company_is_system: boolean;
  }
}
```

The extra fields are populated in the `jwt` and `session` callbacks inside `src/lib/auth.ts`.

## Login Flow

1. User submits email + password to `CredentialsProvider`
2. Provider queries DB for user by email with `deleted_at: null`
3. Password verified with `bcryptjs.compare()`
4. On success: JWT created with `id`, `company_id`, `company_name`, `company_is_system`
5. On failure: returns `null` (NextAuth renders the error)

## Accessing the Session

### Server components / API routes
```typescript
import { auth } from '@/lib/auth';
const session = await auth();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const companyId = session.user.company_id;
```

### Client components
```typescript
import { useSession } from 'next-auth/react';
const { data: session } = useSession();
```

## Route Protection

`src/proxy.ts` protects:
- `/` → redirects to `/dashboard`
- `/dashboard/**` → requires valid session

**API routes (`/api/**`) are NOT protected by proxy.** Each API route handler must call `requireSession()` or `requireApiPermission()`.

## Super-Admin Access

If `session.user.company_is_system === true`, the user belongs to the system company and can access data across all companies. Regular users can only see resources where `company_id = session.user.company_id`.

## Company Context (client-side)

`src/contexts/company-context.tsx` provides `useCompany()`. System users can switch the active company via this context without logging out. It persists the selected company to `localStorage`. This is separate from the JWT — it's a UI-level concept for switching views.
