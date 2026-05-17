## Problem Statement

Ticket PDF invoices do not match the new fintech-style invoice reference. The current PDF flow renders a React invoice template through browser canvas capture, which is slower on client devices and cannot closely preserve the provided vector PDF design. Users need ticket invoices that look like the reference invoice while still using dynamic Company, Client, Service, Ticket, and payment data from Zigzag.

## Solution

Replace the current ticket invoice PDF rendering path with a server-generated, vector PDF invoice based on the provided ReportLab source design. The generated invoice should preserve the reference layout, typography, colors, gradients, cards, payment progress, service table, balance summary, and footer contact sections as closely as practical, while deriving all invoice values from tenant-scoped ticket data.

## User Stories

1. As a company user, I want ticket invoices to use the new fintech invoice design, so that PDFs look professional and consistent with the provided reference.
2. As a company user, I want invoice PDFs to include dynamic Ticket data, so that each invoice reflects the actual ticket being downloaded.
3. As a company user, I want invoice PDFs to include the issuing Company information, so that the recipient knows who issued the invoice.
4. As a company user, I want invoice PDFs to include Client information, so that the recipient can identify the account or customer.
5. As a company user, I want invoice PDFs to include all Service line items, so that the recipient can review what was billed.
6. As a company user, I want invoice PDFs to show subtotal, total, paid amount, and balance due, so that payment state is clear.
7. As a company user, I want partial payments to show a payment progress bar and percentage, so that the collection state is easy to scan.
8. As a company user, I want paid, partial, and pending tickets to render sensible status text, so that invoices do not imply the wrong payment state.
9. As a company user, I want invoices to download from ticket detail and ticket edit flows, so that existing workflows keep working.
10. As a system company user, I want invoice generation to respect selected company context, so that cross-company access remains explicit and controlled.
11. As a tenant user, I want invoice generation to reject tickets outside my Company, so that another tenant's Ticket data cannot leak.
12. As an operator on mobile, I want PDF generation to be server-side, so that downloading an invoice does not depend on heavy browser canvas work.
13. As a developer, I want the invoice data mapping isolated from the PDF renderer, so that financial and formatting behavior can be tested without visual PDF assertions.
14. As a developer, I want the renderer to accept a stable invoice payload, so that layout code does not know about Drizzle rows or auth context.
15. As a developer, I want a repeatable visual QA workflow against the reference PDF, so that future changes can be checked for design drift.

## Implementation Decisions

- Build a deep invoice data adapter that converts an authorized Ticket detail result into a stable invoice payload. The adapter owns ticket number formatting, money inputs, balance due, payment percentage, service counts, status labels, and missing-data fallbacks.
- Build or integrate a ReportLab-based invoice renderer from the provided source design. The renderer accepts only the invoice payload and returns PDF bytes.
- Preserve the reference design as the canonical visual target: A4 page, Helvetica/Helvetica-Bold typography, blue-violet gradient surfaces, dark hero header, rounded cards, service table, payment progress card, payment summary card, large balance banner, and footer contact columns.
- Generate invoices on demand from authoritative database state. Do not accept uploaded PDFs and do not require persisted generated PDFs for this feature.
- Add a server-side PDF delivery flow that authenticates the user, verifies tenant access through `company_id`, loads non-deleted Ticket data with Company and Services, builds the invoice payload, and streams `application/pdf`.
- Keep the PDF function out of Edge runtime. Use free/open-source dependencies only, with ReportLab as the preferred renderer because it matches the provided source and is faster than DOM-to-canvas generation.
- Replace ticket invoice downloads that currently depend on browser DOM screenshot rendering with the new server-generated PDF route or server action.
- Handle dynamic data pressure intentionally: long names, missing emails, missing addresses, multiple Services, zero totals, overpaid tickets, and partial payments should produce readable invoices even when they cannot be pixel-identical to the sample.
- Treat pixel-level fidelity as the target for comparable data. Byte-level equality is out of scope because PDF metadata, compression, object ordering, timestamps, runtime versions, and dynamic data naturally change bytes.

## Testing Decisions

- Tests should focus on external behavior and contracts, not drawing internals. The adapter tests should assert the invoice payload produced for given Ticket/Company/Service/payment inputs.
- Unit test the invoice data adapter for pending, partial, paid, zero-total, and overpaid Tickets.
- Unit test BigInt Ticket ID formatting and money formatting inputs so JSON/PDF delivery does not break on Ticket IDs.
- Unit test missing Company, Client, email, phone, address, and Service description fallbacks.
- Add authorization or integration coverage for the PDF delivery path proving users cannot generate another Company's Ticket invoice.
- Add a renderer smoke test that verifies a valid PDF byte stream is returned and includes expected dynamic text for a representative invoice.
- Add manual or automated visual QA guidance comparing a rendered invoice to the provided reference design. Pixel comparison is valuable for fixed sample data, but human review is still required for layout behavior with varied data.

## Out of Scope

- Byte-equal reproduction of the provided PDF.
- Paid third-party PDF rendering services.
- Persisting generated invoice PDFs in storage.
- Accepting uploaded PDFs in production.
- Changing Ticket payment audit behavior.
- Redesigning the broader ticket UI outside the download flow.
- Full invoicing/accounting features such as tax calculation, due-date workflows, external invoice numbers, or fiscal compliance beyond the existing Ticket invoice data.

## Further Notes

- The provided ReportLab source is the best implementation reference for fidelity and speed.
- GitHub issue publishing is currently blocked because the local `gh` token is invalid; this PRD is captured locally until `gh auth login -h github.com` is completed.
