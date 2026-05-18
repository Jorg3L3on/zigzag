# PRD: Mobile & PWA Documentation

## Introduction

The codebase has strong mobile implementation patterns, but **README and agent docs** do not tell developers or support staff what to expect on phones, how to install the PWA, or how to test mobile before release.

**Locked decisions:** Bilingual (Spanish + English) install instructions (Q5 C); `start_url` = `/dashboard` (Q2 B); no offline mode in v1 (Q3 A). See `prd-mobile-program-decisions.md`.

## Goals

- Developers know mobile patterns and where to find the list rule.
- Support can guide users through install in **Spanish and English**.
- Release process references mobile manual checklist (from testing PRD).
- Docs accurately describe v1 limitations (network required, no service worker).

## User Stories

### US-001: README mobile & PWA section (bilingual)
**Description:** As support staff or a Spanish/English-speaking user, I want install steps in both languages so I can help any team member.

**Acceptance Criteria:**
- [ ] README section **“Mobile & PWA”** with subsections:
  - **Español:** Instalar en iPhone (Compartir → Añadir a pantalla de inicio), Instalar en Android (Instalar app / Añadir a pantalla de inicio).
  - **English:** Install on iPhone (Share → Add to Home Screen), Install on Android (Install app / Add to home screen).
- [ ] Both languages state: after install, app opens on **Dashboard** (`/dashboard`); login required if session expired.
- [ ] Both languages state: **requires internet**; no offline data sync in current version.
- [ ] Optional short note: test on LAN — `npm run dev` on port 3069, open `http://<your-ip>:3069` from phone.
- [ ] Links to `tasks/mobile-release-checklist.md` when that file exists (from testing PRD).
- [ ] No claim of “full offline mode” or service worker features.

### US-002: AGENTS.md mobile development note
**Description:** As an AI agent or contributor, I want AGENTS.md to point to list mobile patterns so I do not ship table-only mobile UIs.

**Acceptance Criteria:**
- [ ] Short bullet under Architecture: mobile lists use cards below `md`; see `.cursor/rules/lists-and-responsive-tables.mdc`.
- [ ] Mention `useIsMobile` / sidebar sheet at 768px.
- [ ] Link to `tasks/prd-mobile-program-decisions.md` and `tasks/prd-mobile-*.md` for initiative scope.

### US-003: Supported browsers statement (bilingual)
**Description:** As support staff, I want a clear list of supported browsers in both languages.

**Acceptance Criteria:**
- [ ] README lists supported browsers (ES + EN): iOS Safari (last 2 major), Android Chrome (last 2 major), Chrome/Edge desktop.
- [ ] Note (ES + EN): ticket PDFs are generated on the server in v1; if issues persist on iOS, see troubleshooting / support.

### US-004: E2E mobile testing docs
**Description:** As a developer, I want to know how to run Playwright mobile projects locally.

**Acceptance Criteria:**
- [ ] README Testing section: `npm run test:e2e`, mobile project name(s) once added.
- [ ] Documents `E2E_EMAIL` / `E2E_PASSWORD` requirement.

## Functional Requirements

- FR-1: README “Mobile & PWA” with parallel ES/EN install instructions.
- FR-2: AGENTS.md mobile pattern pointers.
- FR-3: Cross-links to checklist and PRDs; no broken relative paths.
- FR-4: Install copy matches `manifest.ts`: `start_url: '/dashboard'`, name **ZigZag**.

## Non-Goals (Out of Scope)

- Full README translation (only Mobile & PWA + browsers sections bilingual).
- End-user help center or video tutorials.
- Screenshot assets (text-only steps acceptable for v1).
- API documentation changes.

## Technical Considerations

- Keep README diff focused; do not duplicate full PRD bodies.
- When `prd-mobile-pwa-offline.md` ships later, update offline wording in same section (ES + EN).

## Success Metrics

- New contributors find list rule within 1 click from AGENTS.md.
- Support uses either language block for install guidance without conflicting `start_url` info.

## Open Questions

- Include screenshot placeholders in a follow-up docs PR?
