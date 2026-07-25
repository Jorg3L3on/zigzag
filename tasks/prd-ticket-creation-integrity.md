# Ticket creation integrity hardening

**Published:** #254

**Status:** Planned — audit documented; slices not yet implemented

**Audit:** [docs/ticket-creation-integrity-audit.md](../docs/ticket-creation-integrity-audit.md)

**Slices:**

| Issue | Title |
| ----- | ----- |
| #255 | Assert client tenant + soft-delete on ticket create/update |
| #256 | Runtime zod validation for ticket service line qty/price |
| #257 | Harden finishTicket: concurrency lock + reject empty tickets |
| #258 | Align Ticket.client_tel with Client.phone and create contracts |
| #259 | Audit + dashboard cache on ticket service-line mutations |
| #260 | Page-level tickets.write RBAC + E2E negative coverage pack |

## Problem Statement

Zigzag operators create tickets through a multi-step flow: client shell → service lines → finish → invoice PDF. A production-class money bug showed that finish trusted a client-supplied total and soft-deleted lines could still affect invoices. That hole is closed, but the create path still has integrity gaps that UI gates do not stop: cross-tenant `client_id` attachment on create, unvalidated service line quantities/prices, finish races that can double-record payments, schema length mismatches that fail after a “valid” client save, and missing audit/cache updates when line items change.

Users and reviewers need the create → finish path to be fail-closed on tenant and money rules, with automated tests that would catch the next totals lie before production.

## Solution

Run a ticket-creation integrity epic: document the living audit matrix, then ship thin AFK slices that harden Server Actions, align schema/validation contracts, restore audit and cache correctness for service lines, add page-level write RBAC, and expand unit/E2E negative coverage. Keep the two-step wizard; do not redesign create into a single atomic form in this epic. Server remains the authority for totals; active service lines only.

## User Stories

### Tenant and client integrity

1. As a non-system user, I want ticket create to reject a `client_id` that belongs to another Company, so that tickets cannot attach foreign clients.
2. As a non-system user, I want ticket create/update to reject soft-deleted clients, so that deleted clients cannot reappear on new tickets.
3. As a non-system user, I want ticket update to apply the same client ownership checks as create, so that edits cannot introduce a cross-tenant client link.

### Service line money integrity

4. As a tickets writer, I want service line create to reject non-finite, negative, or zero quantity, so that totals cannot be corrupted by forged payloads.
5. As a tickets writer, I want service line create/update to reject negative or non-finite prices, so that revenue math stays non-negative unless product explicitly allows otherwise.
6. As a tickets writer, I want successful line create/update/delete to sync the ticket total from active lines only, so that list and detail totals match the invoice.

### Finish integrity

7. As a tickets writer, I want finish to ignore any client-supplied total and persist the server-synced total, so that the UI cannot lie about money (regression gate).
8. As a tickets writer, I want concurrent finish attempts to produce at most one finished state and one initial payment row, so that double-clicks cannot duplicate money history.
9. As a tickets writer, I want finish to reject tickets with zero active service lines, so that empty shells cannot be finalized via a direct action call.

### Schema and validation contracts

10. As a tickets writer, I want `Ticket.client_tel` to accept the same phone lengths as `Client.phone`, so that creating a ticket from a valid client does not fail at the database.
11. As a maintainer, I want create validation to stop pretending to accept a `services` array that is never persisted, so that the create contract matches the two-step wizard.
12. As a tickets writer, I want server zod limits for phone/email/date to match database column limits and not be weaker than the UI, so that form success equals persist success.

### Audit and cache

13. As a system auditor, I want service line create/update/delete to record ticket audit events, so that money-changing edits are investigable.
14. As a dashboard user, I want metrics cache to invalidate when service lines change ticket totals, so that KPIs are not stale after line edits.
15. As a maintainer, I want the audit coverage matrix to describe Server Action line mutations (not deleted REST routes), so that docs match production.

### Access and regression coverage

16. As a viewer without `tickets.write`, I want create/edit/services write pages to deny access at the page edge, so that I cannot open write chrome via direct URL.
17. As a maintainer, I want unit tests for client-tenant denial, bad qty/price rejection, empty finish rejection, and finish idempotency, so that P0 holes cannot reopen quietly.
18. As a maintainer, I want E2E negative coverage for viewer direct create URL and create-from-long-phone client where feasible, so that UI↔server contracts stay aligned.
19. As a reviewer, I want the living ticket-creation integrity audit matrix updated as each slice closes, so that open vs fixed status is always visible.

## Implementation Decisions

- Keep the two-step wizard (shell ticket, then services, then finish). Do not atomically create lines inside `createTicket` in this epic unless a slice explicitly chooses to drop the dead `services` field from the create schema instead.
- Add a shared server helper to assert an active client belongs to the effective company before create/update ticket writes that include `client_id`.
- Add shared zod schemas for service line quantity/price used by create and update service-ticket actions; reject with coded validation errors.
- Harden `finishTicket` with the same class of concurrency control already used for payments (advisory lock and/or conditional `finished = false` update). Reject finish when active line count is zero.
- Align `Ticket.client_tel` length with `Client.phone` via Drizzle migration; tighten zod max lengths to match columns.
- Emit ticket audit events for service-line mutations; invalidate company dashboard cache on those mutations.
- Gate write pages with page-level `tickets.write` (or existing page permission helper), matching list-page read gating patterns.
- Living audit matrix stays at `docs/ticket-creation-integrity-audit.md`; update status/test evidence per slice.
- Epic integration: prefer slice PRs to `feat/ticket-creation-integrity` if shipping as a multi-PR feature; single-slice bugfix-style PRs to `main` are acceptable for P0-only hotfixes if a maintainer chooses that path later.

## Testing Decisions

- Good tests assert external behavior: `{ success: false }` / error codes for bad payloads and cross-tenant client ids; persisted total equals sum of active lines; second concurrent finish does not create a second payment.
- Modules under test: ticket Server Actions, ticket-services Server Actions, ticket-financials, invoice payload (regression gates already present).
- Prior art: `src/lib/tickets-actions.test.ts`, `src/lib/ticket-services-actions.test.ts`, `src/lib/ticket-financials.test.ts`, `src/lib/fintech-invoice-payload.test.ts`, `e2e/core-flow.spec.ts`, `e2e/rbac.spec.ts`.
- Do not test implementation details of lock acquisition; test observable single-finish / single-payment outcomes.
- E2E: extend RBAC/mobile-or-desktop packs for direct URL denial and contract bugs that only appear through the wizard; keep happy-path core-flow green.

## Out of Scope

- Redesigning create into a single atomic multi-service submit.
- Migrating money columns to integer cents / decimal types (separate roadmap item).
- Offline / PWA ticket create sync.
- Auto soft-deleting abandoned shell tickets on a TTL (may be a later product slice; documenting TCI-09 is enough here).
- Changing invoice visual layout beyond integrity of line inclusion and totals.
- Re-opening the broader IDOR epic; this epic complements it with create-path money/contract holes IDOR did not cover.

## Further Notes

- Finding IDs TCI-01…TCI-14 live in the audit matrix; each slice must close its mapped IDs or leave an explicit residual note.
- Regression gates RG-01…RG-04 (finish ignores client total; soft-deleted lines excluded from reads/invoice/sync) must remain green in every slice PR.
- Related: commit `9a9ca2f`, `docs/idor-audit-matrix.md`, `docs/audit-coverage-matrix.md`, `docs/production-readiness-roadmap.md` money notes.
