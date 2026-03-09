# Database Schema

Database: MySQL. ORM: Prisma 6. Client output: `src/generated/prisma`.

## Models

### Company

Tenant root. Every other model has `company_id → Company.id`.

| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | |
| name | String (unique) | |
| address | String | |
| phone | String | |
| email | String | |
| logo | String? | |
| is_system | Boolean | `true` = super-admin tenant |
| created_at | DateTime | |
| updated_at | DateTime? | |
| deleted_at | DateTime? | soft delete |

### User

| Field | Type | Notes |
|-------|------|-------|
| id | **BigInt** (PK) | Requires `convertBigIntToString()` for JSON |
| name | String | |
| email | String (unique) | |
| password | String | bcrypt hash |
| company_id | Int? | FK → Company |
| role_id | Int? | FK → Role |
| deleted_at | DateTime? | soft delete |

### Ticket

| Field | Type | Notes |
|-------|------|-------|
| id | **BigInt** (PK) | Requires `convertBigIntToString()` for JSON |
| client_id | Int? | FK → Client |
| client_name | String? | denormalised copy |
| client_tel | String? | |
| ticket_date | DateTime? | |
| total | Float? | |
| email | String? | |
| finished | Boolean | default false |
| document | String? | |
| company_id | Int? | FK → Company |
| userId | BigInt? | FK → User (assigned tech) |
| deleted_at | DateTime? | soft delete |

### Client

| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | |
| name | String | |
| email | String? | |
| phone | String? | |
| document | String? | |
| address | String? | |
| company_id | Int? | FK → Company |
| deleted_at | DateTime? | soft delete (filtered but hard-delete in some routes) |

### Service

| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | |
| name | String | |
| description | String | |
| price | Float | |
| company_id | Int? | FK → Company |
| deleted_at | DateTime? | present but not consistently used |

### ServicesTickets (join table)

Links services to tickets. **No `sub_total` field** — writing it causes a runtime crash.

| Field | Type |
|-------|------|
| id | Int (PK) |
| service_id | Int → Service |
| ticket_id | BigInt → Ticket |
| quantity | Int |
| price | Float |

### Role

| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | |
| name | String (unique) | |
| description | String? | |
| company_id | Int? | FK → Company |
| deleted_at | DateTime? | present but hard-deleted via `.delete()` |

### Permission

| Field | Type | Notes |
|-------|------|-------|
| id | Int (PK) | |
| name | String (unique) | |
| description | String? | |
| company_id | Int? | FK → Company |
| deleted_at | DateTime? | soft delete |

### RolePermission (join table)

Composite PK `(role_id, permission_id)`. No soft delete.

## Deletion Strategy

| Model | Strategy |
|-------|----------|
| Company, User, Ticket, Permission | Soft delete — filter `deleted_at: null` |
| Role, Client, Service | Hard delete — use Prisma `.delete()` |

## BigInt Serialisation

`Ticket.id` and `User.id` are `BigInt`. JavaScript's `JSON.stringify` throws on BigInt.
Always call `convertBigIntToString()` from `src/lib/utils.ts` before returning data from API routes.

## Multi-tenancy Queries

Always add `where: { company_id: session.company_id, deleted_at: null }` to every query. Prisma does NOT enforce this automatically.
