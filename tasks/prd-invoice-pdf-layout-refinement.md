## Problem Statement

The fintech Ticket invoice PDF still packs too much into the dark header (amounts, payment percentage, progress bar, and Company address that already appears in the footer), while Client details are under-emphasized in a thin strip and money is split across a summary card plus a separate unpaid balance banner. Table column headers are also hard to scan: they are small, and Precio/Importe do not line up with the money values. Operators need a cleaner invoice that leads with Company identity and payment status, highlights the Client, densifies the Service table, and consolidates Total / Pagado / Por pagar into one closing card.

## Solution

Refine the existing server-generated fintech Ticket invoice PDF layout (payload adapter + vector renderer) without changing download auth or the API delivery path. Compact the dark header to logo, Company name, status badge, Ticket number, and issue date. Promote Client name, phone, country, and optional address into a soft-blue card. Enlarge and correctly align Service table headers while tightening row vertical padding. Replace the split money UI with a single “Resumen de pago” card (Total, Pagado, and Por pagar only when unpaid; Subtotal/Ajuste only when an adjustment exists). Keep Company contact details in the footer only.

## User Stories

1. As a company user, I want the PDF header to show Company identity and payment status without large money figures, so that the first glance is brand and status rather than balance.
2. As a company user, I want Company address removed from the dark header, so that address is not duplicated above the footer contact block.
3. As a company user, I want Ticket number and issue date inside the dark header, so that I do not need a separate meta strip under the hero.
4. As a company user, I want the payment progress bar and percentage removed from the header, so that payment progress is not competing with status.
5. As a company user, I want Client information in its own soft-blue card, so that the billed party is easy to find.
6. As a company user, I want Client name rendered larger than today, so that the primary Client identifier stands out.
7. As a company user, I want Client phone shown when available, so that the recipient can contact the account holder.
8. As a company user, I want Client country shown when available as its own field, so that country remains scannable.
9. As a company user, I want Client address shown when the linked Client has address data, so that the invoice can include delivery/billing location.
10. As a company user, I want empty Client phone, country, or address fields omitted entirely, so that the card does not show placeholder “Sin …” rows.
11. As a company user, I want Client address lines to exclude country when País is shown separately, so that country is not printed twice.
12. As a company user, I want Service table column headers larger and in a slightly taller header band, so that columns are easier to read.
13. As a company user, I want Precio and Importe headers right-aligned to their money columns, so that headers visually match amounts.
14. As a company user, I want Cant. centered with its quantity values, so that the quantity column is aligned.
15. As a company user, I want tighter vertical padding on Service rows, so that more line items fit without crushing two-line names/descriptions.
16. As a company user, I want all money totals in one card titled “Resumen de pago”, so that payment math has a single home on the page.
17. As a company user, I want that card to show Total and Pagado always, so that billed vs collected amounts are clear.
18. As a company user, I want Por pagar shown only when the Ticket still has a balance due, so that a fully paid invoice does not imply money is owed.
19. As a company user, I want Por pagar emphasized with bold type and a divider above it when shown, so that remaining balance is obvious without a separate banner.
20. As a company user, I want the unpaid balance banner removed, so that the same amount is not highlighted twice.
21. As a company user, I want Subtotal and Ajuste inserted above Total only when Ticket total differs from the Service line sum, so that adjustments stay visible without cluttering normal invoices.
22. As a company user, I want Company phone, email, and address to remain in the footer, so that issuer contact details are still available.
23. As a company user, I want paid Tickets to keep showing SALDADO and unpaid/partial Tickets PENDIENTE in the header badge, so that status language stays consistent.
24. As a company user, I want multi-page Service continuations to keep working with the denser row layout, so that long Tickets still paginate cleanly.
25. As a system company user, I want this layout change to keep respecting selected Company context on download, so that cross-tenant invoice generation stays controlled.
26. As a tenant user, I want invoice generation to keep rejecting Tickets outside my Company, so that tenant isolation is unchanged.
27. As an operator on mobile, I want invoices to remain server-generated, so that download does not depend on browser canvas rendering.
28. As a developer, I want Client address mapping isolated in the payload adapter, so that address inclusion rules can be tested without PDF drawing assertions.
29. As a developer, I want the renderer to consume only the stable invoice payload, so that layout code does not know about Drizzle rows.
30. As a developer, I want existing PDF smoke tests updated only as needed, so that valid PDF generation remains covered without pixel-diff tests.
31. As a developer, I want Client address formatting to reuse the existing Client address helper (adjusted to omit country from the address string), so that address rules stay in one place.
32. As a product reviewer, I want visual QA against a pending and a saldado sample Ticket, so that header, client card, table alignment, and totals card can be checked by eye.

## Implementation Decisions

