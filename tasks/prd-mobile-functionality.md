# PRD: Mobile Functionality Parity

## Introduction

Most ZigZag workflows are reachable on mobile, but some behaviors differ from desktop: phone fields lack proper input types, companies cannot be deleted from mobile cards, PDF generation is unreliable on mobile browsers, and the sidebar hook can flash the wrong mode on first paint. This PRD closes **functional gaps**—not visual polish (see `prd-mobile-ui-ux.md`).

**Assumptions:** Target users include shop staff using phones for tickets, clients, and payments. No new business features; parity and reliability only.

**Locked decisions:** Server PDF is owned by `prd-mobile-performance.md` (v1). No service worker. See `tasks/prd-mobile-program-decisions.md`.

## Goals

- Phone and email fields use correct HTML types and autocomplete on all high-traffic forms.
- Mobile list actions match desktop where safety allows (e.g. delete on companies).
- Reduce sidebar hydration mismatch on mobile.
- Improve login and PDF flows for mobile browsers.

## User Stories

### US-001: Phone fields use tel keyboard and autocomplete
**Description:** As a mobile user entering a phone number, I want the numeric phone keyboard and autofill so data entry is faster.

**Acceptance Criteria:**
- [ ] `client-form.tsx` phone field: `type="tel"`, `autoComplete="tel"`.
- [ ] Ticket create (`tickets/create/page.tsx`) phone field(s): `type="tel"` where applicable.
- [ ] Ticket edit (`tickets/[id]/edit/page.tsx`) phone field(s): `type="tel"` where applicable.
- [ ] Company form already uses `type="tel"`—used as reference; no regression.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Login form autocomplete for password managers
**Description:** As a returning user on mobile, I want my browser or password manager to fill credentials quickly.

**Acceptance Criteria:**
- [ ] Email input: `autoComplete="email"`.
- [ ] Password input: `autoComplete="current-password"`.
- [ ] Form still submits correctly with manual entry.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-003: Delete company from mobile list cards
**Description:** As an admin on mobile, I want to delete a company from the list without switching to desktop layout.

**Acceptance Criteria:**
- [ ] `CompaniesList` mobile cards include delete action with same confirmation flow as desktop (`DeleteCompanyDialog` or equivalent).
- [ ] Delete button uses `stopPropagation` on card click (pattern from `ClientList`).
- [ ] Permission checks unchanged from desktop delete.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: Fix useIsMobile initial render flash
**Description:** As a mobile user loading the dashboard, I should not briefly see desktop sidebar layout before the mobile sheet mode applies.

**Acceptance Criteria:**
- [ ] `useIsMobile` does not report `false` during SSR/first paint when viewport is mobile OR sidebar defaults to mobile-safe until measured.
- [ ] Acceptable approaches: `undefined` + don’t render collapsible desktop chrome until known; CSS-first hide; or `matchMedia` sync before paint where possible.
- [ ] No layout shift worse than current after fix.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-005: Verify PDF download on mobile after server PDF ships
**Description:** As a user on a phone, I want ticket PDF download to work via the server path without silent failure.

**Acceptance Criteria:**
- [ ] Depends on `prd-mobile-performance.md` US-002 and US-003.
- [ ] Manual test matrix in PR: iOS Safari, Android Chrome (finished ticket with PDF button).
- [ ] On failure, user sees toast error (`PDF001`); no hung loading state &gt;60s.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill (best effort on available targets).

## Functional Requirements

- FR-1: All user-facing phone inputs in client and ticket flows use `type="tel"` and appropriate `autoComplete`.
- FR-2: Login form uses standard autocomplete attributes.
- FR-3: Companies mobile list exposes delete with identical authorization and confirmation as desktop.
- FR-4: `useIsMobile` / `SidebarProvider` coordinated to avoid desktop sidebar flash on viewports &lt;768px.
- FR-5: After server PDF ships, mobile download verified per US-005 (implementation in performance PRD).

## Non-Goals (Out of Scope)

- Server PDF implementation (see `prd-mobile-performance.md`).
- Web Share API (optional future enhancement).
- Offline ticket creation or sync.
- New permissions or roles for mobile-only.
- SMS or click-to-call integration from phone fields.

## Technical Considerations

- `DeleteCompanyDialog` may already exist under `src/app/dashboard/companies/`—reuse.
- Web Share API requires `File` blob and feature detection; not available on all iOS versions.
- `useIsMobile` consumers: `sidebar.tsx` only—verify no other regressions.

## Success Metrics

- 100% of audited phone fields use `type="tel"` on mobile flows (client, ticket create/edit).
- Companies delete available on mobile cards with zero permission bypass bugs.
- PDF success rate on mobile documented; target: no unhandled exceptions in Sentry/logs for PDF path.

## Open Questions

- Should ticket detail phone number be a `tel:` link for one-tap dial?
