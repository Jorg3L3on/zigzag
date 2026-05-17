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
| Slice PRs merge here | `feat/<feature-slug>` | **Preview** (per merge) |
| Release when PRD done | One PR: `feat/…` → `main` | **Production** (once) |

Agents open slice PRs **into the integration branch**, never into `main`.

## Who does what

| Action | Who |
| ------ | --- |
| Create `feat/<slug>` from latest `main` | `ship-feature` (start of pipeline) |
| Slice PR: `feat/<issue#>-…` → PR → `feat/<slug>` | `implement-issue` |
| Merge each slice PR | **You** (preview deploy on `feat/<slug>`) |
| Final PR `feat/<slug>` → `main` | Agent **opens**; **you merge** (one prod deploy) |
| `vercel deploy --prod` / `vercel promote` | **You**, only if explicitly requested |

Agents must **never** merge to `main` or run production deploy commands.

## Per PRD: how many prod deploys?

| Action | Count |
| ------ | ----- |
| Merge slice PRs into `feat/<slug>` | ~1 per user story (preview) |
| Merge `feat/<slug>` → `main` | **1** (production) |

Example: mobile UI/UX, 5 slices → 5 preview deploys on the feature branch, **1** prod deploy when you ship the feature PR.

## Migrations

- **Slices:** usually no production migration until schema changes; test against dev/preview DB.
- **Before merging `feat/…` → `main`:** run `npm run migrate:deploy` against the **production** database if the feature includes schema changes.

## Optional: team-wide `develop` branch

If you prefer a shared integration branch instead of per-feature branches:

- Slice PRs → `develop` (previews)
- Release: `develop` → `main` when a release batch is ready

`ship-feature` defaults to **per-feature** `feat/<slug>` so unrelated work does not block releases.

## Vercel settings

Keep **Production Branch = `main`**. No separate `production` branch required.

PR previews for slice PRs still get PR preview URLs; the feature branch also gets branch preview URLs on push/merge.
