---
name: implement-issue
description: >-
  Implement a single GitHub issue, open a PR into the initiative branch feat/<slug> (or sandbox),
  and babysit until merge-ready. Use for implement issue, ship slice, or work on #N.
---

# Implement Issue

Take one **slice issue** through code, checks, PR creation, and merge-ready CI.

**Never merge into `sandbox` or `main`** or run `vercel deploy --prod` / `vercel promote` — Jorge only.

**Branches:** `main` = production, `sandbox` = integration. Slice PRs target the initiative branch **`feat/<feature-slug>`** ([docs/agents/deployment.md](../../docs/agents/deployment.md)). When invoked from **`ship-feature`**, use that run's integration branch. A standalone ticket with no initiative targets `sandbox`. If unsure, ask for the base branch.

Read **`docs/agents/issue-tracker.md`**, **`docs/agents/triage-labels.md`**, **`docs/agents/domain.md`**, and **[AGENTS.md](../../AGENTS.md)** first.

## Preconditions

1. `gh` authenticated; run from repo root.
2. Issue open; **`ready-for-agent`** unless user overrides.
3. **Blocked by** empty or blockers closed.
4. Base branch exists (usually `feat/<slug>`); working tree clean on base branch.

## Process

### 1. Load issue

```bash
gh issue view <N> --json number,title,body,labels,state
```

### 2. Branch from the integration branch (not `main`)

```bash
git checkout <integration-branch> && git pull
git checkout -b feat/<N>-<short-slug>
```

Urgent fixes also branch from `sandbox` and PR into `sandbox`; Jorge decides when `sandbox` goes to `main`.

### 3. Implement

Satisfy acceptance criteria; follow AGENTS.md and linked PRDs under `tasks/`.

### 4. Verify

```bash
npm run lint
npm test -- --runInBand
npm run build
```

### 5. Commit

`feat(scope): description (#N)`

### 6. Open PR into integration branch

```bash
gh pr create --base <integration-branch> --title "feat(scope): short title (#N)" --body "..."
```

Include `Closes #N`, `Part of #<parent>` if applicable.

### 7. Label issue

```bash
gh issue edit <N> --add-label "status:in-progress" --remove-label "ready-for-agent"
```

### 8. Babysit

Follow **babysit** skill. Merge the latest `<integration-branch>` in if needed (no rebase, no force-push); never `main`.

When the base is a `feat/<slug>` branch, squash-merge the PR yourself once CI is green. **Do not** merge into `sandbox` or `main`, enable auto-merge there, or push to them.

### 9. Hand off

```text
PR ready for <integration-branch> (no Vercel preview; verify locally). Not production.
```

If this was the last slice for the feature, open (or remind about) the PR **`feat/<slug>` → `sandbox`**; Jorge merges it and later releases `sandbox` → `main`.

## After the slice PR is merged

Issue closes via `Closes #N` when merged into the integration branch.
