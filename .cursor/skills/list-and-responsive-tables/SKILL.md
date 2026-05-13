---
name: list-and-responsive-tables
description: >-
  Mandatory dashboard list pattern: TripledPageHeader, Card shell, TripledDataPanel,
  client *List components, debounced search plus button filters, @tanstack/react-table
  DataTable with sortable columns and URL/state helpers, plus md:hidden mobile cards.
  Use when creating or refactoring src/app/dashboard/** list pages or *List components.
disable-model-invocation: true
---

# List & responsive tables (Zigzag dashboard)

When creating or updating **list pages** under `src/app/dashboard/**` (e.g. tickets, clients, services, companies), follow this pattern.

## Mandatory (every list page)

These three requirements apply to **all** resource lists — no “simple list” exception:

1. **Filters** — Include **debounced search** (`searchValue` + `debouncedSearch`) **and** **button-based filters** for the resource’s key dimensions (status, state, payment, etc.). Place filters inside **`TripledDataPanel`** above the data view. Filter on the appropriate fields per resource (e.g. tickets: id, client name, phone, email; companies: name, email, phone).

2. **Ordering** — Expose **user-controlled column sorting** via **`@tanstack/react-table`**: `SortingState`, sensible **`DEFAULT_*_SORTING`**, sortable column headers (see **`TicketSortableHeader`**), and the same **encode/decode** helpers when the module uses URL persistence (`encodeSortingState`, `decodeSortingState`). Mobile card order must follow the **same sorted row order** as desktop.

3. **DataTable** — The **desktop** view MUST be a **DataTable** implemented with **`@tanstack/react-table`** (e.g. column definitions in `*-columns.tsx`, `useReactTable`, `getCoreRowModel`, `getSortedRowModel`, and filtered row model as needed). Do **not** ship a dashboard list whose desktop UI is only hand-mapped `<Table>` rows without TanStack. Reference **`TicketsList`** / **`tickets-columns.tsx`** as the baseline.

## Layout & shell

- Use a **page-level header**:
  - `TripledPageHeader` at the top with the resource label (e.g. "Tickets", "Clientes", "Empresas").
  - A central `Card` with:
    - `CardHeader` containing title, description, and a primary CTA button (e.g. "Nuevo Ticket", "Nueva empresa").
    - `CardContent` wrapping the list component.
- Prefer **`TripledDataPanel`** inside the list component (see `ClientList`, `ServicesListClient`, `CompaniesList`) for:
  - Title + description.
  - Search input (debounced).
  - Primary CTA button.

## Data fetching & error handling

- Fetch data in a **client list component**, not directly in the page:
  - Tickets: `TicketsList`
  - Clients: `ClientList`
  - Services: `ServicesListClient`
  - Companies: `CompaniesList`
- Show three distinct states:
  - **Loading**: centered `Loader2` spinner.
  - **Error**: `TripledEmptyState` with an explicit error message and optional “Reintentar” button.
  - **Empty**: `TripledEmptyState` with "Sin resultados" and a short explanation.

## Filters & search (required detail)

- **Search**: Maintain `searchValue` and **`debouncedSearch`**; apply search to the row model before or inside the table pipeline.
- **Filters**: Button filters examples — Tickets: payment status, finished / PDF presence (`TicketsList`); Services: `statusFilter` (`active`, `deleted`, `all`); Companies: (`all`, `active`, `inactive`).

## Desktop DataTable + mobile cards

- **Mobile (`md:hidden`)**:
  - Render each row as an `<article>` / `<div>` card from the **same filtered + sorted row model** as the DataTable.
  - Clickable area → edit/detail (`router.push`); keyboard: `tabIndex={0}`, `role="button"`, `Enter` / `Space`.
  - Core fields in a `<dl>` where it fits; status badges; inline **Edit** / **Delete** with `event.stopPropagation()`.

- **Desktop (`hidden md:block`)**:
  - **`@tanstack/react-table`** DataTable with `Table`, `TableHeader`, `TableRow`, `TableCell` rendered from the table instance.
  - Rows: clickable + keyboard accessible for navigation; row actions use `stopPropagation()`.
  - Overflowing text: `line-clamp-*`, `max-w-*`.

## When adding a new list

- Add `src/components/<resource>/*-columns.tsx` and a `*List` client component.
- Mirror **`TicketsList`**: `TripledPageHeader`, page **`Card`**, **`TripledDataPanel`**, loading/error/empty, **mandatory** filters + **DataTable** + **sorting**, and **`md:hidden`** cards.
- Re-use `FormattedDate`, `FormattedCurrency`, badges, shared filter buttons.

## Reference

Aligned with `.cursor/rules/lists-and-responsive-tables.mdc` (`src/app/dashboard/**/page.tsx`).
