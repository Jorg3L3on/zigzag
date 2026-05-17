# Development workflow (humans + AI)

Standard path for features, fixes, and releases on Zigzag using Cursor skills and GitHub.

## Overview

```text
Idea → PRD → Issues → Branch → PR → CHANGELOG → Release
```

| Step | Output | Tool |
| ---- | ------ | ---- |
| 1. Plan | PRD | Skill **`prd`** or **`to-prd`** |
| 2. Decompose | GitHub issues (vertical slices) | Skill **`to-issues`** |
| 3. Implement | Code on a branch | You / agent |
| 4. Review | Pull request | `gh pr create` |
| 5. Ship | Merge to `main` | GitHub |
| 6. Document | Version history | **CHANGELOG.md** + Git tag |

One-time setup: run **`setup-matt-pocock-skills`** (or use the committed `docs/agents/` files) and create GitHub labels via [scripts/create-github-labels.sh](../../scripts/create-github-labels.sh).

## Choose a PRD path

### Path A — Greenfield (`prd`)

Use when the idea is new or scope is unclear.

1. In Cursor: `/prd` or ask to "create a PRD for …"
2. Answer 3–5 clarifying questions (`1A, 2C, …`)
3. Output: **`tasks/prd-<feature-name>.md`** (not implemented yet)
4. Run **`to-issues`** on that file to create GitHub slice issues

### Path B — Synthesis (`to-prd`)

Use when you already discussed the feature in chat and want a parent issue on GitHub.

1. In Cursor: `/to-prd` or "turn this conversation into a PRD"
2. Agent explores the repo; you confirm modules and test targets
3. Output: **GitHub issue** (parent PRD) with label **`ready-for-agent`**
4. Run **`to-issues`** on that issue URL or number

Do not run both paths for the same feature unless you intentionally want a local draft and a tracker copy.

## Break down work (`to-issues`)

1. Provide a PRD path (`tasks/prd-….md`) or parent issue `#N` / URL
2. Agent proposes **tracer-bullet** slices (HITL vs AFK, dependencies)
3. You approve granularity and dependencies
4. Agent creates child issues on GitHub (blockers first), labeled **`ready-for-agent`** when AFK-ready

Each child issue should be demoable end-to-end (schema → API/actions → UI → tests), not "only backend."

## Implement

1. Pick one issue; add **`status:in-progress`** (optional) and assign yourself
2. Branch from `main`:
   - `feat/<issue>-short-slug`
   - `fix/<issue>-short-slug`
3. Implement against the issue **acceptance criteria**
4. Run CI checks locally (see [CONTRIBUTING.md](../../CONTRIBUTING.md))

## Open a pull request

- Title: `feat(scope): short description (#issue)`
- Body: use [.github/pull_request_template.md](../../.github/pull_request_template.md)
- Link issues:
  - `Closes #57` — slice issue
  - `Part of #40` — parent PRD issue (if any)
- One logical change per PR when possible

## Release and changelog

1. Before tagging, move entries under **`## [Unreleased]`** in [CHANGELOG.md](../../CHANGELOG.md) into a dated version section
2. Bump **`package.json`** `version` to match ([SemVer](https://semver.org/))
3. Commit, tag `vX.Y.Z`, push tag
4. Create a [GitHub Release](https://github.com/Jorg3L3on/zigzag/releases) from the tag; paste the CHANGELOG section

Patch = bug fixes; minor = features; major = breaking changes.

## Skills reference

| Skill | Location | Purpose |
| ----- | -------- | ------- |
| `setup-matt-pocock-skills` | `.cursor/skills/setup-matt-pocock-skills/` | Reconfigure tracker / labels / domain docs |
| `prd` | `.cursor/skills/prd/` | Interview → `tasks/prd-*.md` |
| `to-prd` | `.cursor/skills/to-prd/` | Conversation → GitHub PRD issue |
| `to-issues` | `.cursor/skills/to-issues/` | PRD/plan → GitHub slice issues |
| `list-and-responsive-tables` | `.cursor/skills/list-and-responsive-tables/` | Dashboard list UI pattern |

## Agent configuration files

| File | Purpose |
| ---- | ------- |
| [issue-tracker.md](./issue-tracker.md) | `gh` commands and repo |
| [triage-labels.md](./triage-labels.md) | Label strings |
| [domain.md](./domain.md) | Glossary and doc layout |
| [AGENTS.md](../../AGENTS.md) | Code architecture (canonical) |
