# PRD: PWA Offline Detection and Graceful Degradation (Execution Plan 4.1)

## Problem Statement

ZigZag is installable as a PWA (`manifest`, icons, `start_url: /dashboard`) and field staff may add it to their home screen. When network connectivity is lost—common in shops and on the road—installed users can see a blank browser error page or a broken shell instead of a recognizable app with a clear explanation. README and AGENTS.md correctly state that **v1 has no offline data sync**, but the product still fails the basic expectation that an installed app should load its shell and communicate connectivity status.

**Current partial state (from `docs/zigzag-execution-plan.html` §4.1):**

- ✅ `NetworkStatusBanner` + `useNetworkStatus` show a Spanish offline banner when `navigator.onLine` is false, set `--network-status-banner-offset` on `document.documentElement`, and auto-dismiss with a brief “Conexión restablecida” message when connectivity returns.
- ❌ No service worker; cold start or hard refresh while offline yields a browser error, not the ZigZag shell.
- ❌ No automated Playwright coverage for offline → online banner transitions on mobile.

This PRD completes the **remaining** acceptance criteria for execution-plan task **4.1**. It does not reopen the broader deferred epic in `tasks/prd-mobile-pwa-offline.md` (Android install prompt, push, offline CRUD).

## Solution

Ship a **production-only service worker** that precaches the **app shell** (static JS/CSS/fonts/icons and a navigation fallback) so installed and returning users always see the ZigZag UI framework—not a blank page—when offline. Pair the shell with the **existing offline banner** and established network-error toasts so users understand that **Ticket, Client, and Service data still require a live connection**. Add a **Playwright mobile-chrome** test that toggles offline mode and asserts banner visibility lifecycle.

Users get graceful degradation: shell + messaging + client-side navigation among already-loaded routes, without pretending the app works offline for mutations or fresh server data.

## User Stories

1. As a field technician who installed ZigZag on my phone, I want the app shell to load when I open it without network, so that I see ZigZag branding and guidance instead of a browser error page.

2. As a field technician opening ZigZag while offline, I want an immediate visible banner explaining that I have no internet, so that I understand why actions may fail.

3. As a field technician who temporarily loses signal while using ZigZag, I want the offline banner to appear without reloading the page, so that I know connectivity dropped during my session.

4. As a field technician whose connection returns, I want the offline banner to disappear automatically after a brief confirmation, so that I can resume work without dismissing UI manually.

5. As a field technician who was viewing the dashboard before going offline, I want to navigate to other routes I already visited in this session using in-app links, so that cached client bundles still render the shell even though data may be stale or unavailable.

6. As a field technician offline on a ticket list I already loaded, I want to see the last rendered list content (if still in memory) plus the offline banner, so that I can reference what I was looking at even though I cannot refresh or save.

7. As a field technician offline, I want any save or Server Action I attempt to show the existing network error toast (GN002), so that failed mutations are explained consistently with the banner.

8. As a tenant user on desktop who loses Wi‑Fi, I want the same offline banner behavior as on mobile, so that connectivity messaging is consistent across form factors.

9. As a screen reader user, I want the offline banner announced via `role="status"` and appropriate `aria-live`, so that I am notified without losing access to navigation (existing a11y behavior must remain).

10. As a user on a notched phone, I want the offline banner to respect safe-area insets and not cover the sticky header or sidebar sheet, so that primary navigation stays reachable (existing layout offset behavior must remain).

11. As a support engineer, I want README and the mobile release checklist to describe shell caching vs. data requirements accurately, so that we do not over-promise offline sync.

12. As a developer deploying to Vercel, I want the service worker registered only in production builds, so that local dev and Turbopack HMR are not broken by aggressive caching.

13. As a security-conscious operator, I want API routes, auth endpoints, and Server Action POSTs to always use network-first (never serve stale JSON from cache), so that tenant data is not leaked or misrepresented from cache.

14. As a developer, I want a documented cache strategy for `_next/static`, fonts, icons, and the web manifest, so that future Next.js upgrades do not silently break offline shell behavior.

