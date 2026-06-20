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

## Merge Guard

Mobile performance PRs must at least verify:

- Server PDF download remains the primary path.
- PDF download failures clear the loading state within 60 seconds.
- Dashboard charts honor `prefers-reduced-motion: reduce`.
- Tripled dashboard motion renders statically when reduced motion is requested.
- No critical Lighthouse regression vs this baseline on the same environment (local prod or preview).

**Note:** PRD target `/login` Performance ≥90 is not met on local prod (79). Acceptable for v1 with documented baseline; re-measure on Vercel preview before treating as a release blocker.
