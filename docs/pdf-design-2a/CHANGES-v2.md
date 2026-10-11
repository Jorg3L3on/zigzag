# Change request: Zigzag Presupuesto / Recibo — revision 2

Applies on top of the previously implemented design (`README.md`, design "2a"). Three changes. Updated reference files: `receipt-template.html`, `sample-data.json`, `Zigzag Receipt.dc.html` (`#2a`).

## 1. Header — remove the date under Folio
The right-hand document block is now only two lines: title (`PRESUPUESTO` / `RECIBO`) and `Folio 001116`. The issue date lives only in the **Fecha de emisión** meta column.

## 2. Items — services with materials become groups
**Problem observed in production:** a service row showed `Cantidad 1 · Precio unitario $66.00 · Importe $566.00` because materials were rolled into the service's Importe, and the material appeared as an unlabeled sub-row. The row arithmetic looked wrong and the client could not tell service price from material price.

**Rule:** every row's Importe must equal its own `cantidad × precio unitario`. Never add child amounts into a parent row.

Each concept renders as a group inside one dashed-bordered block (`padding: 16px 0 14px; border-bottom: 1px dashed #d6d6d1`):

1. **Service row** (unchanged style): index, name 14px/600, description 12.5px `#666`; `cantidad`, `precio unitario`, `importe` = service only.
2. **Materials block** — only if the service has ≥1 material. Indented 30px from the left, 14px inner padding, `1px solid #d6d6d1` left border, 12px above, children gap 8px:
   - Label `MATERIALES` (10px uppercase, .14em, `#777`).
   - One row per material, same 4-column grid as the table (`1fr 80px 130px 120px`), 12.5px `#444`, numbers mono: name · `qty unit` (e.g. `3 m`, `1 pza`) · unit price · `qty × unit price`.
   - Group subtotal row: `1px dotted #c8c8c3` top border, 8px padding-top; left `Subtotal {service name}` 12px `#444` followed by `(servicio + materiales)` in `#888`; right mono 13px/600 = service importe + sum of material importes.
3. Services **without** materials render just the service row (no block, no subtotal line).

## 3. Totals card — drop Subtotal and IVA
IVA will never be charged. Card rows, in order, inside the same `#f4f4f1` panel with dotted leaders:
- `Servicios` — sum of all service importes
- `Materiales` — sum of all material importes
- thin `#d6d6d1` separator
- `Total` — Servicios + Materiales
- `Pagado`
- 1px ink separator
- `Saldo por pagar` (14px/600 · value mono 24px/500)

Remove any IVA / Subtotal fields, toggles and legend text ("Precios sin IVA") from the implementation.

## Data model changes
```
items[]: {
  index, name, description, quantity, unitPrice, amount,   // amount = quantity × unitPrice, service only
  materials: [ { name, quantity, unit, unitPrice, amount } ], // may be empty
  groupTotal                                                 // amount + Σ materials.amount
}
totals: { services, materials, total, paid, balanceDue }     // subtotal, tax removed
```
See `sample-data.json` — one service with two materials, one without.
