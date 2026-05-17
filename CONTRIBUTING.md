# Contributing to ZigZag

Thank you for your interest in contributing. This project is open source under the [MIT License](LICENSE).

## Getting started

1. Fork the repository and clone your fork.
2. Install dependencies: `npm install`
3. Copy [`.env.example`](.env.example) to `.env` and configure PostgreSQL and auth secrets.
4. Apply migrations: `npm run db:migrate`
5. Optional seed data: `npm run seed`
6. Run the dev server: `npm run dev` (http://localhost:3069)

Architecture, multi-tenancy, and conventions are documented in [AGENTS.md](AGENTS.md).

## Workflow with AI (PRD → issues → PR)

We use a standard path so humans and Cursor agents stay aligned. Details: [docs/agents/workflow.md](docs/agents/workflow.md).

1. **Plan** — Skill `prd` (interview → `tasks/prd-*.md`) *or* `to-prd` (conversation → parent GitHub issue).
2. **Decompose** — Skill `to-issues` creates vertical-slice GitHub issues from the PRD.
3. **Implement** — Branch `feat/<issue>-slug` or `fix/<issue>-slug`; match acceptance criteria on the issue.
4. **Pull request** — Link with `Closes #<issue>` and `Part of #<parent>` when applicable.
5. **Release** — Update [CHANGELOG.md](CHANGELOG.md) and tag per [Semantic Versioning](https://semver.org/).

**One-time setup:** run `bash scripts/create-github-labels.sh` after `gh auth login`. Agent config lives in [docs/agents/](docs/agents/).

Skills live under `.cursor/skills/` (`prd`, `to-prd`, `to-issues`, `implement-issue`, `ship-feature`, `setup-matt-pocock-skills`).

**Automated delivery:** `/ship-feature tasks/prd-….md` publishes a **parent PRD issue**, slice issues, **`feat/<slug>`** work, and opens a final PR **`feat/…` → `main`**. You only **merge** PRs (slices + one release to `main`). See [docs/agents/deployment.md](docs/agents/deployment.md).

## Before you open a PR

Run the same checks as CI:

```bash
npm run lint
npm test -- --runInBand
npm run test:e2e
npm run build
```

Authenticated Playwright tests are skipped unless `E2E_EMAIL` and `E2E_PASSWORD` are set.

## Pull request guidelines

- Branch from `main` with a descriptive name (e.g. `feat/57-payment-reminder`, `fix/ticket-audit-scope`).
- Reference the GitHub issue in the PR body (`Closes #57`).
- Keep changes focused; one logical change per PR when possible (one tracer-bullet slice when using `to-issues`).
- Update tests when behavior changes.
- For schema changes: run `npm run db:generate` and include new files under `drizzle/`.
- Add an entry under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) for user-visible changes.
- Do not commit `.env` files or secrets.

## Security

Do not open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md).

## Questions

Open a [GitHub Discussion](https://github.com/Jorg3L3on/zigzag/discussions) or issue for bugs and feature requests.
