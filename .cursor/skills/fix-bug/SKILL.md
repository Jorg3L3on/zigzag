---
name: fix-bug
description: >-
  Fix a GitHub bug issue: branch from main, implement fix, open PR to main, babysit until
  merge-ready. Use for fix bug #N, bugfix, or type:bug issues.
user-invocable: true
---

# Fix Bug

Take one **bug issue** through code, checks, PR to **`main`**, and merge-ready CI.

**`main` = production on Vercel.** Bug-fix PRs target **`main`**, not `feat/<slug>`. See [docs/agents/deployment.md](../../docs/agents/deployment.md).

Read **`docs/agents/issue-tracker.md`**, **`docs/agents/triage-labels.md`**, **`docs/agents/domain.md`**, and **[AGENTS.md](../../AGENTS.md)** first.

## Preconditions

1. `gh` authenticated; run from repo root.
2. Issue open; prefer **`ready-for-agent`** and **`type:bug`** unless user overrides.
3. Working tree clean on `main`.

## Process

### 1. Load issue

```bash
gh issue view <N> --json number,title,body,labels,state
```

### 2. Branch from `main`

```bash
git checkout main && git pull
git checkout -b fix/<N>-<short-slug>
```

### 3. Implement

Satisfy acceptance criteria; minimal diff; follow AGENTS.md.

### 4. Verify

```bash
npm run lint
npm test -- --runInBand
npm run build
```

Add E2E only when the bug is UI-visible and a unit test cannot cover it.

### 5. Commit

`fix(scope): description (#N)`

### 6. Open PR to `main`

```bash
gh pr create --base main --title "fix(scope): short title (#N)" --body "$(cat <<'EOF'
## Summary

<what was broken and how it is fixed>

Closes #N

## Test plan

- [ ] ...
EOF
)"
```

### 7. Label issue

```bash
gh issue edit <N> --add-label "status:in-progress" --remove-label "ready-for-agent"
```

### 8. Babysit

Follow **babysit** skill. Rebase on `main` if needed.

**Do not:** `gh pr merge` unless the user explicitly requests merge in that message.

### 9. Hand off

```text
PR ready: merge into main (production deploy when merged).
```

## Policies

| Action | Allowed? |
| ------ | -------- |
| Branch from `main`, PR to `main` | **Yes** |
| `gh pr merge` | **Only** when user explicitly asks |
| `vercel deploy --prod` / promote | **No** (human or Vercel on merge) |

## Example

```text
/fix-bug #87
```
