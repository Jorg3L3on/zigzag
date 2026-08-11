# PRD: Service reminder action loop (digests + one-tap ticket)

**Status:** ❌ Not applied  
**GitHub:** [#371](https://github.com/Jorg3L3on/zigzag/issues/371); slices [#379](https://github.com/Jorg3L3on/zigzag/issues/379)–[#382](https://github.com/Jorg3L3on/zigzag/issues/382)  
**Depends on:** Existing Client service schedules + in-app Notification materialization  
**Suggested order:** After Cobranza (or parallel if staffing allows)

## Problem Statement

ZigZag already tracks recurring Client + Service visits via Client service schedules, surfaces Próximos / Atrasados on a management page and dashboard widget, and materializes in-app Notification rows via cron. Field and office staff still lose follow-ups because (1) reminders are easy to miss inside the bell without a morning digest, (2) notification and widget rows do not start Ticket creation in one gesture, and (3) there is no channel beyond the in-app bell—no email digest and no client-side WhatsApp nudge to the Client. Missed cadences mean lost recurring revenue.

## Solution

Close the **recordatorio → acción** loop without auto-creating Tickets or buying messaging vendors. Add a **daily in-app digest notification** per Company summarizing overdue and due-soon schedule counts with a deep link to filtered Recordatorios; add **Crear ticket** (existing `clientId` / `serviceId` prefill) on dashboard widget rows, Needs Attention schedule rows, and notification detail navigation where a single schedule is referenced; add **WhatsApp / Llamar** actions on schedule rows using Client phone; and keep Ticket creation **manual save only**. Email/push remain optional stretch only if zero new paid vendors (e.g. Resend already present)—v1 success does not require them.

## User Stories

1. As a Company user with `tickets.read`, I want a daily digest notification when my Company has at least one Atrasado or Próximo schedule, so that I see morning workload without opening Recordatorios first.
2. As a Company user, I want the digest title/body in Spanish to include counts (e.g. atrasados and próximos), so that urgency is obvious in the bell.
3. As a Company user, I want the digest to deep-link to `/service-schedules` with a sensible filter (atrasados if any, else proximos), so that one tap opens the right list.
4. As a developer, I want digest materialization to be idempotent per Company per calendar day via `dedupe_key`, so that cron and on-demand runs do not spam duplicates.
5. As a Company user, I want existing per-schedule due/overdue notifications to keep working, so that digests complement rather than replace detail rows.
6. As a Company user with `tickets.write`, I want Crear ticket on a Recordatorios management row (already present) to remain, so that current workflow does not regress.
7. As a Company user with `tickets.write`, I want Crear ticket on the dashboard service-schedules widget row, so that urgent visits become Tickets without opening the full list.
8. As a Company user with `tickets.write`, I want Crear ticket from a schedule-linked notification when `resource_type` / `resource_id` point at a schedule, so that the bell can start work.
9. As a Company user, I want Crear ticket to open `/tickets/create?clientId=&serviceId=` and keep manual save, so that no Ticket is created by accident.
10. As a Company user, I want the existing post-create services prefill behavior to remain, so that the Service line is still added after save.
11. As a Company user, I want Llamar (`tel:`) on schedule rows when the Client has a phone, so that I can confirm the visit.
12. As a Company user, I want Compartir por WhatsApp on schedule rows with a Spanish visit-reminder message (Client, Service, next due date), so that I can nudge the Client without leaving the phone.
13. As a Company user, when phone is missing, I want call/WhatsApp actions disabled with clear affordance, so that I know why I cannot contact them.
14. As a Company user, I want Needs Attention schedule entries to offer or link into Crear ticket / Recordatorios consistently, so that dashboard attention is actionable.
15. As a Company user, I want paused schedules excluded from digests and urgency actions, so that waiting Clients do not generate noise.
16. As a Company user, I want soft-deleted Clients/Services to remain excluded via existing auto-pause behavior, so that digests stay valid.
17. As a system Company user, I want digests and actions scoped to selected Company context, so that cross-tenant data never mixes.
18. As a tenant user, I want all reminder actions scoped to my Company only, so that isolation holds.
19. As a user without `tickets.read`, I want schedule pages, digests targeting schedules, and related UI hidden/forbidden, so that RBAC holds.
20. As a user without `tickets.write`, I want Crear ticket hidden on widget/notification/list, so that read-only users cannot start Tickets.
21. As a mobile user, I want widget and list actions thumb-friendly with stopPropagation on cards, so that opening a row does not fight the CTA.
22. As a Company user, I want snooze (defer next due by 7 days) as an explicit action on a schedule row, so that soft refusals do not require full edit.
23. As a Company user with write permission, I want snooze to update `next_due_at` and write an auditable updated_at change (no Ticket audit required), so that the deferral persists.
24. As a Company user, I want snooze confirmation copy in Spanish stating the new date, so that mistakes are rare.
25. As a developer, I want digest generation in the existing notifications materializer / cron path, so that we do not invent a second scheduler.
26. As a developer, I want WhatsApp schedule message building in a pure helper (shared patterns with Cobranza phone helpers where sensible), so that copy is testable.
27. As a QA engineer, I want unit tests for digest dedupe keys, count copy, snooze date math, and disabled actions without phone, so that CI catches regressions.
28. As a QA engineer, I want component tests that widget rows render Crear ticket when `tickets.write` is present, so that the action loop stays wired.
29. As a maintainer, I want docs/guides to note that reminders never auto-create Tickets, so that operators are not misled.
30. As a Company user, I want opening a per-schedule notification to land on Recordatorios focused on that Client or filter, so that I can still find the row if one-tap create is unused.
31. As a product owner, I want v1 explicitly successful without email/push vendors, so that scope stays shippable.
32. As a future stretch, I want optional email digest only if an existing mailer is already configured in the repo—otherwise defer—so that we do not add paid products casually.
33. As a Company user, I want timezone-safe “today” boundaries for digests to match existing schedule bucket helpers, so that Próximos/Atrasados stay consistent.
34. As a Company user finishing a Ticket, I want the existing finish→schedule upsert dialog unchanged, so that this PRD does not reopen that flow.
35. As a screen reader user, I want new actions named (Crear ticket, WhatsApp, Llamar, Posponer), so that the action loop is accessible.
36. As a Company user, I want empty digest suppression (no notification when counts are zero), so that healthy days stay quiet.

## Implementation Decisions

### Modules to build or modify

| Module | Role |
| ------ | ---- |
| **Digest materializer** | Extend notifications materialization: one Company-level digest per day when overdue/due-soon counts > 0; idempotent `dedupe_key` |
| **Schedule contact actions** | UI + helpers for `tel:` and `wa.me` visit reminders from Client phone on schedule rows/cards |
| **Crear ticket entry points** | Add prefilled create links on dashboard widget rows, notification click targets for schedule resources, Needs Attention where missing |
| **Snooze action** | Server Action: add N days (default 7) to `next_due_at` for writable schedules; pure date helper |
| **Cron path** | Reuse `/api/cron/notifications` + on-demand materialize; no second cron unless necessary |
| **Copy helpers** | Spanish digest and WhatsApp message builders — pure functions |

### Architectural decisions

- **Do not auto-create Tickets** from cron or digests (existing product rule).
- **Do not cache** schedule JSON in the service worker; NetworkOnly for API/RSC remains.
- **Channels in v1:** in-app Notification digests + client-side WhatsApp/tel. No Meta WhatsApp API. Web Push deferred (native-feel / mobile offline epics).
- **Email:** out of v1 unless an existing first-party mail path is already production-ready; do not add a new vendor in this PRD.
- **Snooze:** updates schedule `next_due_at` only; does not create Ticket audit events.
- **Prefill contract:** keep `clientId` + `serviceId` query params and create→services redirect behavior.
- **Permissions:** read schedules with `tickets.read`; create Ticket / snooze / mutate schedule with existing write rules (`tickets.write` and/or `clients.write` as today’s schedule mutations).
- Spanish product copy; Company scoping; soft-delete aware.

### Schema changes

- None required if Notification `type` can accept a new string such as `schedule_daily_digest` and dedupe keys encode company+date.
- No change to `ClientServiceSchedule` columns for snooze (reuse `next_due_at`).

## Testing Decisions

- Test observable behavior: digest created once per day; suppressed when zero; links and CTAs appear with correct permissions; snooze moves due date; WhatsApp href null without phone.
- **Unit-test:** digest dedupe key, count copy, snooze helper, WhatsApp/tel builders.
- **Action/integration tests:** Company scoping on snooze; RBAC denials.
- **Prior art:** `src/lib/notifications.ts` materializer tests (if present), service schedule bucket helpers, schedule list action tests, ticket create prefill tests.

## Out of Scope

- Auto-creating Tickets from schedules
- WhatsApp Business API / SMS gateways
- Per-user notification preferences and `user_id` targeting overhaul
- Web Push / FCM
- Changing interval math or finish-ticket upsert UX
- Client portal for upcoming visits
- Assigning schedules to a technician User

## Further Notes

- Feature slug: `feat/reminder-action-loop`.
- Shares phone/WhatsApp helper patterns with Cobranza; extract shared `buildWhatsAppHref` if both ship close together.
- Dashboard widget currently caps at 6 rows — Crear ticket must work on those rows without requiring the full page.
- Coordinate copy so digests do not duplicate three identical bells when many schedules are due; per-schedule notifications may remain, but digest is the “start here” summary.