- Modify the fintech invoice **payload adapter** (Ticket + Company + Client → stable payload). Extend Client payload fields with optional address text derived from the linked Client. Omit empty phone, country, and address from the payload (or mark them optional so the renderer can omit them). Do not invent “Sin teléfono” / “Sin país” / “Sin dirección” rows for the refined client card.
- Reuse the existing Client address formatting helper for the address line, adapted so **country is excluded** from that string because País is a dedicated field. Prefer extending or wrapping the helper over duplicating street/city/CP logic inside the PDF path. Fall back to legacy free-text Client address only when structured parts are empty, still excluding a duplicated country when País is present.
- Keep money fields the renderer needs: total, paid, balanceDue, subtotal, adjustmentAmount, hasAdjustment, statusLabel. Remove header dependency on payment progress bar/percentage and on large balance display; payload may drop unused progress fields if nothing else consumes them, or leave them unused — prefer deleting dead fields if tests and callers allow.
- Modify the fintech invoice **PDF renderer** only for layout. Do not change the Ticket invoice API route auth, tenant checks, or download UX entry points.
- **Dark header (two rows):** top = issuer logo + Company name | status badge; bottom = Ticket No. left, Fecha right. Remove Company address, large amount, paid/total subtitle, progress bar, and percentage from the header. Remove the separate white meta strip under the header (ticket/date live in the dark card). Shrink header height to fit the compact content.
- **Client card:** soft-blue filled shadow card (distinct from white services/totals cards). Stacked: “Cliente” label → large bold name → Teléfono (if present) → País (if present) → Dirección (if present). Name always shown (Ticket client_name snapshot with existing fallback).
- **Service table:** enlarge column headers to roughly 8.5–9pt bold uppercase inside a slightly taller tinted header pill. Right-align Precio and Importe headers to the same anchors as money values; center Cant. with quantity. Reduce row vertical step to roughly 40–42pt while still allowing name + short description wrapping.
- **Totals card:** single full-width “Resumen de pago” card after the services table. Always show Total and Pagado. Show Por pagar only when balanceDue > 0, with a divider above and bold emphasis. When hasAdjustment, show Subtotal and Ajuste above Total in the same card. Remove the separate unpaid balance banner entirely.
- Footer Company phone / email / address columns remain as today.
- No schema or migration changes. No change to Ticket payment audit events. No redesign of the legacy React/html2pdf invoice template in this PRD.
- Slice work should land on the feature branch for this PRD per deployment conventions; production merge stays on main when the PRD is complete.

## Testing Decisions

- Good tests assert external behavior and contracts (payload shape and money/status rules), not jsPDF drawing coordinates or pixel diffs.
- **Payload adapter:** unit tests for Client address inclusion when structured address exists; omission when empty; country not duplicated in address text; paid Tickets still expose balanceDue 0 so renderer can hide Por pagar; unpaid/partial expose positive balanceDue; adjustment flag when Ticket total differs from line sum. Prior art: existing fintech invoice payload tests covering status, progress, country fallback, and missing client fields.
- **Client address helper:** unit tests if the helper’s public behavior changes to support country-excluded formatting (empty → empty string; structured parts without country; legacy address fallback). Prior art: existing company/client address helper tests.
- **PDF renderer:** keep smoke tests that a valid PDF byte stream is returned for representative pending, paid, and adjustment cases; update fixtures only if payload shape changes. Do not add layout-coordinate assertions.
- Manual visual QA: download one PENDIENTE and one SALDADO Ticket invoice and verify header, client card, table header alignment, denser rows, and single totals card (no banner).

## Out of Scope

- Changing Ticket invoice authentication, RBAC, or tenant isolation on the download API.
- Persisting generated PDFs or accepting uploaded PDFs.
- Redesigning dashboard Ticket UI outside the PDF.
- Fiscal/tax compliance features, due-date workflows, or external invoice numbering.
- Pixel-perfect byte equality with any reference PDF.
- Reworking the legacy DOM/html2pdf invoice template path.
- Database schema changes.
- Changing Ticket payment or status audit event behavior.
- Reintroducing payment progress percentage/bar elsewhere on the PDF.

## Further Notes

- Design decisions were locked in a grill session: compact header option B (ticket/date inside dark card); remove unpaid banner; totals card option B with Por pagar omitted when paid; client card soft-blue stacked layout with optional address; address vs País option B; table headers option C; denser rows ~40–42pt; totals wording Total / Pagado / Por pagar under “Resumen de pago”; omit empty client fields.
- Domain terms to keep in issues/PRs: Company, Ticket, Client, Service, soft delete, Server Action / API route as applicable. This work stays on the existing server-side invoice PDF path.
- Parent fintech invoice PDF work already shipped the vector renderer; this PRD is a layout refinement on that foundation.
