# Mobile Lighthouse Baseline

Status: baseline procedure captured; authenticated numeric runs pending staging credentials.

## Scope

Run Lighthouse mobile against the mobile performance PRD paths:

| Path | Auth | Notes |
|------|------|-------|
| `/login` | No | Public cold-start path. |
| `/dashboard` | Yes | Requires seeded user or staging account. |
| `/dashboard/tickets` | Yes | Requires seeded user or staging account with tickets. |

## Recommended Profile

- Lighthouse mode: navigation
- Form factor: mobile
- Throttling: Lighthouse default mobile throttling
- Browser: Chrome stable
- Server: production preview or local `npm run dev` on port 3069

## Metrics To Record

For each URL, record:

- Performance score
- LCP
- INP when available, or TBT as the lab proxy
- CLS
- Notes about data size, auth account, and device/network profile

## Command Template

```bash
npx lighthouse http://127.0.0.1:3069/login --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate
```

Use Chrome DevTools Lighthouse or a configured Lighthouse CLI run for the mobile preset before release. Keep authenticated results in the PR or append them below once staging credentials are available.

## Baseline Runs

| Date | URL | Environment | Performance | LCP | INP/TBT | CLS | Notes |
|------|-----|-------------|-------------|-----|---------|-----|-------|
| Pending | `/login` | Pending | Pending | Pending | Pending | Pending | Requires Lighthouse run. |
| Pending | `/dashboard` | Pending | Pending | Pending | Pending | Pending | Requires authenticated session. |
| Pending | `/dashboard/tickets` | Pending | Pending | Pending | Pending | Pending | Requires authenticated session. |

## Merge Guard

Until numeric baselines are committed, mobile performance PRs must at least verify:

- Server PDF download remains the primary path.
- PDF download failures clear the loading state within 60 seconds.
- Dashboard charts honor `prefers-reduced-motion: reduce`.
- Tripled dashboard motion renders statically when reduced motion is requested.
