# Agent & contributor configuration

Files in this directory are read by Cursor skills (`to-prd`, `to-issues`, etc.) and linked from [AGENTS.md](../../AGENTS.md).

| File | Purpose |
| ---- | ------- |
| [workflow.md](./workflow.md) | End-to-end: PRD → issues → PR → release |
| [deployment.md](./deployment.md) | Vercel: avoid prod on every `main` merge |
| [issue-tracker.md](./issue-tracker.md) | GitHub Issues + `gh` CLI |
| [triage-labels.md](./triage-labels.md) | Label vocabulary |
| [domain.md](./domain.md) | Domain glossary and doc layout |

**First time:** create GitHub labels with `bash scripts/create-github-labels.sh` (requires `gh auth login`).

**Automate a feature:** `/ship-feature tasks/prd-<name>.md` — slice PRs → **`feat/<slug>`**; **one** merge **`feat/<slug>` → `main`** for prod.
