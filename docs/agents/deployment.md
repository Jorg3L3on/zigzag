# Deployment (Vercel)

Zigzag keeps **`main` as the production branch** on Vercel. A merge to `main` deploys production, and **only Jorge merges into `main`**.

All work integrates on **`sandbox`** first. `sandbox` was created from `main` on 2026-10-08 and is the base of every initiative and fix. It is not deployed: Vercel builds only `main`.

## Strategy: `sandbox` + initiative branches

```text
main  ←  sandbox  ←  feat/<initiative-slug>  ←  slice/<ticket>-<slug>
(prod)   (integration)  (one per initiative)     (one per ticket / phase)
```

| Step | Branch / PR | Who merges | Vercel |
| ---- | ----------- | ---------- | ------ |
| Initiative branch | `feat/<slug>` created from latest `sandbox` | — | No deploy |
| Slice PR | `slice/…` → `feat/<slug>` | **Agent** (squash, once CI is green) | No deploy |
| Final initiative PR | `feat/<slug>` → `sandbox` | Agent opens, **Jorge merges** | No deploy |
| Standalone ticket or bug fix | `slice/…` or `jl/…` → `sandbox` | Agent opens, **Jorge merges** | No deploy |
| Release | `sandbox` → `main` | **Jorge only** | **Production** |

Rules for agents:

- Branch from **`sandbox`** (or the initiative's `feat/<slug>`), never from `main`.
- Never target, push to or merge into **`main`**. Never merge into **`sandbox`**: open the PR and leave the merge to Jorge.
- Merge your own slice PRs into `feat/<slug>` (squash) once CI is green.
- Verify locally before a PR leaves draft (`npm run lint`, `npm test -- --runInBand`, `npm run build`, Playwright as needed). Nothing below `main` gets a preview deploy.
- When `sandbox` moves while an initiative is open, merge `sandbox` into `feat/<slug>` (no rebase, no force-push).

The plan for each initiative and its tickets lives in Plania (project `zigzag`). Ticket keys go in branch names and PR titles (e.g. `slice/zig-08-dock-everywhere`, `… (ZIG-08)`).

## Who does what

| Action | Who |
| ------ | --- |
| Create `feat/<slug>` from latest `sandbox` | Agent (start of an initiative / `ship-feature`) |
| Slice PR → `feat/<slug>` | Agent opens and squash-merges once CI is green |
| Final PR `feat/<slug>` → `sandbox` | Agent **opens**; **Jorge merges** |
| Standalone fix PR → `sandbox` | Agent **opens**; **Jorge merges** |
| `sandbox` → `main` (production) | **Jorge** |
| `vercel deploy --prod` / `vercel promote` | **Jorge**, only if explicitly requested |

## How many prod deploys?

| Action | Production deploys |
| ------ | ------------------ |
| Merge slice PRs into `feat/<slug>` | 0 |
| Merge `feat/<slug>` or a fix into `sandbox` | 0 |
| Merge `sandbox` → `main` | **1** (everything merged into `sandbox` since the last release) |

## Local development

- Ports **3069** (`npm run dev`) and **3071** are Jorge's dev servers. Agents use another port (3072+) with `NEXTAUTH_URL` set to it, and never stop whatever holds 3069 or 3071.
- `.env` points at production Neon. Put a local database in `.env.local` (`DATABASE_URL=postgresql://…localhost…/zigzag`): the app, Playwright, `drizzle-kit` and `scripts/` read it first (see README → Setup). E2E refuses a Neon `DATABASE_URL`.

## Migrations

Production schema changes are applied automatically during **Vercel production builds** (`scripts/vercel-build.mjs` runs `npm run migrate:deploy` when `VERCEL_ENV=production`). Requires `DATABASE_URL` and preferably `DIRECT_URL` in Vercel **Production** environment variables.

| Context | Behavior |
| ------- | -------- |
| Vercel **production** (`main` deploy) | `migrate:deploy` → `next build` |
| Other Git branches / PRs | **Not built** on Vercel (`git.deploymentEnabled` in `vercel.json`) |
| Local / CI | `npm run db:migrate` (dev DB) |

**Manual fallback:** [`.github/workflows/migrate-production.yml`](../.github/workflows/migrate-production.yml) (`workflow_dispatch`). Add GitHub repository secrets `DATABASE_URL` and `DIRECT_URL` matching production Neon.

### Migration guards

Production holds a real client's data, so two guards protect it:

- **Remote-database guard** (`scripts/db-target-guard.cjs`, enforced in `drizzle.config.ts`). `drizzle-kit migrate`, `push` and `studio` refuse to run when the resolved URL (`DIRECT_URL`, else `DATABASE_URL`) is not localhost. This matters because drizzle-kit loads `.env` (production Neon) before `.env.local`, so a bare `npm run db:migrate` used to hit production. Exempt: Vercel builds (`VERCEL=1`) and GitHub Actions (`GITHUB_ACTIONS=true`), which are the sanctioned production paths. Override for one command with `ALLOW_REMOTE_DB_MIGRATE=1`, after taking a Neon snapshot. Migrate the local copy with `DATABASE_URL="$(grep ^DATABASE_URL= .env.local | cut -d= -f2-)" npm run db:migrate`.
- **Destructive-migration check** (`npm run check:migrations`, a CI step on pull requests). It scans migrations added or changed against the base branch and fails on `DROP TABLE`, `DROP COLUMN`, `DROP SCHEMA`, `TRUNCATE`, `DELETE FROM`, `UPDATE ... SET` and `ALTER COLUMN ... TYPE`. A migration that really needs one carries a line `-- data-loss-ok: <reason>`. Prefer additive changes: add the new column now, drop the old one in a later release, after a backup.

Before merging `sandbox` into `main` with a migration in it, take a Neon branch/snapshot of production: the Vercel build applies the migration as soon as `main` deploys.

**Before merging a migration into `sandbox`:** confirm the SQL is committed under `drizzle/` and listed in `drizzle/meta/_journal.json`. Production applies it on the next Vercel production deploy, i.e. when Jorge merges `sandbox` → `main`.

## Vercel settings

Keep **Production Branch = `main`**. No separate `production` branch required.

### Git deploys (main only)

Two layers (needed because open PRs may not include the latest `vercel.json` yet):

1. **`vercel.json`** — `git.deploymentEnabled` + `ignoreCommand` (only `main` builds).
2. **Project Ignored Build Step (required for immediate effect)** — Vercel Dashboard → Project **zigzag** → **Settings** → **Git** → **Ignored Build Step** → **Custom**:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then exit 0; else exit 1; fi
```

- Exit `0` = skip the build  
- Exit `1` = continue building  

This project setting applies to **every** branch/PR, including older Cursor branches that still lack the updated `vercel.json`. Without it, those PRs keep creating Preview deployments.

`vercel.json` snippet:

```json
"git": {
  "deploymentEnabled": {
    "*": false,
    "main": true,
    "sandbox": false
  }
},
"ignoreCommand": "bash -c 'if [ \"$VERCEL_GIT_COMMIT_REF\" = \"main\" ]; then exit 1; else exit 0; fi'"
```

To re-enable previews later, clear the Ignored Build Step and remove/adjust these fields.

### Production env (high level)

See [`.env.production.example`](../../.env.production.example) and [production-runbook.md](../production-runbook.md). In particular:

- **`BLOB_READ_WRITE_TOKEN`** from a **public** Vercel Blob store (company logos; private stores reject public uploads)
- **`CRON_SECRET`** for `/api/cron/notifications`
