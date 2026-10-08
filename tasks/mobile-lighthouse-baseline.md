# Mobile Lighthouse Baseline

Status: baseline recorded for `/login`, `/dashboard`, and `/tickets` (local prod build, 2026-06-20).

## Scope

Run Lighthouse mobile against the mobile performance PRD paths:

| Path | Auth | Notes |
|------|------|-------|
| `/login` | No | Public cold-start path. |
| `/dashboard` | Yes | Requires seeded user or staging account. |
| `/tickets` | Yes | Canonical tickets list (redirect from legacy `/dashboard/tickets`). |

## Recommended Profile

- Lighthouse mode: navigation
- Form factor: mobile
- Throttling: Lighthouse default mobile throttling
- Browser: Chrome stable
- Server: **production build** (`npm run build && npx next start -p 3070`) — Turbopack dev skews `/tickets` routing and scores

## Metrics To Record

For each URL, record:

- Performance score
- LCP
- INP when available, or TBT as the lab proxy
- CLS
- Notes about data size, auth account, and device/network profile

## Command Template

```bash
# Terminal 1 — prod server
AUTH_TRUST_HOST=true NEXTAUTH_URL=http://127.0.0.1:3070 npx next start -p 3070

# Terminal 2 — all three paths (uses E2E_EMAIL / E2E_PASSWORD from .env)
npm run lighthouse:mobile
```

Single public path:

```bash
npx lighthouse http://127.0.0.1:3070/login --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate
```

Re-run on a Vercel preview before release; local prod build is the merge guard baseline.

## Baseline Runs

| Date | URL | Environment | Performance | LCP | INP/TBT | CLS | Notes |
|------|-----|-------------|-------------|-----|---------|-----|-------|
| 2026-06-20 | `/login` | Local prod (`next start`, port 3070) | 79 | 5.6 s | TBT 67 ms | 0 | Lighthouse mobile preset, simulated throttling. |
| 2026-06-20 | `/dashboard` | Local prod (`next start`, port 3070) | 68 | 6.6 s | TBT 152 ms | 0 | Authenticated via E2E seed user; tenant company context. |
| 2026-06-20 | `/tickets` | Local prod (`next start`, port 3070) | 76 | 6.2 s | TBT 145 ms | 0 | Authenticated; list with seeded tickets. |
| 2026-06-20 | `/login` | Local dev (`npm run dev`, port 3069) | 68 | 8.8 s | TBT 270 ms | 0 | Superseded by prod baseline above; kept for comparison. |
| 2026-08-18 | `/login` | Local prod (`next start`, port 3070) | 87 | 4.0 s | TBT 66 ms | 0 | Post-LCP initiative; Cloud Agent re-run (`demo@zigzag.app`). Improved vs 2026-06-20. |
| 2026-08-18 | `/dashboard` | Local prod (`next start`, port 3070) | 67 | 7.1 s | TBT 375 ms | 0 | First post-change run; LCP **regressed** vs 6.6 s. |
| 2026-08-18 | `/tickets` | Local prod (`next start`, port 3070) | 76 | 4.7 s | TBT 316 ms | 0 | Paginated tickets; LCP improved 6.2 s → 4.7 s. |
| 2026-08-18 | `/dashboard` | Local prod after slice 1F recovery | 67–74 | **4.5–6.8 s** | TBT ~290 ms | 0.12 | SQL aggregates, server greeting, SVG KPIs, deferred charts. Best LCP 4.5 s (beats 6.6 s); slower runs ~6.8 s. CLS from streamed widgets — follow-up. Target ≤ 4.0 s not met on every run. |
| 2026-08-18 | `/tickets` | Local prod after slice 1F recovery | 76–77 | **4.4–4.8 s** | TBT ~280–380 ms | 0 | Stable improvement vs 6.2 s baseline. Target ≤ 3.5 s not met. |

| 2026-10-08 | `/tickets/create` | Local prod, ZIG-I2 composer (`b8e07cd`) | 43 / 70 / 66 / 63 | 7.7–8.3 s | TBT 248–1421 ms | 0 | 4 runs on a loaded MacBook Air (load avg 6–15). Same-session A/B vs `main` below. |
| 2026-10-08 | `/tickets` | Local prod, ZIG-I2 (`b8e07cd`) | 49 / 70 / 56 / 59 | 7.4–7.8 s | TBT 253–984 ms | 0 | Same runs as above. |
| 2026-10-08 | `/tickets/create` | Local prod, `main` @433a2e1 (old 3-step wizard) | 60 / 42 | 7.8–8.3 s | TBT 603–1845 ms | 0.012 | A/B baseline under the same load: the composer is not slower (median ~64 vs ~51) and removes the small CLS. |
| 2026-10-08 | `/tickets` | Local prod, `main` @433a2e1 | 44 / 61 | 7.5–8.0 s | TBT 558–1654 ms | 0 | A/B baseline (median ~52 vs ~58 with the dock). Absolute scores sit below the Aug rows because of machine load, not code. |

`LIGHTHOUSE_PATHS=/tickets/create,/tickets npm run lighthouse:mobile` limits a run to those paths.

## Merge Guard

Mobile performance PRs must at least verify:

- Server PDF download remains the primary path.
- PDF download failures clear the loading state within 60 seconds.
- Dashboard charts honor `prefers-reduced-motion: reduce`.
- Tripled dashboard motion renders statically when reduced motion is requested.
- No critical Lighthouse regression vs this baseline on the same environment (local prod or preview).

**Note:** PRD target `/login` Performance ≥90 is not met on local prod (79). Acceptable for v1 with documented baseline; re-measure on Vercel preview before treating as a release blocker.

## Native-feel follow-up (2026-08-10)

Shipped on `feat/native-feel-pwa` before full Lighthouse re-measure:

- Route loading skeletons for `/dashboard`, `/tickets`, `/clients`
- Conservative mobile idle prefetch of the three tab routes
- Light optimistic UI for notification mark-read

**Action for #355:** Re-run `npm run lighthouse:mobile` after the Aug 2026 LCP initiative (server dashboard metrics, paginated tickets, deferred widgets, dynamic charts) and append post-change scores above.
