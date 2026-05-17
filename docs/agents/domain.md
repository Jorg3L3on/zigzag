# Domain docs

How agents and contributors should consume Zigzag's domain documentation.

## Layout (single-context)

This repo uses a **single-context** layout:

- **[AGENTS.md](../../AGENTS.md)** — canonical architecture, multi-tenancy, auth, data-access patterns, and key file map. **Read this first** before implementing features.
- **`docs/adr/`** — reserved for Architecture Decision Records (add ADRs here as decisions are made).
- **`CONTEXT.md`** — optional future glossary; if added, prefer terms already used in AGENTS.md and the UI (Spanish product copy may differ from code identifiers).

There is no `CONTEXT-MAP.md` (not a multi-context monorepo).

## Before exploring code

1. Read **AGENTS.md** (Architecture + Production constraints).
2. Skim **`src/db/schema.ts`** for entities touched by the feature.
3. Check **`docs/adr/`** for decisions in the area you are changing (if any exist).

Do not block on missing `CONTEXT.md` or ADRs — proceed and note gaps if terminology is unclear.

## Vocabulary (use in issues and PRs)

| Term | Meaning |
| ---- | ------- |
| **Company** | Tenant; almost all data is scoped by `company_id` |
| **System company** | `company.is_system = true`; super-admin cross-tenant access |
| **Ticket** | Core work item; `Ticket.id` is `BigInt` |
| **Client / Service** | Catalog entities under a company |
| **Server Action** | Primary UI mutation path under `src/actions/` |
| **API route** | REST under `src/app/api/`; must call auth helpers |
| **Soft delete** | `deleted_at` set; always filter `deleted_at IS NULL` |
| **Ticket audit event** | Immutable log for payments and status changes |

Use these terms in issue titles and acceptance criteria instead of inventing synonyms.

## Flag ADR conflicts

If a proposal contradicts an existing ADR (or a hard rule in AGENTS.md, e.g. tenant scoping, audit events), call it out explicitly rather than silently overriding.
