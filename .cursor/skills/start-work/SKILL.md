---
name: start-work
description: >-
  Single entry point for Zigzag development. Routes bugs, features, epics, and releases
  to the right skill. Use for /start-work, "what should I run?", or when unsure which
  workflow to use.
user-invocable: true
---

# Start Work

Single entry point for Zigzag development workflows. Read [docs/agents/workflow.md](../../docs/agents/workflow.md) for full detail.

## First time only

```bash
bash scripts/create-github-labels.sh   # after gh auth login
```

## Route the request

Ask **one** clarifying question if unclear, then invoke the skill below. Do not run the full epic pipeline for bugs or tiny changes.

| User intent | Command to run | What happens |
| ----------- | -------------- | -------------- |
| **Bug** — something is broken | **`fix-bug #N`** | Branch from `main` → fix → PR to `main` |
| **Small change** — docs, chore, one PR | Describe the change; branch `chore/` or `fix/` from `main` | Direct implement + PR to `main` (no PRD) |
| **New idea** — scope unclear | **`prd`** | Interview → `tasks/prd-<name>.md` |
| **New feature** — discussed in chat, ready to plan | **`to-prd`** | GitHub parent issue + optional local PRD |
| **Medium feature** — 1–2 issues, clear scope | **`to-prd`** then **`implement-issue #N`** | Skip `ship-feature` |
| **Large epic** — many slices, integration branch | **`ship-feature tasks/prd-<name>.md`** | Full pipeline on `feat/<slug>` |
| **Continue epic** — slices already exist | **`ship-feature from-issue #P`** or **`implement-issue #N`** | Resume where left off |
| **Cut release** — ship version to prod users | **`release X.Y.Z`** | CHANGELOG + tag + GitHub Release |
| **Existing issue** — labeled `ready-for-agent` | **`implement-issue #N`** (epic slice) or **`fix-bug #N`** (bug) | Depends on `type:bug` vs feature slice |

## Decision tree (quick)

```text
Is it a bug with a GitHub issue?
  yes → fix-bug #N
  no ↓
Is it user-visible and needs multiple PRs / previews?
  yes → ship-feature (PRD file or parent #P)
  no ↓
Is scope still fuzzy?
  yes → prd (local draft) or to-prd (GitHub)
  no ↓
implement-issue #N  OR  direct branch from main
```

## Examples (tell the agent)

```text
/start-work fix the login redirect bug #87
/start-work I want to add client export — not sure of scope yet
/start-work ship tasks/prd-client-service-schedules.md
/start-work implement #64 on feat/mobile-first-dashboard-redesign
/start-work release 1.2.0
```

## Epic flags (append to ship-feature)

| Flag | When |
| ---- | ---- |
| `stop-after-issues` | Plan only — parent + slice issues, no code |

## Hand off

After routing, **follow that skill to completion**. Do not chain unrelated skills unless the user asks.
