# PRD: Mobile Performance

## Introduction

Mobile devices—especially mid-range Android phones used in shops—have less CPU and memory than desktop. ZigZag’s **client-side PDF pipeline** (DOM render → blob) is the main performance and reliability risk on mobile. This PRD adds a **server-generated PDF path in v1**, establishes Lighthouse baselines, and reduces motion cost on the dashboard.

**Locked decisions:** Server-side PDF **in v1** (Q4 B). See `prd-mobile-program-decisions.md`.

## Goals

- Establish baseline mobile performance metrics for critical paths.
- Deliver ticket PDFs via server/API for reliable mobile download (primary path).
- Keep client PDF only as fallback or remove after server path is stable.
- Dashboard remains usable on throttled mobile profiles without unacceptable jank.
- Respect `prefers-reduced-motion` for decorative animations.

## User Stories

### US-001: Mobile performance baseline (Lighthouse)
**Description:** As a developer, I need baseline scores for login, dashboard, and ticket detail on mobile so we can track regressions.

**Acceptance Criteria:**
- [ ] Document Lighthouse mobile runs for: `/login`, `/dashboard`, `/dashboard/tickets` (authenticated—note setup).
- [ ] Record LCP, INP (or TBT proxy), CLS for each URL in PR or `tasks/mobile-lighthouse-baseline.md`.
- [ ] No critical regressions vs baseline when this epic merges (thresholds defined in PR).

### US-002: Server PDF endpoint for tickets
**Description:** As a mobile user, I want to download a ticket PDF from the server so I do not depend on heavy client rendering.

**Acceptance Criteria:**
- [ ] API route or server action generates PDF from ticket `id` (authenticated).
- [ ] Enforces `company_id` / permissions same as existing ticket read (`tickets.read` or equivalent).
- [ ] Returns `application/pdf` with `Content-Disposition: attachment` and filename matching `buildTicketPdfFileName`.
- [ ] Uses existing invoice data builders (`buildInvoiceDataFromTicketDetail` or server-side equivalent).
- [ ] Response time p95 &lt;5s for typical finished ticket on production-like environment.
- [ ] Typecheck/lint passes.
- [ ] Integration test or documented manual script for auth + 403 cases.

### US-003: PDFDownloadButton uses server PDF
**Description:** As any user, I want the download button to use the server PDF so behavior is consistent on mobile and desktop.

**Acceptance Criteria:**
- [ ] `PDFDownloadButton` fetches server PDF by ticket id (or invoice payload id) as **primary** path.
- [ ] Loading and error states unchanged or improved (toast `PDF001` on failure).
- [ ] No infinite spinner &gt;60s; request timeout handled gracefully.
- [ ] Client-side `renderElementToPdfBlob` removed OR kept only as documented fallback behind feature flag (prefer remove if server stable).
- [ ] Manual test: Android Chrome + iOS Safari download/share behavior documented in PR.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-004: prefers-reduced-motion for charts and motion
**Description:** As a user with reduced motion enabled, I want fewer animations so the UI feels stable and performs better.

**Acceptance Criteria:**
- [ ] Recharts `isAnimationActive={false}` when `prefers-reduced-motion: reduce`.
- [ ] `TripledMotionDiv` / framer usage on dashboard respects reduced motion (static render or shortened).
- [ ] No functional loss when motion disabled.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

## Functional Requirements

- FR-1: Lighthouse mobile baseline documented before/after changes.
- FR-2: Server PDF endpoint with auth, tenancy, and permission checks.
- FR-3: `PDFDownloadButton` consumes server PDF; hidden DOM invoice template not required for happy path.
- FR-4: Charts and tripled motion honor `prefers-reduced-motion`.
- FR-5: Production must not accept uploaded PDFs (existing constraint unchanged).

## Non-Goals (Out of Scope)

- Image CDN migration or full bundle audit.
- Database query optimization (separate initiative).
- Replacing Recharts.
- Web Share API wrapper (may be added in functionality PRD if needed after server PDF).

## Technical Considerations

- Evaluate `@react-pdf/renderer`, `pdfkit`, or headless Chromium on server — pick approach that matches current `InvoiceTemplate` layout fidelity.
- Vercel/serverless: watch function size and timeout limits; may need edge-incompatible libs on Node runtime.
- Coordinate with `prd-mobile-functionality.md` — mobile PDF reliability satisfied by this PRD.
- Playwright mobile project can assert button re-enables after click (`prd-mobile-testing.md`).

## Success Metrics

- PDF download success on iOS Safari + Android Chrome for standard finished ticket (manual matrix in PR).
- p95 server PDF generation &lt;5s on staging/production-like env.
- Lighthouse Performance on `/login` (mobile): ≥90 OR documented justification.
- Reduced motion: no mandatory chart animations when OS setting enabled.

## Open Questions

- Single server PDF library vs reuse HTML template via headless browser?
- Migrate desktop to server PDF only, or mobile-only user-agent branch first?
