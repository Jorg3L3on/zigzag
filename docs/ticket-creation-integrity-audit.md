# Ticket creation integrity audit

Harsh review of the create → services → finish → invoice path after the money-integrity fix in commit [`9a9ca2f`](https://github.com/Jorg3L3on/zigzag/commit/9a9ca2f) (*keep ticket totals and invoice PDF aligned with active services*).

**Status:** open findings documented; hardening tracked in PRD `tasks/prd-ticket-creation-integrity.md` and parent issue [#254](https://github.com/Jorg3L3on/zigzag/issues/254).

**Related matrices:** [idor-audit-matrix.md](./idor-audit-matrix.md) (cross-tenant denial), [audit-coverage-matrix.md](./audit-coverage-matrix.md) (mutation audit events).

## Trigger

`finishTicket` previously trusted a client-supplied total, and soft-deleted service lines could still affect detail/invoice math. That class of bug is **money lying to the user**. This audit assumes UI gates are hostile and asks: what can a direct Server Action call still break in production?

## Flow (authoritative money rules)

```text
Create UI
  → createTicket          (Ticket shell; total usually null)
  → create/update/deleteServiceTicket
  → syncTicketTotal       (sum active ServicesTickets only)
  → finishTicket          (server total; optional initial TicketPayment)
  → invoice PDF           (active lines only)
```

**Rules that must remain true:**

1. Server owns totals. Never persist a client-supplied total as authoritative.
2. Only `ServicesTickets` rows with `deleted_at IS NULL` contribute to totals, detail, and invoice.
3. Tenant ownership (`company_id`) is checked on every write that touches client, service, or ticket references.
4. Soft-deleted clients/services/tickets are not writable or attachable.
5. Finish and payment mutations are concurrency-safe (no duplicate payments/audit from double submit).

## Mutation matrix

Legend: ✅ ok · 🟡 partial · ❌ gap · ⏭️ n/a

| Surface | Tenant check | Soft-delete | Runtime validation | Money source | Audit | Cache invalidate | Test evidence | Status |
| ------- | ------------ | ----------- | ------------------ | ------------ | ----- | ---------------- | ------------- | ------ |
| `createTicket` | ✅ company via write RBAC + **client_id company/soft-delete check** | ✅ ticket + client | 🟡 zod on shell fields; `services` validated then discarded | ⏭️ no total set | ✅ `created` | ✅ dashboard | IDOR company deny + **TCI-01 client assert** (`tickets-actions.test.ts`) | ✅ TCI-01 |
| `updateTicket` | ✅ ticket company + **client_id assert when provided** | ✅ ticket + client | 🟡 same zod family | ⏭️ | ✅ `updated` | ✅ | TCI-01 client assert on update | ✅ TCI-01 |
| `createServiceTicket` | ✅ ticket + service company | ✅ service not deleted | ✅ zod qty/price finite (TCI-02) | ✅ `syncTicketTotal` | ❌ none | ❌ path only | IDOR deny + **TCI-02 validation** | ✅ TCI-02 |
| `updateServiceTicket` | ✅ line under ticket | ✅ | ✅ zod qty/price finite (TCI-02) | ✅ sync | ❌ | ❌ path only | IDOR deny + TCI-02 | ✅ TCI-02 |
| `deleteServiceTicket` | ✅ | soft-delete line | ⏭️ | ✅ sync | ❌ | ❌ path only | IDOR deny | ❌ open |
| `finishTicket` | ✅ ticket company | ✅ | ✅ paid vs synced total; **≥1 active line**; **advisory lock + finished=false** | ✅ sync in tx; client total ignored | ✅ `finished` | ✅ | empty finish + concurrent finish + RG-01 | ✅ TCI-03/04 |
| `applyTicketPayment` | ✅ | ✅ | ✅ finite positive + advisory lock | balance vs total | ✅ | ✅ | covered | ✅ |
| Invoice `GET …/invoice` | ✅ | ✅ active lines | ⏭️ | payload from DB | ⏭️ | ⏭️ | soft-deleted lines excluded | ✅ |

## Regression gates (already fixed — must not regress)

| Gate | Requirement | Evidence |
| ---- | ----------- | -------- |
| RG-01 | `finishTicket` ignores client total; persists `syncTicketTotal` | `src/lib/tickets-actions.test.ts` |
| RG-02 | Ticket detail / list relations exclude soft-deleted service lines | `getTicketById` / list queries filter `deleted_at` |
| RG-03 | Invoice payload excludes soft-deleted lines | `src/lib/fintech-invoice-payload.test.ts` |
| RG-04 | `syncTicketTotal` sums only active lines | `src/lib/ticket-financials.test.ts` |

## Open findings

### P0 — money / tenant integrity

| ID | Finding | Evidence | Recommended fix direction |
| -- | ------- | -------- | ------------------------- |
| TCI-01 | `createTicket` does not verify `client_id` belongs to the ticket `company_id` or is non-deleted. Cross-tenant client attachment is possible via a forged action payload. | `src/actions/tickets.ts` `createTicket` inserts parsed `client_id` with no client lookup | **Closed in #255** — `assertClientBelongsToCompany` on create/update; tests in `src/lib/tickets-actions.test.ts` |
| TCI-02 | Service line `quantity` / `price` have no runtime zod. Negative, NaN, or non-finite values can write and corrupt totals/KPIs. | `src/actions/ticket-services.ts` `CreateServiceTicketData` / `UpdateServiceTicketData` are TypeScript-only | **Closed in #256** — `serviceLineMoneySchema` / `createServiceTicketSchema`; `TS006`; tests in `ticket-services-actions.test.ts` |
| TCI-03 | `finishTicket` race: `finished` checked outside the transaction; UPDATE does not require `finished = false`. Concurrent finishes can double-insert `TicketPayment` and `finished` audit rows. | `finishTicket` vs `applyTicketPayment` (advisory lock) | **Closed in #257** — `ticketFinish` advisory lock + `finished = false` UPDATE; 0-row → TC006 |
| TCI-04 | Server can finalize an empty ticket (synced total `0`, paid `0`) if called directly. UI disables the button only. | UI gate in services/edit client; `finishTicket` has no “≥1 active line” rule | **Closed in #257** — reject zero active lines (TC009) |

### P1 — schema / contract drift

| ID | Finding | Evidence | Recommended fix direction |
| -- | ------- | -------- | ------------------------- |
| TCI-05 | `Client.phone` is up to 20 chars; `Ticket.client_tel` is `varchar(10)`. Creating a ticket from a valid long phone can fail at DB length. | `src/db/schema.ts` | Widen `client_tel` to match Client (migration) + zod max length |
| TCI-06 | `ticketSchema.services` is validated then discarded; create never attaches lines or sets total. Shell tickets with `total = null` are the happy path of a two-step wizard — but the schema lies about accepting services. | `ticketSchema` vs `createTicket` insert | Drop unused `services` from create schema **or** document two-step wizard explicitly and stop validating a dead field |
| TCI-07 | UI vs server vs DB rule drift (dates, phone, email lengths). | Create page form vs `ticketSchema` vs column lengths | Align zod with DB column limits; keep UI ≤ server rules |
| TCI-08 | Service-line mutations do not write ticket/unified audit. Coverage matrix still documents deleted REST ticket-service routes. | `ticket-services.ts`; `docs/audit-coverage-matrix.md` | Record audit on create/update/delete line; fix matrix to Server Actions |

### P2 — operational / UX integrity

| ID | Finding | Notes | Recommended fix direction |
| -- | ------- | ----- | ------------------------- |
| TCI-09 | Abandoned shell tickets (`total = null`, no lines) pollute lists/dashboard | Two-step wizard by design | Product: filter/badge unfinished shells; optional TTL soft-delete later |
| TCI-10 | Dashboard cache not invalidated on service-line mutations | `revalidatePath` only | `invalidateCompanyCache(companyId, 'dashboard')` after line writes |
| TCI-11 | Create / edit / services pages lack page-level `tickets.write` gate | Viewer can open chrome via direct URL; actions fail later | `requirePagePermission('tickets.write')` (or equivalent) on write pages |
| TCI-12 | Double-submit / no idempotency on create and add-service | React `isSubmitting` only | Disable + optional idempotency key; rely on finish lock (TCI-03) for finalize |
| TCI-13 | Currency display inconsistency (services step vs detail vs company default) | Formatting helpers diverge | Single formatter with company `default_currency` |
| TCI-14 | Test gaps: no success-path create; no client-tenant assert; no qty/price rejection; no finish race; E2E missing empty-finish / long phone / viewer direct URL | `tickets-actions.test.ts`, e2e core-flow | Expand unit + negative E2E pack in hardening slices |

## Reviewer checklist (“Do not trust UI”)

When reviewing ticket create/finish PRs:

- [ ] Totals come only from `syncTicketTotal` / active lines — never from request body.
- [ ] Every foreign key the client supplies (`client_id`, `service_id`, ticket id) is checked for **same company** and **not soft-deleted**.
- [ ] Money fields are runtime-validated (finite, non-negative where required, quantity ≥ 1).
- [ ] Finish/payment paths are concurrency-safe (lock or conditional update).
- [ ] Soft-deleted lines cannot appear in detail, list aggregates, or invoice PDF.
- [ ] Mutations that change money write audit events.
- [ ] Dashboard/company cache invalidation matches money mutations.
- [ ] New behavior has a unit test that would have caught the last regression (`9a9ca2f` class).

## Slice mapping

| Issue | Slice | Findings |
| ----- | ----- | -------- |
| #255 | Client tenant assert on create/update | TCI-01 |
| #256 | Runtime zod for service lines | TCI-02 |
| #257 | Finish hardening (lock + non-empty) | TCI-03, TCI-04 |
| #258 | Align `client_tel` / contract drift | TCI-05, TCI-06, TCI-07 |
| #259 | Audit + dashboard cache on line mutations | TCI-08, TCI-10 |
| #260 | Page write RBAC + E2E negative pack | TCI-11, TCI-12, TCI-14 (+ optional TCI-09/13) |

## Maintenance

Update this matrix when a finding closes. Keep **Status** and **Test evidence** columns current. Do not mark P0 closed without an automated test that fails if the hole reopens.
