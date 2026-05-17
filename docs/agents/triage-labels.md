# Triage labels

Engineering skills (`to-prd`, `to-issues`, etc.) use five **canonical triage roles**. This file maps each role to the label string on GitHub.

Create these labels once (see [scripts/create-github-labels.sh](../../scripts/create-github-labels.sh)):

| Canonical role   | GitHub label       | Meaning |
| ---------------- | ------------------ | ------- |
| `needs-triage`   | `needs-triage`     | Maintainer needs to evaluate |
| `needs-info`     | `needs-info`       | Waiting on reporter for more information |
| `ready-for-agent`| `ready-for-agent`  | Fully specified; an AFK agent can implement without more human context |
| `ready-for-human`| `ready-for-human`  | Requires human judgment or implementation |
| `wontfix`        | `wontfix`          | Will not be actioned |

When a skill says "apply the AFK-ready triage label", use **`ready-for-agent`**.

## Change-type labels (optional, recommended)

Use alongside triage labels for filtering and release notes:

| Label          | Use |
| -------------- | --- |
| `type:bug`     | Defects (GitHub bug template applies this) |
| `type:feature` | New capability |
| `type:chore`   | Refactor, deps, tooling, docs-only |
| `type:docs`    | Documentation-only changes |

## Status label (optional)

| Label         | Use |
| ------------- | --- |
| `status:in-progress` | Someone (human or agent) is actively working the issue |

Remove `ready-for-agent` when moving to `status:in-progress` to avoid duplicate pickup.
