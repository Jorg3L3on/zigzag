# PRD: Native-feel PWA polish (parent epic)

**Status:** ❌ Not applied  
**GitHub:** Parent [#341](https://github.com/Jorg3L3on/zigzag/issues/341); slices [#342](https://github.com/Jorg3L3on/zigzag/issues/342)–[#360](https://github.com/Jorg3L3on/zigzag/issues/360)  
**Integration branch (suggested):** `feat/native-feel-pwa`  
**Related plan:** native-feel PWA polish (items 2, 4–10)

## Introduction

ZigZag already ships a responsive dashboard, installable PWA metadata, and an app-shell service worker. Field and office users still feel “browser web” more than “app”: primary navigation is a hamburger sheet, forms bury save actions, PDFs only download, cold start flashes mismatched theme colors, offline is shell-only, and sessions expire with little warning.

This **parent epic** improves the **mobile web and installed PWA** experience so it feels closer to a native app **without** native Android/iOS binaries, new paid vendors, or aggressive server traffic.

**Locked stakeholder answers:**

| # | Decision |
|---|----------|
| Packaging | Parent PRD + **separate slice PRDs** per area |
| Audience | **Both** installed standalone PWA and in-browser mobile users |
| Bottom tabs | Inicio · Tickets · Clientes · **Más** (opens existing sidebar sheet) |
| Offline storage | **IndexedDB** for list snapshots (+ form drafts) |
| Sticky CTAs | Ticket **create** (already shipped) + ticket **edit** only in this epic |

**Cost guardrails:** No new paid products. Conservative prefetch (three tab routes, idle, mobile). Session soft-refresh only when the tab is visible and JWT is near expiry. Do **not** cache `/api` or RSC in the service worker.

## Goals

- Mobile users reach core work (dashboard, tickets, clients) in one thumb tap.
- Perceived performance improves on `/dashboard` and `/tickets` without a new hosting bill.
- Ticket PDFs can be shared via the OS share sheet when supported.
- Installed and browser mobile chrome feel continuous (theme, transitions, pull-to-refresh).
- Sessions warn/refresh near expiry without extending the 8h JWT `maxAge`.
- Offline users can **read** last-fetched tickets/clients snapshots and recover form drafts; no offline CRUD sync.
- Ticket edit save is always reachable via sticky mobile CTA.
- Cold start theme/background matches runtime theme colors.

## Slice PRDs (implement in suggested order)

1. [`prd-native-feel-bottom-tabs.md`](./prd-native-feel-bottom-tabs.md) — [#342](https://github.com/Jorg3L3on/zigzag/issues/342)  
2. [`prd-native-feel-theme-splash.md`](./prd-native-feel-theme-splash.md) — [#343](https://github.com/Jorg3L3on/zigzag/issues/343), [#344](https://github.com/Jorg3L3on/zigzag/issues/344)  
3. [`prd-native-feel-thumb-forms.md`](./prd-native-feel-thumb-forms.md) — [#345](https://github.com/Jorg3L3on/zigzag/issues/345)  
4. [`prd-native-feel-share-pdf.md`](./prd-native-feel-share-pdf.md) — [#346](https://github.com/Jorg3L3on/zigzag/issues/346), [#347](https://github.com/Jorg3L3on/zigzag/issues/347)  
5. [`prd-native-feel-chrome-motion.md`](./prd-native-feel-chrome-motion.md) — [#348](https://github.com/Jorg3L3on/zigzag/issues/348)–[#351](https://github.com/Jorg3L3on/zigzag/issues/351)  
6. [`prd-native-feel-performance.md`](./prd-native-feel-performance.md) — [#352](https://github.com/Jorg3L3on/zigzag/issues/352)–[#355](https://github.com/Jorg3L3on/zigzag/issues/355)  
7. [`prd-native-feel-session.md`](./prd-native-feel-session.md) — [#356](https://github.com/Jorg3L3on/zigzag/issues/356), [#357](https://github.com/Jorg3L3on/zigzag/issues/357)  
8. [`prd-native-feel-offline-snapshots.md`](./prd-native-feel-offline-snapshots.md) — [#358](https://github.com/Jorg3L3on/zigzag/issues/358)–[#360](https://github.com/Jorg3L3on/zigzag/issues/360)  

## Non-Goals (entire epic)

- Install prompt / `beforeinstallprompt` (see `prd-mobile-pwa-offline.md`)
- Web Push / lock-screen notifications
- Capacitor, React Native, App Store / Play Store binaries
- Offline create/edit/sync of tickets or payments
- Service worker caching of tenant JSON, `/api/**`, or RSC
- Extending JWT `maxAge` beyond 8 hours
- Sticky CTAs on client/service/company forms (deferred)
- Bottom tab for Servicios or Recordatorios (Más covers overflow)

## Success Metrics

- Mobile users can switch Dashboard ↔ Tickets ↔ Clients without opening the sidebar.
- Lighthouse mobile baselines for `/login`, `/dashboard`, `/tickets` re-recorded; perceived LCP/INP improved vs 2026-06-20 baseline where practical.
- On share-capable mobile browsers, ticket PDF offers Compartir; otherwise download still works.
- Airplane-mode after an online visit: shell loads; tickets/clients show last snapshot with clear stale messaging.
- Ticket edit primary save is reachable without scrolling on Pixel-class viewports.
- No new paid vendor or always-on polling introduced.

## Open Questions

- None blocking; open items live in individual slice PRDs if any.
