# Database Schema

Database: PostgreSQL. ORM: Drizzle. Canonical schema: `src/db/schema.ts`.
SQL migrations live in `drizzle/` and are generated with `npm run db:generate`.

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
| id | **BigInt** (PK) | API `ok()` responses serialize BigInt through `convertBigIntToString()` |
| name | String | |
| email | String (unique) | |
| password | String | bcrypt hash |
| company_id | Int? | FK → Company |
| role_id | Int? | FK → Role |
| deleted_at | DateTime? | soft delete |

### Ticket

| Field | Type | Notes |
|-------|------|-------|
| id | **BigInt** (PK) | API `ok()` responses serialize BigInt through `convertBigIntToString()` |
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
| Role | Currently has `deleted_at`, but some flows still hard delete; normalize as a schema/model decision |
| Client, Service | Soft delete in current primary flows; verify both actions and API routes when touching delete behavior |

## BigInt Serialisation

`Ticket.id` and `User.id` are `BigInt`. JavaScript's `JSON.stringify` throws on BigInt.
API success responses should go through `ok()` from `src/lib/api-helpers.ts`, which calls `convertBigIntToString()` from `src/lib/utils.ts`.

## Multi-tenancy Queries

Always add `company_id` and `deleted_at` filters to Drizzle queries. Drizzle does NOT enforce tenant scope automatically.