15. As a CI maintainer, I want a Playwright test on the `mobile-chrome` project that sets the browser offline, asserts the banner text, restores connectivity, and asserts the banner clears, so that regressions are caught automatically.

16. As a developer, I want unit tests for any extracted service-worker configuration or registration guard (production-only, scope `/`), so that wiring mistakes fail in Jest rather than only in manual PWA testing.

17. As a user who updates ZigZag after a deploy, I want the service worker to pick up new static assets without requiring manual cache clearing, so that I do not stay on an indefinitely stale shell.

18. As a first-time installer who completes install while online, I want the service worker to install and precache during the first successful visit, so that a subsequent offline open still works.

19. As a logged-out user who opens the installed app offline, I want to see the login shell or cached login page with the offline banner, so that the experience is coherent even before authentication (auth still requires network to succeed).

20. As a product owner tracking execution-plan Phase 4, I want task 4.1 marked complete when shell caching, banner behavior, cached-route navigation, and Playwright coverage all pass, so that the PWA score gap (7→9) is closed for offline UX.

## Implementation Decisions

### Modules to build or modify

| Module | Role | Change |
| ------ | ---- | ------ |
| **Service worker registration** | Client-side, production-only registration with update detection | **New** — small client entry invoked from root layout or dedicated provider; skips dev |
| **App shell precache policy** | Defines precache manifest: `_next/static/*`, fonts, icons, favicon, manifest | **New** — Serwist/Workbox config; no API/RSC in precache |
| **Navigation fallback handler** | Serves cached shell document when offline navigation cannot reach network | **New** — network-first for document requests with offline fallback to cached `/dashboard` or app shell |
| **Network status UI** | Banner + document offset CSS variable | **Existing** — verify unchanged; coordinate timing with SW install (no duplicate banners) |
| **Network awareness / toast errors** | `getIsOnline`, `isLikelyNetworkError`, GN002 messaging | **Existing** — no change unless SW fetch errors need classification |
| **Root layout integration** | Mount banner, optionally register SW | **Modify** — add registration hook/provider |
| **Next.js build integration** | Emit SW at build time | **Modify** — `@serwist/next` wrapper on `next.config` (preferred for Next 16) or documented custom SW build step |
| **CSP compatibility** | `script-src 'self'` already allows same-origin SW | **Verify** — SW script served from `/` scope; no `'unsafe-eval'` in prod |
| **Offline E2E spec** | Playwright mobile offline lifecycle | **New** — `e2e/mobile-offline.spec.ts` matched by `mobile-chrome` project |
| **Docs** | README Mobile & PWA, `mobile-release-checklist.md`, AGENTS.md PWA note | **Modify** — clarify “shell caches offline; data requires network” |

### Architectural decisions

- **Serwist for Next.js 16:** Use `@serwist/next` (or `@serwist/webpack-plugin` if Turbopack build path requires webpack phase only) to generate the service worker at production build. Rationale: maintained Next integration, precache manifest from build output, avoids hand-maintaining asset URLs. If integration blocks CI, fall back to a minimal hand-written Workbox SW that precaches only `_next/static` and icons—document the choice in the implementing PR.

- **Cache scope — shell only:**
  - **Precache / cache-first:** `_next/static/**`, `/_next/static/**`, `/icons/**`, `/favicon.ico`, `/manifest.webmanifest`, font files referenced by the app.
  - **Network-only (never cache responses):** `/api/**`, `/api/auth/**`, Server Action POSTs, RSC flight requests (`?_rsc=`), any request with `Authorization` or session cookies for mutation/read of tenant data.
  - **Navigations:** Network-first with offline fallback to a cached app-shell document so `/dashboard` and other app routes render the React shell; data fetches inside the shell will fail gracefully with banner + toasts.

- **No offline data sync:** Ticket, Client, Service, Company, User mutations and list refreshes remain online-only. Do not add IndexedDB, background sync, or optimistic offline queues.

