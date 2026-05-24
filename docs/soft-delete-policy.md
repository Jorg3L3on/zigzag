# Soft Delete Policy

ZigZag treats business resources as soft-delete rows unless this document
classifies them otherwise. Soft-deleted rows set `deleted_at` and should also
set `updated_at` when the table has that column. Reads and mutations must filter
`deleted_at IS NULL` unless they intentionally expose deleted records for an
admin or audit workflow.

## Soft-Delete Resources

- `Company`
- `User`
- `Role`
- `Permission`
- `Client`
- `Service`
- `Ticket`
- `ServicesTickets`

Nested relation responses should not leak soft-deleted related rows. If a
related row is deleted, map the relation to `null` or filter it from the nested
collection.

## Exceptions

`TicketPayment` and `TicketAuditEvent` are immutable historical records. They do
not have delete application flows and should not get soft-delete behavior unless
the audit model changes.

`RolePermission` is a join table without `deleted_at`. It is hard-deleted when a
role's permission set changes or when a permission is deleted. On role soft
delete, `RolePermission` rows are preserved as historical assignment rows; auth
checks must ignore permissions granted through a soft-deleted role.
