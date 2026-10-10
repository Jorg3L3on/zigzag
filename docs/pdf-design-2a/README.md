# Handoff: Zigzag Presupuesto / Recibo (design "2a")

## Overview
Redesign of the PDF document Zigzag generates for quotes (**Presupuesto**) and receipts (**Recibo**). One Letter page, monochrome (ink `#141414` on white) so it prints identically in black & white. Both document types share the exact same layout — only the title changes.

## About the design files
`receipt-template.html` is a **design reference in HTML/CSS** — a faithful, framework-agnostic rendition of the approved design using Mustache-style placeholders. Recreate it inside Zigzag's existing PDF/receipt generation pipeline (whatever templating engine or PDF library it already uses). If the pipeline renders HTML → PDF (Puppeteer, wkhtmltopdf, WeasyPrint, etc.) the template can be adapted nearly verbatim. If it uses a drawing API (PDFKit, ReportLab, jsPDF…) reproduce the measurements below.

`sample-data.json` is the data shape the template expects, filled with the sample from the original PDF. `Zigzag Receipt.dc.html` is the original interactive design file — open `#2a` for the approved version (ignore 1a–1c and 2b, they are rejected explorations).

## Fidelity
**High-fidelity.** Reproduce spacing, typography and rules exactly. No colors other than the neutrals listed.

## Page
- Size: US Letter, 8.5 × 11 in (816 × 1056 px @ 96 dpi), portrait, single page.
- Padding: top 56px, sides 64px, bottom 48px. Content is a vertical flex column; a flexible spacer pushes the footer to the bottom.
- Background white. Never add shadows/borders on the page itself.

## Typography
- Sans: **IBM Plex Sans** (400 / 500 / 600). Fallback Helvetica / Arial.
- Mono: **IBM Plex Mono** (400 / 500) for every number: folio, dates, quantities, prices, amounts, item indices.
- Google Fonts: `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap` — embed the font files in the PDF pipeline so output doesn't depend on network.
- Section labels ("Cliente", "Concepto", "Teléfono"…): 10px, uppercase, letter-spacing .14em, `#777`.

## Colors (all neutrals)
- Ink `#141414` — text, rules, pill, status dot
- Body secondary `#444` · muted `#555` · label grey `#777` · hint `#999`
- Hairline `#e2e2de` · dashed row divider `#d6d6d1` · dotted leader `#aaa`
- Totals panel fill `#f4f4f1`

## Layout, top to bottom

### 1. Header (flex, space-between, align top)
Left — brand block (flex row, gap 14px, centered):
- **Logo** (dynamic): `<img>` 44px tall, max 160px wide, `object-fit: contain`, left-aligned. **If no logo**, render a 44px circle, 1.5px ink border, with the company's first initial (16px, 600).
- Company **name** 15px/600 (dynamic) and **tagline** 11.5px `#777` (dynamic, e.g. "Climatización · Servicio técnico"), stacked, gap 3px.

Right — document block (right-aligned, gap 8px):
- Title: `PRESUPUESTO` or `RECIBO`, 34px, weight 500, letter-spacing −.02em, line-height 1.
- `Folio 001114` — mono 12px, ink.
- Issue date — mono 12px `#555`, format `DD / MM / YYYY`.

### 2. Double rule
2px ink bar, 3px gap, 1px ink bar. Top margin 32px. (Used twice: after header and before the items table.)

### 3. Meta grid (3 equal columns, top margin 28px)
Columns 2 and 3 have a 1px `#e2e2de` left border; inner horizontal padding 24px.
1. **Cliente** — name 15px/600; phone and country 13px `#444`, line-height 1.5.
2. **Fecha de emisión** — date 15px/600; "Vigencia 30 días" / "Vence DD / MM / YYYY" 13px `#444`.
3. **Estado** — status **pill**: 1px ink border, radius 999px, padding 4px 10px, 11px uppercase 600, letter-spacing .1em, with a 6px ink dot before the label. Label `Pendiente de pago` when nothing is paid, `Pago parcial` when 0 < paid < total, `Pagado` when settled (ZIG-I12). Below: "`N` conceptos" 13px `#444`.

### 4. Double rule (same as §2)

