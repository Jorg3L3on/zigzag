---
name: ship-feature
description: >-
  Orchestrate a feature from PRD to merge-ready PRs on feat/<slug>. Always publishes a
  parent PRD GitHub issue, creates slice issues, implements slices, and opens the final
  feat/<slug> to sandbox PR. Only Jorge merges into sandbox and main. Use ship feature.
---

# Ship Feature

End-to-end automation for a feature PRD.

**`main` is production on Vercel; `sandbox` is the integration branch.** No PR from this pipeline targets `main`. See [docs/agents/deployment.md](../../docs/agents/deployment.md).

**Merges:**

1. The agent squash-merges each slice PR into `feat/<feature-slug>` once CI is green (no Vercel preview; verify locally).
2. **Jorge merges** the final PR **`feat/<slug>` → `sandbox`**; the agent opens it.
3. **Jorge** later releases `sandbox` → `main` (production).

Agents **never** merge into `sandbox` or `main`, and never push to them.

Read **`docs/agents/workflow.md`** and **`docs/agents/deployment.md`**.

## Integration branch

From PRD path: `tasks/prd-mobile-ui-ux.md` → branch **`feat/mobile-ui-ux`**.

Before first slice (after step 3):

```bash
git checkout sandbox && git pull
git checkout -b feat/<slug>
git push -u origin feat/<slug>
```

Pass **`INTEGRATION_BRANCH=feat/<slug>`** to every **`implement-issue`** call.

## Arguments

- `tasks/prd-<feature>.md` — typical entry
- Parent issue `#N` or URL — use existing parent; skip step 1 publish
- Feature name — locate PRD file or parent issue

Optional flags:

- `interactive` — `to-issues` quiz mode
- `from-issue #N` — skip breakdown; implement existing slices only
- `stop-after-issues` — stop after steps 1–3 (parent + slices + validate)
- `skip-parent-prd` — **discouraged**; only if parent `#N` is passed in the same message

## Pipeline

```text
to-prd (required)  →  to-issues --auto  →  validate-issues  →  feat/<slug>
  →  implement-issue × N  →  agent squash-merges each slice PR (CI green)
  →  open PR feat/<slug> → sandbox (required)  →  Jorge merges; later sandbox → main
```

### Step 1 — Parent PRD on GitHub (**required**)

**Do not skip** unless the user supplied an existing parent issue number/URL in the same request (then set `P` to that number).

When the source is `tasks/prd-<feature>.md`:

1. Read the full PRD file and any linked decision docs (e.g. `tasks/prd-mobile-program-decisions.md`).
2. Explore the repo briefly ([AGENTS.md](../../AGENTS.md), relevant `src/`).
3. Publish a **parent GitHub issue** using **`to-prd`** body structure (Problem, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes). Source content from the PRD file — **do not interview the user**.
4. Create via `gh issue create` with:
   - Title: `PRD: <feature name from file>`
   - Labels: **`ready-for-agent`**, **`type:feature`**
   - Body: include link `Source: tasks/prd-<feature>.md` at the top
5. Record parent issue number **`P`**. Comment on `P` with the integration branch name you will use.

If `to-prd` was run standalone earlier, still verify parent `P` exists; if missing, publish now.

### Step 2 — Create slice issues (auto)

Run **`to-issues`** in **auto** mode against the PRD file or parent **`P`**. Each child issue **## Parent** must reference **`P`**.

### Step 3 — Validate issues

Run **`validate-issues`**. If `stop-after-issues`, stop with parent `P` and child issue URLs.

### Step 4 — Create and push integration branch

Create `feat/<slug>` from `sandbox` and push (see above).

### Step 5 — Implement slices in order

For each issue in dependency order:

1. Blockers closed (merged into `feat/<slug>`).
2. `git checkout feat/<slug> && git pull`.
3. **`implement-issue`** with base **`feat/<slug>`**.
4. Once CI is green, squash-merge the slice PR into `feat/<slug>`, then move to the next slice.

### Step 6 — Open final PR to `sandbox` (**required**, automated)

After the **last slice PR is merged** into `feat/<slug>`, you **must** open the PR into `sandbox` — do not only remind the user. Merge latest `sandbox` into `feat/<slug>` first if it moved.

```bash
git checkout feat/<slug> && git pull
gh pr create --base sandbox --head feat/<slug> \
  --title "feat(<scope>): <feature name> (PRD #P)" \
  --body "$(cat <<'EOF'
## Summary

Completes PRD #P — <one paragraph>.

## Parent PRD

Part of #P

## Slice issues

- Closes #<child1>   # list all slice issues if not already closed
- ...

## Before merge (human)

- [ ] Review diff locally; Vercel builds only `main`, so `sandbox` and `feat/*` have no previews
- [ ] `npm run migrate:deploy` if schema changed
- [ ] Update CHANGELOG [Unreleased]

## Production

Merging this PR does **not** deploy: production follows Jorge's `sandbox` → `main` merge.

EOF
)"
```

Babysit this PR until merge-ready (CI green, conflicts resolved by merging `sandbox` in).

Tell the user:

```text
Final PR <url> is open: feat/<slug> → sandbox. Merge when ready (no deploy).
Production follows your sandbox → main merge.
```

### Step 7 — Close out

Comment on parent **`P`** with links to all slice PRs and the final PR URL.

## Policies

| Action | Allowed? |
| ------ | -------- |
| Publish parent PRD issue | **Required** (unless parent `#` given) |
| Create slice issues, `feat/<slug>`, slice PRs | Yes |
| Open final PR `feat/<slug>` → `sandbox` | **Required** after last slice merged |
| Babysit PRs | Yes |
| `gh pr merge` of a slice PR into `feat/<slug>` | Yes, squash, once CI is green |
| `gh pr merge` into `sandbox` or `main` | **No** (Jorge only) |

## Example

```text
/ship-feature tasks/prd-mobile-ui-ux.md
```

→ Parent issue #P → child issues → `feat/mobile-ui-ux` → slice PRs (agent merges) → final PR to `sandbox` (Jorge merges) → Jorge releases `sandbox` → `main`.
