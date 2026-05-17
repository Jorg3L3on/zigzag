---
name: implement-issue
description: >-
  Implement a single GitHub issue, open a PR into the feature integration branch (not main),
  and babysit until merge-ready. Use for implement issue, ship slice, or work on #N.
---

# Implement Issue

Take one **slice issue** through code, checks, PR creation, and merge-ready CI.

**Never merge to `main`** or run `vercel deploy --prod` / `vercel promote` — human only.

**Vercel:** `main` = production. Slice PRs target **`feat/<feature-slug>`** ([docs/agents/deployment.md](../../docs/agents/deployment.md)). When invoked from **`ship-feature`**, use that run's integration branch. Standalone: ask user for base branch or default `feat/<slug>` if obvious from issue/PRD.

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

### 2. Branch from integration branch (not main)

```bash
git checkout <integration-branch> && git pull
git checkout -b feat/<N>-<short-slug>
```

For hotfixes on `main` only when user explicitly says production hotfix: branch from `main` and PR to `main` (single-slice exception).

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

Follow **babysit** skill. Rebase/merge latest `<integration-branch>` if needed — **not** `main` unless PR base is `main`.

**Do not:** `gh pr merge`, auto-merge, push to `main`.

### 9. Hand off

```text
PR ready: merge into <integration-branch> (preview). Not main / not production.
```

If this was the last slice for the feature, remind user: one PR **`<integration-branch>` → `main`** when the PRD is complete.

## After human merges slice PR

Issue closes via `Closes #N` when merged into the integration branch.
