---
name: validate-issues
description: >-
  Validate and fix GitHub slice issues after to-issues — labels, parent links, blockers,
  acceptance criteria. Use after to-issues or before ship-feature.
---

# Validate Issues

Audit child issues created for a feature. Fix tracker metadata with `gh issue edit`; do not change code.

Read **`docs/agents/issue-tracker.md`** and **`docs/agents/triage-labels.md`**.

## Input

- Parent issue `#N`, or
- List of issue numbers, or
- Feature slug (search `gh issue list` by title)

## Checks

For each slice issue:

| Check | Action if fail |
| ----- | -------------- |
| Has **What to build** and **Acceptance criteria** | Comment or edit body |
| AFK slice has **`ready-for-agent`** | `gh issue edit --add-label` |
| HITL slice has **`ready-for-human`** (not `ready-for-agent`) | Fix labels |
| **`type:feature`** or **`type:bug`** present | Add appropriate type label |
| **Parent** references correct PRD issue | Edit body |
| **Blocked by** references real open/closed issues correctly | Edit body |
| No circular blockers | Report to user |
| Title is actionable and uses domain vocabulary | Suggest rename |

## Output

Markdown report:

```markdown
## Validation report

- #101 ✅
- #102 ⚠️ missing type:feature — fixed
- #103 ❌ blocked by #999 (not found) — needs human
```

## Do not

- Close or merge issues
- Implement code
- Merge PRs
