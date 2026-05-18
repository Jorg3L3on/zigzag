# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Agent workflow docs (`docs/agents/`), Cursor skills (`prd`, `to-prd`, `to-issues`, `implement-issue`, `ship-feature`, `validate-issues`), and GitHub label bootstrap script
- Server-generated fintech invoice PDF (`GET /api/tickets/[id]/invoice`)
- PWA install metadata (`start_url` `/dashboard`, manifest icons, bilingual README install section)
- Mobile accessibility: touch targets, chart labels, sheet/dialog focus trap, form error associations
- Companies list TanStack migration, mobile sort presets, shared list Cursor rule

### Changed

- Mobile UI: form inputs use larger text on small screens to avoid iOS zoom on focus
- Mobile UI: offline banner and toasts respect safe areas on notched devices
- Mobile UI: dashboard client metrics and ticket payment history use card/stacked layouts below tablet width
- Mobile UI: toasts appear at the top on phones so they do not cover primary buttons on ticket create and detail
- Mobile functionality: `tel` inputs, login autocomplete, company delete on mobile cards, sidebar first-paint fix
- README and AGENTS.md: mobile/PWA, supported browsers, server PDF, E2E env vars

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
