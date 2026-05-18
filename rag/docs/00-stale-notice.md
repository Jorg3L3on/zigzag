# RAG docs — read this first

> **These files under `rag/docs/` are not the canonical source of truth.** They may lag behind `main`.
>
> **Use instead:** [AGENTS.md](../../AGENTS.md), [README.md](../../README.md), and [tasks/INDEX.md](../../tasks/INDEX.md).

Common outdated topics in older chunks:

- Prisma commands and `src/generated/prisma` → **Drizzle** (`src/db/schema.ts`, `npm run db:migrate`)
- `html2pdf` client PDF → **server** fintech invoice API
- `checkPermission()` always `true` → enforced via DB; `ALLOW_MISSING_PERMISSIONS` escape hatch for dev only
- `sub_total` on `ServicesTickets` → removed; totals via `ticket-financials`

Re-run `npm run rag:index` after editing any file here.
