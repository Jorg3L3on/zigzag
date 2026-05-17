---
name: ship-feature
description: >-
  Orchestrate a feature from PRD to merge-ready PRs on feat/<slug>. Always publishes a
  parent PRD GitHub issue, creates slice issues, implements slices, and opens the final
  feat/<slug> to main PR. Human only merges PRs (not main automatically). Use ship feature.
---

# Ship Feature

End-to-end automation for a feature PRD.

**`main` is production on Vercel** — slice PRs never target `main`. See [docs/agents/deployment.md](../../docs/agents/deployment.md).

**Human gates (only):**

1. **Merge** each slice PR into `feat/<feature-slug>` (preview).
2. **Merge** the final PR **`feat/<slug>` → `main`** (production) — agent opens this PR; you merge it.

Agents **never** `gh pr merge` or push to `main`.

Read **`docs/agents/workflow.md`** and **`docs/agents/deployment.md`**.

## Integration branch

From PRD path: `tasks/prd-mobile-ui-ux.md` → branch **`feat/mobile-ui-ux`**.

Before first slice (after step 3):

```bash
git checkout main && git pull
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
  →  implement-issue × N  →  human merges each slice PR
  →  open PR feat/<slug> → main (required)  →  human merges to main
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

Create `feat/<slug>` from `main` and push (see above).

### Step 5 — Implement slices in order

For each issue in dependency order:

1. Blockers closed (merged into `feat/<slug>`).
2. `git checkout feat/<slug> && git pull`.
3. **`implement-issue`** with base **`feat/<slug>`**.
4. Pause for human merge into `feat/<slug>`; wait for **`continue`** before next slice.

### Step 6 — Open final PR to `main` (**required**, automated)

After the **last slice PR is merged** into `feat/<slug>` (user confirmed), you **must** open the release PR — do not only remind the user.

```bash
git checkout feat/<slug> && git pull
gh pr create --base main --head feat/<slug> \
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

- [ ] Review diff on preview deployment for `feat/<slug>`
- [ ] `npm run migrate:deploy` if schema changed
- [ ] Update CHANGELOG [Unreleased]

## Production

Merging this PR deploys **production** (`main`).

EOF
)"
```

Babysit this PR until merge-ready (CI green, conflicts resolved with `main`).

Tell the user:

```text
Final PR <url> is open: feat/<slug> → main. Merge when ready (production deploy).
Slice PRs stay on the feature branch; this is the only merge to main for this PRD.
```

### Step 7 — Close out

Comment on parent **`P`** with links to all slice PRs and the final PR URL.

## Policies

| Action | Allowed? |
| ------ | -------- |
| Publish parent PRD issue | **Required** (unless parent `#` given) |
| Create slice issues, `feat/<slug>`, slice PRs | Yes |
| Open final PR `feat/<slug>` → `main` | **Required** after last slice merged |
| Babysit PRs | Yes |
| `gh pr merge` | **No** |

## Example

```text
/ship-feature tasks/prd-mobile-ui-ux.md
```

→ Parent issue #P → child issues → `feat/mobile-ui-ux` → slice PRs (you merge) → final PR to `main` (you merge once).
