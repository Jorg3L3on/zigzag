# Multi-Tenancy

## Model

Every resource is scoped by `company_id`. The tenant root is the `Company` model.

All models that carry `company_id`:
- `Service`, `Client`, `Ticket`, `Role`, `Permission`, `User`

`Company` itself has no parent — it is the root.

## Querying Rules

**Always** add `company_id` to every Drizzle query over tenant data. There is no global filter — if you forget, users see other tenants' data.

```typescript
// ✅ Correct
const tickets = await db.query.ticket.findMany({
  where: and(
    eq(ticket.company_id, session.user.company_id),
    isNull(ticket.deleted_at),
  ),
});

// ❌ Wrong — leaks cross-tenant data
const tickets = await db.query.ticket.findMany();
```

## System Users (Super-admins)

A user whose company has `is_system = true` is a super-admin. They can:
- Read/write data across all companies
- Access company management pages at `/dashboard/companies`

Check in API routes:
```typescript
const isSystem = session.user.company_is_system;
const companyFilter = isSystem ? {} : { company_id: session.user.company_id };
```

## Company Context (UI)

`src/contexts/company-context.tsx` provides a React context that system users use to switch between companies without logging out. It stores the selected company in `localStorage` under the key `selectedCompany`.

```typescript
const { selectedCompany, setSelectedCompany } = useCompany();
```

The `selectedCompany` is used in component-level queries and forms, while `session.user.company_id` is the user's own company (used in JWT-protected server logic).

## Creating Resources

When creating any resource, always assign `company_id`:
```typescript
await db.insert(client).values({
  name,
  email,
  company_id: session.user.company_id,
});
```

## Soft-Delete Filter

When `deleted_at` is used, always include `deleted_at: null` alongside `company_id`:
```typescript
where: { company_id: companyId, deleted_at: null }
```
