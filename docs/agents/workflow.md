# Development workflow (humans + AI)

Standard path for features, fixes, and releases on Zigzag using Cursor skills and GitHub.

## Overview

```text
Idea → PRD → Issues → feat/<slug> slices → one PR feat/<slug> → main (prod) → CHANGELOG
```

| Step | Output | Tool |
| ---- | ------ | ---- |
| 1. Plan | PRD | **`prd`** or **`to-prd`** |
| 2. Decompose | GitHub slice issues | **`to-issues`** (auto by default) |
| 3. Validate | Fixed labels/links | **`validate-issues`** |
| 4. Implement + PR | Merge-ready PR into `feat/<slug>` | **`implement-issue`** (+ babysit) |
| 5. **Merge slice PR → `feat/<slug>`** | Integration branch | **Manual** (Vercel **preview**) |
| 6. **Ship feature → `main`** | Production deploy | **Manual** (**once per PRD**) |
| 7. Document | Version history | **CHANGELOG.md** + Git tag |

**One command for steps 1–5:** **`ship-feature`** on a PRD path.

**Vercel:** **`main` = production.** Slice merges go to **`feat/<feature-slug>`** only — see [deployment.md](./deployment.md).

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

## Automated path (`ship-feature`)

```text
/ship-feature tasks/prd-my-feature.md
```

1. **Always** publishes parent PRD issue on GitHub (`#P`) from the PRD file
2. **`to-issues`** auto — child issues linked to `#P`
3. **`validate-issues`**
4. **`feat/<slug>`** + **`implement-issue`** per slice → PR into feature branch
5. **You merge** each slice PR into `feat/<slug>`; reply `continue`
6. Agent **opens** final PR **`feat/<slug>` → `main`** (required)
7. **You merge** that PR once (production) — [deployment.md](./deployment.md)

Add `interactive` to quiz slices; `stop-after-issues` to stop after parent + children are created. Parent PRD issue is **not** optional when starting from a PRD file.

## Break down work (`to-issues` only)

1. Provide `tasks/prd-….md` or parent `#N`
2. **Auto (default):** publish slices without approval
3. **`interactive`:** quiz before publish

## Implement one slice (`implement-issue`)

For a single issue `#N`: branch → code → lint/test/build → `gh pr create` → babysit → **stop before merge**.

Never run `gh pr merge` unless the user explicitly requests it in that message.

## Release and changelog

1. Before tagging, move entries under **`## [Unreleased]`** in [CHANGELOG.md](../../CHANGELOG.md) into a dated version section
2. Bump **`package.json`** `version` to match ([SemVer](https://semver.org/))
3. Commit, tag `vX.Y.Z`, push tag
4. Create a [GitHub Release](https://github.com/Jorg3L3on/zigzag/releases) from the tag; paste the CHANGELOG section

Patch = bug fixes; minor = features; major = breaking changes.

## Skills reference

| Skill | Location | Purpose |
| ----- | -------- | ------- |
| `start-work` | `.cursor/skills/start-work/` | Route bugs, features, epics, releases to the right skill |
| `setup-matt-pocock-skills` | `.cursor/skills/setup-matt-pocock-skills/` | Reconfigure tracker / labels / domain docs |
| `prd` | `.cursor/skills/prd/` | Interview → `tasks/prd-*.md` |
| `to-prd` | `.cursor/skills/to-prd/` | Conversation → GitHub PRD issue |
| `to-issues` | `.cursor/skills/to-issues/` | PRD/plan → GitHub slice issues (auto default) |
| `validate-issues` | `.cursor/skills/validate-issues/` | Audit/fix issue metadata |
| `implement-issue` | `.cursor/skills/implement-issue/` | Slice issue → merge-ready PR into `feat/<slug>` |
| `fix-bug` | `.cursor/skills/fix-bug/` | Bug issue → merge-ready PR into `main` |
| `ship-feature` | `.cursor/skills/ship-feature/` | Full epic pipeline on `feat/<slug>` |
| `release` | `.cursor/skills/release/` | CHANGELOG + tag + GitHub Release |
| `list-and-responsive-tables` | `.cursor/skills/list-and-responsive-tables/` | Dashboard list UI pattern |

## Agent configuration files

| File | Purpose |
| ---- | ------- |
| [issue-tracker.md](./issue-tracker.md) | `gh` commands and repo |
| [triage-labels.md](./triage-labels.md) | Label strings |
| [domain.md](./domain.md) | Glossary and doc layout |
| [deployment.md](./deployment.md) | Vercel: `main` = prod; slices on `feat/<slug>` |
| [AGENTS.md](../../AGENTS.md) | Code architecture (canonical) |
