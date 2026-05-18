# PRD: PWA & Install Experience

## Introduction

ZigZag already ships a web app manifest, icons, and Apple web app metadata. Users can add the app to their home screen, but there is **no service worker**, limited install guidance, and manifest choices (`start_url`, `orientation`) that may not match how staff use the product in the field.

This PRD improves **installability and metadata** without offline caching or install prompts (deferred — see `prd-mobile-program-decisions.md`).

**Locked decisions:** `start_url` = `/dashboard`; no service worker in v1; bilingual install docs in `prd-mobile-documentation.md`.

## Goals

- Users can install ZigZag on iOS and Android with correct name, icons, and theme.
- Cold start from home screen opens `/dashboard` (auth redirect for logged-out users).
- Field staff can follow bilingual install instructions (README).

## User Stories

### US-001: Manifest tuning for real-world devices
**Description:** As a user installing ZigZag on a tablet or phone, I want the app to open in a usable orientation and land on the dashboard route.

**Acceptance Criteria:**
- [ ] `orientation` in `manifest.ts` changed from `portrait` to `any` OR removed (browser default).
- [ ] `start_url` set to `/dashboard` in `manifest.ts`.
- [ ] Unauthenticated user opening installed app from `start_url` is redirected to `/login` via existing `proxy.ts` / auth (manual verify).
- [ ] `display: standalone` and `theme_color` unchanged unless design requests update.
- [ ] Lighthouse PWA manifest audit passes (no critical manifest errors).
- [ ] Typecheck/lint passes.

### US-002: Verify icon and metadata completeness
**Description:** As a user adding to home screen, I want a crisp icon and correct app name on iOS and Android.

**Acceptance Criteria:**
- [ ] Icons exist: 192, 512, maskable 512, apple-touch 180, favicon.
- [ ] `layout.tsx` metadata `icons` and `appleWebApp` align with files in `public/` and `src/app/`.
- [ ] No broken icon URLs in production build output.
- [ ] Verify install preview on at least one Android Chrome and one iOS Safari (manual checklist in PR).

### US-003: Cross-link install docs to documentation PRD
**Description:** As support staff, I want install steps in README (owned by documentation PRD) to match this manifest.

**Acceptance Criteria:**
- [ ] README install section states app opens on **Dashboard** after install (not login page).
- [ ] Bilingual steps delivered per `prd-mobile-documentation.md` US-001.
- [ ] README clearly states: **no offline mode** in v1; network required for data (no service worker).

## Functional Requirements

- FR-1: `src/app/manifest.ts` — `start_url: '/dashboard'`, relaxed `orientation`.
- FR-2: `src/app/layout.tsx` metadata consistent with manifest (`themeColor`, icons).
- FR-3: Manual test: install PWA → opens `/dashboard` → logged-in user sees dashboard; logged-out → login.

## Non-Goals (Out of Scope)

- Service worker, offline shell, asset caching (future: `prd-mobile-pwa-offline.md`).
- `beforeinstallprompt` install banner (future PRD).
- App Store / Play Store native wrappers.
- Push notifications, background sync, offline CRUD.
- Replacing NextAuth session handling.

## Technical Considerations

- `start_url` must be within `scope: '/'`.
- iOS PWA: no push; standalone mode quirks; install is manual (Share → Add to Home Screen).
- Auth: dashboard layout already redirects unauthenticated users — no new auth logic required if proxy covers `/dashboard`.

## Success Metrics

- Manifest valid in Lighthouse PWA category (manifest subset; full PWA installability may still fail without SW — expected).
- Support uses README bilingual install section; `start_url` behavior matches docs.

## Open Questions

- Is `appleWebApp.statusBarStyle: 'default'` intentional, or switch to `black-translucent` for edge-to-edge?

## Deferred to future PRD

See `prd-mobile-program-decisions.md`:

- Offline shell + service worker
- Optional Android install prompt UX