### 5. Items table (top margin 12px)
Columns: Concepto (flexible) · Cantidad 80px · Precio unitario 130px · Importe 120px. Numeric columns right-aligned, mono 13px; Importe weight 500.
- Header row: label style, padding-bottom 10px, 1px ink bottom border.
- Rows: padding 16px 0, **1px dashed** `#d6d6d1` bottom border, baseline aligned.
- Concepto cell: two-digit index (`01`, `02`… mono 11px `#999`) then name 14px/600 and description 12.5px `#666` (3px below). Description optional. Names, descriptions and material names wrap over as many lines as they need (no clamp, ZIG-I12); a word wider than the column breaks by characters.
- Wide amounts (ZIG-I12): the Concepto column keeps at least 45% of the table. When 10-digit amounts would take more, table cells drop the ` MXN` suffix (totals keep it); if that is still too wide the numbers scale down, never below 70% of 13px. Cantidad is capped at 120px: a unit that does not fit beside the number wraps on lines under it.

### 6. Totals panel (right-aligned, top margin 28px)
320px wide, fill `#f4f4f1`, padding 18px 20px, rows gap 10px, 13px:
- Rows `Subtotal`, `IVA` (or `IVA (16%)` when applied), `Total`, `Pagado` — label `#555` left, dotted leader (`1px dotted #aaa`) filling the middle, mono value right.
- 1px ink separator (margin 6px 0 2px).
- `Saldo por pagar` 14px/600 left; value mono **24px/500** right, scaled down when a 10-digit figure would pass the panel's inner width.

### 6b. Notas / Condiciones y notas (ZIG-I12)
Only when the document has notes (`work_notes`). Top margin 28px under the totals panel, full content width. Label `NOTAS` (recibo) / `CONDICIONES Y NOTAS` (presupuesto) in the label style, 8px above the body: 12.5px `#444`, line-height 1.5, wrapped. A blank line in the source is a 9px gap (runs of blank lines collapse to one). The block paginates by line: it needs the label plus 2 lines to start on a page, otherwise it starts on the next page; continuation pages repeat the header and meta, skip the table header, and carry the label with `(CONT.)`. The footer stays on the last page.

### 7. Spacer (flex: 1)

### 8. Footer (grid 1fr / 1.2fr / 2fr, gap 24px)
1px ink top border, padding-top 16px. Three stacked label + value groups: **Teléfono**, **Correo**, **Dirección** (12px `#444`, line-height 1.45, gap 4px). All dynamic company data.

### 9. Colophon (18px below footer)
10px `#999`, letter-spacing .04em, space-between: left `PRESUPUESTO 001114 · Página 1 de 1`, right `Powered by zigzag`.

## Data model
See `sample-data.json`. Dynamic fields:
- `docType` → title `PRESUPUESTO` | `RECIBO`
- `folio`, `issueDate`, `validityDays`, `expiryDate` (= issue + validity)
- `company.{name, tagline, logoUrl, phone, email, address}` — logo/name/tagline are per-business settings
- `client.{name, phone, country}`
- `items[].{index, name, description, quantity, unitPrice, amount}`
- `subtotal`, `taxLabel`, `tax`, `total`, `paid`, `balanceDue`
- `statusLabel` derived from `balanceDue`

Currency format: `$1,234.00 MXN` (symbol, thousands separator, 2 decimals, code suffix). Alternative accepted: `MXN 1,234.00`.

## Terminology (Mexico, non-CFDI document)
Use exactly: **Folio**, **Fecha de emisión**, **Vigencia / Vence**, **Cliente**, **Estado**, **Concepto**, **Cantidad**, **Precio unitario**, **Importe**, **Subtotal**, **IVA**, **Total**, **Pagado**, **Saldo por pagar**. Status: **Pendiente de pago** / **Pago parcial** / **Pagado**.
Recommended (optional) legal note near the totals or footer: *"Este documento no es un Comprobante Fiscal Digital (CFDI) y no tiene validez fiscal."* The client removed the conditions block from the approved layout; add it back only if business requires it.

## Behavior / edge cases
- Many items: keep header row on each page if the table paginates; repeat the footer on the last page only. The design was approved for one page — keep item rows compact (16px padding) before shrinking type.
- Long names and descriptions wrap inside the Concepto column; numeric columns keep their design width until a value needs more (see §5).
- Characters the embedded IBM Plex fonts cannot draw (emoji, CJK, Arabic, Devanagari…) are stripped from every printed text and leftover spaces collapse (`src/lib/pdf-text-support.ts`); the composer warns while typing.
- Logo aspect: any — constrained to 44px height / 160px width, never cropped or stretched.
- Print: force background colors (`print-color-adjust: exact`) so the `#f4f4f1` totals panel prints; in pure B&W it degrades to light grey, which is intended.

## Files
- `receipt-template.html` — HTML/CSS reference with placeholders (open in a browser to view with placeholder text)
- `sample-data.json` — data shape + sample values
- `Zigzag Receipt.dc.html` — original design exploration; `#2a` is the approved design
