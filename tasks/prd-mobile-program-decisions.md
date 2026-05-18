# Mobile initiative — locked product decisions

Decisions from stakeholder Q&A (apply to all `prd-mobile-*.md` in this folder).

| # | Question | Decision |
|---|----------|----------|
| Q1 | Scope per PRD | **C.** Phase 2 work deferred to **separate future PRDs** (not in current epics). |
| Q2 | PWA `start_url` | **B.** `/dashboard` (unauthenticated users handled by existing auth redirect). |
| Q3 | Service worker in v1 | **A.** **No** — manifest, metadata, and install docs only. |
| Q4 | Server-side PDF | **B.** **In v1** — see `prd-mobile-performance.md`. |
| Q5 | Install documentation language | **C.** **Bilingual** (Spanish + English) in README. |

## Future PRDs (out of scope for current epics)

Create when ready — do not implement under current PRDs:

| Future PRD | Contents |
|------------|----------|
| [`prd-mobile-pwa-offline.md`](prd-mobile-pwa-offline.md) | Service worker, offline shell, install prompt (`beforeinstallprompt`) — stub created |
| (optional) `prd-mobile-ci-quality.md` | Lighthouse CI gate if US-005 in testing PRD not completed in v1 |

## Implementation order (suggested)

1. UI/UX + Functionality (parallel)
2. Architecture (companies TanStack)
3. Performance (server PDF + baseline)
4. PWA (manifest `start_url`, orientation)
5. Testing (Playwright mobile)
6. Accessibility
7. Documentation (bilingual README — can parallel with PWA)