- **Production-only registration:** `process.env.NODE_ENV === 'production'` guard (or equivalent Next public flag) so `npm run dev` / Turbopack HMR is unaffected. SW file may still be emitted in build output but not registered locally unless explicitly testing.

- **Existing banner is canonical UX:** Do not add a second offline UI (no duplicate `beforeinstallprompt` work). The banner copy stays Spanish product copy: “Sin conexión a internet. Algunas acciones pueden fallar.”

- **Layout offset contract preserved:** `NetworkStatusBanner` continues to set `data-network-status-banner` and `--network-status-banner-offset`; sticky header, sidebar sheet, and `AppToaster` already consume this variable—do not break.

- **Update strategy:** On new deploy, new SW activates with `skipWaiting` + `clients.claim()` (or Serwist default) so users receive fresh static assets within one navigation cycle; document any user-visible reload behavior.

- **Relationship to deferred epic:** `tasks/prd-mobile-pwa-offline.md` remains the home for Android install prompt and richer offline UX. This PRD supersedes its “no service worker” stub **only for app-shell caching**; update that file’s status note when 4.1 ships.

### Schema / API / tenancy

- No database schema changes.
- No new Server Actions or API routes.
- Service worker must not cache cross-tenant API responses; network-only policy satisfies this.

## Testing Decisions

**What makes a good test:** Assert **observable behavior**—banner visibility, document offset, Playwright offline toggling, SW registration in production build artifacts—not internal Serwist config object shapes.

**Modules under test:**

| Module | Test type | Prior art |
| ------ | --------- | --------- |
| `NetworkStatusBanner` | Jest + RTL | `src/components/network-status-banner.test.tsx` (keep passing) |
| SW registration guard | Jest | New small test if logic extracted to `src/lib/register-service-worker.ts` |
| Production build emits SW | Optional smoke in build script or Jest | `src/app/manifest.test.ts` pattern for static asset checks |
| Offline banner lifecycle | Playwright `mobile-chrome` | `e2e/mobile-sidebar.spec.ts` auth/helpers pattern |
| Network error toasts offline | Optional unit | `src/lib/network-awareness` tests if added |

**Playwright spec (US-15):**

- Project: `mobile-chrome` (Pixel 5 profile).
- Flow: login → `/dashboard` → `context.setOffline(true)` → assert banner “Sin conexión” → `setOffline(false)` → assert banner clears (including recovery message window if still visible, then hidden).
- Use existing `e2e/helpers/auth.ts` credentials skip pattern.

**Manual release checklist:** Update airplane-mode bullets to note shell loads on cold start offline after first online visit.

## Out of Scope

- Offline Ticket create/edit/sync or IndexedDB queues.
- Caching API JSON, Server Action results, or RSC payloads for offline read.
- Push notifications or background sync.
- Android `beforeinstallprompt` install banner (deferred epic).
- Bilingual banner copy (product copy remains Spanish; i18n follow-up separate).
- Lighthouse “installable PWA” score optimization beyond shell caching.
- Service worker in development/Turbopack HMR environments.
- Changing `start_url`, manifest icons, or auth/session model.

## Further Notes

- **Parent context:** Execution plan Phase 4 — [docs/zigzag-execution-plan.html](../docs/zigzag-execution-plan.html) task **4.1** (status: Partial → target Done).
- **Related shipped work:** `prd-mobile-pwa-install` (#54), `prd-mobile-ui-ux` (safe-area banner), `prd-mobile-accessibility` (#33, banner a11y).
- **Docs drift to fix on ship:** `tasks/mobile-release-checklist.md` and README currently say “no service worker”; revise to “service worker caches shell only; data requires network.”
- **Open question for implementer:** Confirm `@serwist/next` compatibility with Next 16.2.x production webpack build on Vercel; if blocked, ship minimal Workbox SW and note in PR.
- **Branch convention:** Implement on `feat/pwa-offline-shell`; slice PRs merge to feature branch; one PR to `main` when complete ([docs/agents/deployment.md](../docs/agents/deployment.md)).
