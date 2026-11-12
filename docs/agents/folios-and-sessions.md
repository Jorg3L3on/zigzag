# Company folios and sessions (ZIG-I17)

## Folios

- Presupuestos are numbered `P-0001`, tickets and recibos `R-0001`, per company and per document kind.
- `Ticket.folio_number` and `Ticket.folio_prefix` are a snapshot taken when the document is created. Changing the prefix in Mi empresa only affects new documents.
- `DocumentFolioCounter (company_id, document_kind, last_number)` hands out numbers. The allocator (`src/lib/folio-allocator.ts`) runs inside the same transaction as the insert, so a rollback gives the number back and two creations at once never share one. A unique index on `(company_id, document_kind, folio_number)` is the safety net.
- Numbers never restart and are never reused. Deleted documents keep theirs.
- A recibo created by converting a presupuesto shows its own `R` folio everywhere: lists, detail, recibo page, PDF and its file name, WhatsApp (ZIG-I26-2, replacing ZIG-I17 Q1). The detail links back with «Desde presupuesto P-0006» and the PDF prints «Presupuesto P-0006» under Estado (`formatSourcePresupuestoFolio`).
- Search accepts `R-0034`, `r34`, `34` or `0034`.
- Rows without a folio (none exist after migration 0032) display as `#id`.

### Neon rollout (migration 0032)

1. Migration `0032_company_folios.sql` is additive and idempotent (`IF NOT EXISTS`, `ON CONFLICT`). It adds two nullable columns, the counter table and a partial unique index, then numbers existing rows by creation order and seeds the counters.
2. It is applied by `npm run vercel-build` (`migrate:deploy`) when `sandbox` is promoted to `main`. Do not run it by hand against Neon.
3. Check after the deploy:

```sql
SELECT count(*) FROM "Ticket" WHERE company_id IS NOT NULL AND folio_number IS NULL;  -- expect 0
SELECT c.company_id, c.document_kind, c.last_number, max(t.folio_number)
FROM "DocumentFolioCounter" c
JOIN "Ticket" t ON t.company_id = c.company_id AND t.document_kind = c.document_kind
GROUP BY 1, 2, 3 HAVING c.last_number < max(t.folio_number);                           -- expect no rows
```

4. Rollback: the columns and table are unused by older code, so reverting the app is enough. Do not drop them.

## Sessions

- Normal sign-in: 8 hours. "Mantener mi sesión en este dispositivo": 30 days, every role (`src/lib/session-policy.ts`).
- The cookie lives 30 days; the token carries the real expiry (custom `jwt.encode` in `src/lib/auth.ts`).
- The app renews a normal session in its last 15 minutes and a remembered one once a day, and warns in the last 5 minutes if it could not renew (`SessionKeepAlive`).
- Mi cuenta › Cerrar sesión en todos mis dispositivos bumps `token_version`, which invalidates every token of the user.
- Not built: PIN unlock (optional in the plan, won't do for now).

## Tests

- `npm test` covers the helpers, the session policy, real Auth.js tokens (day 29 valid, day 31 rejected) and the revoked-session login.
- `FOLIO_DB_TEST=1 DATABASE_URL=... npx jest src/lib/folio-allocator.db.test.ts src/actions/folio-flow.db.test.ts` runs the counter and the full create → convert → create flow in a fresh company against a migrated Postgres.
