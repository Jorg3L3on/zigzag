---
name: fix-bug
description: >-
  Fix a GitHub bug issue: branch from sandbox, implement fix, open PR to sandbox, babysit until
  merge-ready. Use for fix bug #N, bugfix, or type:bug issues.
user-invocable: true
---

# Fix Bug

Take one **bug issue** through code, checks, PR to **`sandbox`**, and merge-ready CI.

**`main` = production on Vercel; `sandbox` = integration.** Bug-fix PRs target **`sandbox`** (not `main`, not a `feat/<slug>` unless the bug lives only there). Jorge merges into `sandbox` and releases `sandbox` → `main`. See [docs/agents/deployment.md](../../docs/agents/deployment.md).

Read **`docs/agents/issue-tracker.md`**, **`docs/agents/triage-labels.md`**, **`docs/agents/domain.md`**, and **[AGENTS.md](../../AGENTS.md)** first.

## Preconditions

1. `gh` authenticated; run from repo root.
2. Issue open; prefer **`ready-for-agent`** and **`type:bug`** unless user overrides.
3. Working tree clean on `sandbox`.

## Process

### 1. Load issue

```bash
gh issue view <N> --json number,title,body,labels,state
```

### 2. Branch from `sandbox`

```bash
git checkout sandbox && git pull
git checkout -b slice/fix-<N>-<short-slug>
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

### 6. Open PR to `sandbox`

```bash
gh pr create --base sandbox --title "fix(scope): short title (#N)" --body "$(cat <<'EOF'
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

Follow **babysit** skill. If `sandbox` moved, merge it into your branch (no rebase, no force-push).

**Do not:** `gh pr merge`. Merges into `sandbox` are Jorge's.

### 9. Hand off

```text
PR ready: merge into sandbox (no deploy; production follows sandbox → main).
```

## Policies

| Action | Allowed? |
| ------ | -------- |
| Branch from `sandbox`, PR to `sandbox` | **Yes** |
| PR to `main` | **No** |
| `gh pr merge` | **No** (Jorge merges into `sandbox`) |
| `vercel deploy --prod` / promote | **No** (human or Vercel on merge) |

## Example

```text
/fix-bug #87
```
