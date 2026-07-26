# Deployment (Vercel)

Zigzag keeps **`main` as the production branch** on Vercel. A merge to `main` deploys production.

Slice work from **`ship-feature`** must **not** merge to `main` until the whole PRD is ready.

## Strategy: feature integration branch

For each PRD / feature, use one long-lived integration branch:

```text
feat/<feature-slug>   e.g. feat/mobile-ui-ux
```

| Step | Branch | Vercel |
| ---- | ------ | ------ |
| Slice PRs merge here | `feat/<feature-slug>` | **No deploy** (previews disabled) |
| Release when PRD done | One PR: `feat/…` → `main` | **Production** (once) |

Agents open slice PRs **into the integration branch**, never into `main`.

Smoke-test slices **locally** (`npm run lint`, `npm test`, `npm run build`, Playwright as needed) before merging into `feat/<slug>`, and again before the final PR to `main`.

## Who does what

| Action | Who |
| ------ | --- |
| Create `feat/<slug>` from latest `main` | `ship-feature` (start of pipeline) |
| Slice PR: `feat/<issue#>-…` → PR → `feat/<slug>` | `implement-issue` |
| Merge each slice PR | **You** (no Vercel preview; verify locally) |
| Final PR `feat/<slug>` → `main` | Agent **opens**; **you merge** (one prod deploy) |
| `vercel deploy --prod` / `vercel promote` | **You**, only if explicitly requested |

Agents must **never** merge to `main` or run production deploy commands.

## Per PRD: how many prod deploys?

| Action | Count |
| ------ | ----- |
| Merge slice PRs into `feat/<slug>` | No Vercel deploy |
| Merge `feat/<slug>` → `main` | **1** (production) |

Example: mobile UI/UX, 5 slices → local verification on the feature branch, **1** prod deploy when you ship the feature PR to `main`.

## Migrations

Production schema changes are applied automatically during **Vercel production builds** (`scripts/vercel-build.mjs` runs `npm run migrate:deploy` when `VERCEL_ENV=production`). Requires `DATABASE_URL` and preferably `DIRECT_URL` in Vercel **Production** environment variables.

| Context | Behavior |
| ------- | -------- |
| Vercel **production** (`main` deploy) | `migrate:deploy` → `next build` |
| Other Git branches / PRs | **Not built** on Vercel (`git.deploymentEnabled` in `vercel.json`) |
| Local / CI | `npm run db:migrate` (dev DB) |

**Manual fallback:** [`.github/workflows/migrate-production.yml`](../.github/workflows/migrate-production.yml) (`workflow_dispatch`). Add GitHub repository secrets `DATABASE_URL` and `DIRECT_URL` matching production Neon.

**Before merging `feat/…` → `main`:** confirm migration SQL is committed under `drizzle/` and journal updated. Production apply happens on the next Vercel production deploy after merge.

## Optional: team-wide `develop` branch

If you prefer a shared integration branch instead of per-feature branches:

- Slice PRs → `develop` (no Vercel deploy unless you change `vercel.json`)
- Release: `develop` → `main` when a release batch is ready

`ship-feature` defaults to **per-feature** `feat/<slug>` so unrelated work does not block releases.

## Vercel settings

Keep **Production Branch = `main`**. No separate `production` branch required.

### Git deploys (main only)

`vercel.json` disables automatic deployments for every branch except `main`:

```json
"git": {
  "deploymentEnabled": {
    "*": false,
    "main": true
  }
}
```

Pushes to `feat/*`, other branches, and PR preview deployments do **not** run. To re-enable previews later, remove or adjust `git.deploymentEnabled` and update this doc.

### Production env (high level)

See [`.env.production.example`](../../.env.production.example) and [production-runbook.md](../production-runbook.md). In particular:

- **`BLOB_READ_WRITE_TOKEN`** from a **public** Vercel Blob store (company logos; private stores reject public uploads)
- **`CRON_SECRET`** for `/api/cron/notifications`
