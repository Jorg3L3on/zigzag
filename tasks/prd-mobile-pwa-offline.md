# PRD: PWA Offline & Install Prompt (Future)

> **Status: Not in v1.** Deferred per `prd-mobile-program-decisions.md` (Q1 C, Q3 A).  
> Implement only after `prd-mobile-pwa-install.md` and `prd-mobile-documentation.md` are complete.

## Introduction

Follow-up epic for service worker, offline app shell, and optional Android install prompt. v1 ships manifest + bilingual install docs only.

## Goals (draft)

- App shell loads when offline with clear “no sync” messaging.
- Static assets cached; API responses not served stale from cache.
- Optional dismissible install hint on Android (`beforeinstallprompt`).

## User Stories (draft — refine before implementation)

### US-001: Register service worker in production
**Description:** As a returning user with no network, I want to see the ZigZag shell instead of a browser error page.

**Acceptance Criteria:**
- [ ] TBD when epic is prioritized.

### US-002: Offline fallback messaging
**Description:** As an offline user, I want to understand that ticket data requires connection.

**Acceptance Criteria:**
- [ ] TBD.

### US-003: Android install prompt banner
**Description:** As a first-time Android user, I want a hint that I can install the app.

**Acceptance Criteria:**
- [ ] TBD.
- [ ] Verify in browser using dev-browser skill.

## Non-Goals (draft)

- Offline ticket create/edit/sync.
- Push notifications.

## Dependencies

- `prd-mobile-pwa-install.md` (manifest, `start_url: '/dashboard'`)
- `NetworkStatusBanner` behavior coordinated with SW fetch events

## Open Questions

- `@serwist/next` vs custom SW with Next.js 16 Turbopack?
- Cache strategy for `_next/static` only vs broader shell?
