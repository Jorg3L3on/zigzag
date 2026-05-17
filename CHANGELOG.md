# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Agent workflow docs (`docs/agents/`), Cursor skills (`prd`, `to-prd`, `to-issues`), and GitHub label bootstrap script

## [1.0.0] - 2026-05-16

First public open-source release.

### Added

- Multi-tenant ticket management (companies, clients, services, tickets, RBAC)
- Next.js 16 App Router UI with dashboard metrics and on-demand PDF export
- Drizzle ORM schema, SQL migrations, and seed script
- NextAuth v5 credentials authentication with JWT sessions
- Server Actions and REST API routes with tenant scoping
- Jest unit tests, Playwright E2E (unauthenticated flow; login test optional via env)
- CI workflow (lint, test, E2E, build)
- Production runbook for Vercel + Neon deployment
- Optional offline RAG tooling over `rag/docs/`

### Requirements

- Node.js 20.9+, PostgreSQL 14+
- Environment variables documented in `.env.example`
- Self-hosted or deploy via Vercel + Neon (see README)

### Known limitations

- Authenticated E2E tests require `E2E_EMAIL` and `E2E_PASSWORD`
- `rag/docs/` may contain outdated Prisma references; use [AGENTS.md](AGENTS.md) as canonical
- No official hosted demo included with the release

[1.0.0]: https://github.com/Jorg3L3on/zigzag/releases/tag/v1.0.0
