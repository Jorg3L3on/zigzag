# RAG docs — read this first

> **These files under `rag/docs/` are not the canonical source of truth.** They may lag behind `main`.
>
> **Use instead:** [AGENTS.md](../../AGENTS.md), [README.md](../../README.md), and [tasks/INDEX.md](../../tasks/INDEX.md).

Historical topics that should not be reintroduced:

- Prisma commands and `src/generated/prisma` → **Drizzle** (`src/db/schema.ts`, `npm run db:migrate`)
- `html2pdf` client PDF → **server** fintech invoice API
- `checkPermission()` always `true` → enforced via DB and fails closed when permission definitions are missing
- `sub_total` on `ServicesTickets` → removed; totals via `ticket-financials`

Re-run `npm run rag:index` after editing any file here.
