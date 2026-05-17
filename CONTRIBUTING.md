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

- Branch from `main` with a descriptive name (e.g. `fix/ticket-audit-scope`).
- Keep changes focused; one logical change per PR when possible.
- Update tests when behavior changes.
- For schema changes: run `npm run db:generate` and include new files under `drizzle/`.
- Do not commit `.env` files or secrets.

## Security

Do not open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md).

## Questions

Open a [GitHub Discussion](https://github.com/Jorg3L3on/zigzag/discussions) or issue for bugs and feature requests.
