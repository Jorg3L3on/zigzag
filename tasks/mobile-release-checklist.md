# Mobile release checklist

Use this list before promoting a mobile-related change to production. Run automated checks first, then spot-check on real devices when the diff touches layout, PWA metadata, or PDF download.

## Automated (required)

```bash
npm run lint
npm test -- --runInBand
npm run test:e2e          # chromium + mobile-chrome projects
npm run build
```

Set `E2E_EMAIL` and `E2E_PASSWORD` for authenticated Playwright cases. Optional: `E2E_SYSTEM_EMAIL` / `E2E_SYSTEM_PASSWORD` for system-operator nav tests.

## Manual — iOS Safari

- [ ] Login with a tenant user; session persists after reload.
- [ ] Open **Tickets** — card layout (not broken horizontal scroll).
- [ ] Start **Nuevo ticket** — form controls readable; numeric keyboard on phone fields.
- [ ] Open an existing ticket detail — actions reachable; no overlap with safe area.
- [ ] Download ticket PDF on a finished ticket (Wi‑Fi); failure shows toast `PDF001`.
- [ ] Toggle airplane mode — offline banner appears; app does not claim offline sync.
- [ ] **Share → Add to Home Screen** — icon installs; cold start opens **Dashboard** (`/dashboard`).

## Manual — Android Chrome

- [ ] Login and open sidebar sheet from the menu button; navigation links work.
- [ ] Tickets list cards and filters usable with touch targets.
- [ ] Create-ticket flow: client step and services step scroll without layout break.
- [ ] PDF download on finished ticket.
- [ ] Airplane mode — offline banner only (no offline data).
- [ ] **Install app** / **Add to home screen** — cold start opens Dashboard.

## Regression notes

- PWA v1 has **no service worker** and **requires internet**.
- Ticket PDFs are **server-generated** (`GET /api/tickets/[id]/invoice`); do not re-enable client-only canvas PDF in production UI.
- Dashboard lists use **TanStack table on desktop** and **cards below 768px** — see `.cursor/rules/lists-and-responsive-tables.mdc`.

## Related docs

- [tasks/INDEX.md](./INDEX.md) — mobile PRD status
- [tasks/mobile-lighthouse-baseline.md](./mobile-lighthouse-baseline.md) — performance baseline procedure
- [README.md](../README.md) — Mobile & PWA install (ES + EN)
