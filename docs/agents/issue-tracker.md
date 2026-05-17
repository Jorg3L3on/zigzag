# Issue tracker: GitHub

Issues and PRDs for this repo live as **GitHub Issues** on [Jorg3L3on/zigzag](https://github.com/Jorg3L3on/zigzag). Use the [`gh`](https://cli.github.com/) CLI for all operations (authenticated and run from a clone of this repo).

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..." --label "ready-for-agent"`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --label "ready-for-agent"`
- **Comment**: `gh issue comment <number> --body "..."`
- **Labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

`gh` infers the repo from `git remote` when run inside this clone.

## Linking issues

- **Parent PRD issue**: reference in child issues under `## Parent` (see `to-issues` skill).
- **Slice PR**: base branch **`feat/<feature-slug>`**, not `main` ([deployment.md](./deployment.md)). Include `Closes #<number>`; `Part of #<parent>` when applicable.
- **Feature PR**: `feat/<slug>` → `main` when the PRD is complete (one production deploy).
- **Local PRD drafts**: skills may also write `tasks/prd-<feature>.md` before publishing to GitHub (`prd` skill).

## When a skill says "publish to the issue tracker"

Create a GitHub issue on `Jorg3L3on/zigzag` with the body from the skill template and the triage labels defined in [triage-labels.md](./triage-labels.md).

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
