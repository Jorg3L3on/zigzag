# PRD: Service Description Limit + Production CSV Import

## Problem Statement

Company operators managing the Service catalog hit two gaps. First, Service descriptions can grow without bound in the create/edit form and via CSV import, which hurts list readability and invoice/PDF line clarity. Second, CSV import for Services is a hidden file picker on the list page: it does not reliably show newly imported rows (the list keeps client-side state while import only calls a route refresh), offers no real progress for multi-row files, and only surfaces counts via brief toasts—unsuitable for production catalog onboarding.

## Solution

Cap Service description length at 120 characters everywhere the catalog is written (form, Server Actions, CSV). Replace the list-page inline import with a dedicated `/services/import` flow: download a Spanish plantilla, upload a CSV, always preview row outcomes (ok / skip duplicate / error), confirm, import in chunks with a real progress bar, then show a durable summary with a downloadable error/skip report and a clear path back to the refreshed catalog. Extract shared CSV import primitives so Clients/Tickets can reuse them later without migrating in this pass.

## User Stories

1. As a Company operator with `services.write`, I want Service descriptions limited to 120 characters when creating a Service, so that catalog text stays concise and consistent.
2. As a Company operator, I want a live `n/120` character counter on the description field, so that I know how much space remains while typing.
3. As a Company operator editing an existing Service whose description already exceeds 120 characters, I want the form to load the full text and block save until I shorten it, so that I can fix legacy data without silent truncation.
4. As a Company operator, I want create and update Server Actions to reject descriptions over 120 characters, so that the limit cannot be bypassed outside the UI.
5. As a Company operator importing Services from CSV, I want rows with description over 120 characters marked as errors in preview, so that I can fix the file before writing.
6. As a Company operator on the Services list, I want to keep exporting the catalog as CSV, so that backup and offline editing still work.
7. As a Company operator on the Services list, I want “Importar CSV” to take me to a dedicated import page, so that import gets a proper workspace instead of a silent file picker.
8. As a Company operator without `services.write`, I want import entry points hidden or denied, so that RBAC stays honest.
9. As a Company operator on `/services/import`, I want to download a plantilla CSV with Spanish headers and two example rows, so that I know the expected format.
10. As a Company operator, I want exported Services CSVs to use Spanish headers `nombre,descripción,precio`, so that files match the Spanish product UI.
11. As a Company operator with an older English-header export (`name,description,price`), I want import to still accept those columns, so that legacy files keep working.
12. As a Company operator, I want import to also accept unaccented `descripcion`, so that tools that strip accents do not break my file.
13. As a Company operator, I want to drop or select a `.csv` file on the import page, so that upload is obvious and accessible.
14. As a Company operator uploading an empty data file, I want a clear Spanish error before preview, so that I do not think the system hung.
15. As a Company operator uploading more than 500 data rows, I want the file rejected before preview with a clear max-rows message, so that imports stay within Server Action limits.
16. As a Company operator after a valid upload, I want an automatic dry-run preview (never write yet), so that I can review outcomes before committing.
17. As a Company operator in preview, I want each row classified as ok, skip (duplicate), or error with a reason, so that I understand what will happen.
18. As a Company operator, I want duplicates detected by case-insensitive match on active Service `name` within my Company, so that I do not create duplicate catalog entries.
19. As a Company operator, I want a soft-deleted Service with the same name to allow a new insert, so that soft-delete semantics stay consistent with the rest of ZigZag.
20. As a Company operator, I want preview summary counts for ok / skipped / failed, so that I can decide whether to confirm.
21. As a Company operator, I want to cancel or go back from preview without writing anything, so that dry-runs are safe.
22. As a Company operator confirming import, I want only “ok” rows written in chunks of 50, so that large files progress reliably.
23. As a Company operator during import, I want a real progress indicator based on chunks completed (e.g. 100/250), so that I know the job is advancing.
24. As a Company operator, I want the import to stop immediately if a chunk fails (network/server), so that partial failure is easy to reason about.
25. As a Company operator after a stopped partial import, I want a clear partial summary of what was already inserted, so that I know the catalog state.
26. As a Company operator re-uploading after a partial import, I want already-inserted names to appear as skips, so that retry is safe.
27. As a Company operator after import finishes, I want an on-page results summary (inserted / skipped / failed), so that I am not dependent on a disappearing toast.
28. As a Company operator, I want to download a report of skipped and failed rows with reasons, so that I can fix the source file offline.
29. As a Company operator, I want a primary CTA “Ver catálogo” that lands on a refreshed Services list showing new rows, so that successful imports are visible immediately.
30. As a Company operator, I want a secondary CTA “Importar otro archivo” that resets the flow, so that I can continue onboarding the catalog.
31. As a Company operator, I want invalid price or missing required fields to fail at row level with Spanish messages, so that one bad row does not opaque the whole file.
32. As a System company user with a selected Company context, I want import/export scoped to that Company, so that tenant isolation holds.
33. As a System company user without a selected Company, I want a clear select-company message instead of a misleading import, so that cross-tenant navigation stays safe.
34. As a product owner, I want no database column migration for description length in v1, so that we avoid migrating legacy long text while still enforcing at the app layer.
35. As an implementer, I want a shared description-limit constant and Zod schema reused by form and actions, so that UI and server cannot drift.
36. As an implementer, I want a pure Service CSV schema module (headers, aliases, plantilla, row cap), so that parsing rules are unit-testable.
37. As an implementer, I want a pure import preview planner that classifies rows given existing active names, so that dry-run logic is testable without React.
38. As an implementer, I want a chunk import runner helper (size 50, stop on first failure, no automatic retry), so that progress and partial-failure behavior are testable.
39. As an implementer, I want Server Actions for dry-run preview and chunked commit (plus updated export), so that duplicate checks and writes stay Company-scoped on the server.
40. As an implementer, I want shared data-portability UI primitives (progress, results summary types) extracted without migrating Clients/Tickets yet, so that the next module reuses the pattern.
41. As a QA engineer, I want unit tests for limit validation, header aliases, preview classification, chunking/stop behavior, and action RBAC/tenant denial, so that regressions are caught without full E2E.
42. As a Company operator on mobile, I want the import page usable on narrow viewports (dropzone, preview, CTAs), so that catalog import works on phone/PWA.
43. As a Company operator, I want prices rounded to cents on insert like today’s import, so that money handling stays consistent.
44. As a Company operator, I want each successfully inserted Service to still record resource audit as today, so that catalog provenance is preserved.
45. As a maintainer, I want Clients and Tickets CSV toolbars left unchanged in this PRD, so that scope stays focused on Services while shared primitives land.

## Implementation Decisions

### Description limit (no schema migration)

- Canonical max length: **120** characters for Service `description`.
- Enforce in: Service form Zod + `maxLength`/counter UI; `createService` / `updateService`; CSV dry-run and commit validation.
- Do **not** change the Drizzle `text` column or add a migration in v1.
- Edit UX for legacy over-limit rows: show full value, counter in error state (`n/120`), block submit until trimmed. No auto-truncate.

### CSV headers and plantilla

- Canonical export headers (Spanish): `nombre`, `descripción`, `precio`.
- Import accepts those headers plus aliases: `descripcion` (no accent), and English `name`, `description`, `price`.
- Plantilla download: headers + two clearly fake example rows; UTF-8 with BOM (existing export pattern).
- Max **500** data rows per file; reject before preview if over limit.

### Duplicate and soft-delete rules

- Skip when an **active** Service (`deleted_at` null) in the Company has the same `name` (case-insensitive trim).
- Soft-deleted same name: **allow insert** (not a duplicate).
- No upsert in v1.

### Import page flow

Route: `/services/import` (requires `services.write`; read-only users denied).

Steps:
1. Instructions + “Descargar plantilla” + file dropzone/picker.
2. Parse client-side → call server **dry-run preview** (active names + validation) → preview table + counts.
3. User confirms → write only `ok` rows in chunks of **50** via Server Action(s).
4. Progress = chunks completed / total chunks.
5. On chunk failure: **stop immediately** (no automatic retry); show partial summary.
6. Results: inserted / skipped / failed; downloadable report of skip+error rows; CTAs “Ver catálogo” and “Importar otro”.

### List page entry

- Keep **Exportar CSV** on the Services list.
- Replace inline import file picker with navigation to `/services/import`.
- After “Ver catálogo”, Services list must refetch client state so new rows appear (fix the current `router.refresh()`-only gap).

### Modules

1. **Service description limits (deep)** — shared constant + Zod helpers for form and actions.
2. **Service CSV schema (deep)** — Spanish headers, aliases, plantilla builder, row-cap validation.
3. **Import preview planner (deep)** — pure classifier: `ok` | `skip` | `error` + reasons + counts, given records and existing active names.
4. **Chunk import runner (deep)** — split into 50-row chunks; progress callbacks; stop on first failure; no retry.
5. **Service Server Actions** — `previewServiceCsvImport` (or equivalent); chunked `commitServiceCsvImport` (or evolve `bulkImportServices`); export with Spanish headers; create/update enforce 120.
6. **Service form UI** — counter + over-limit block.
7. **Services import page UI** — full flow above.
8. **Services list entry wiring** — export stay; import link; reliable refetch after return.
9. **Shared data-portability primitives** — reusable progress/results pieces under the existing data-portability area; do not migrate Clients/Tickets CSV in this PRD.

### Multi-tenancy / auth

- All preview and commit queries filter by effective `company_id` from `requireActionPermission('services.write')` (and read for export).
- System company users operate on selected Company context only.
- Soft-delete filters: active names for duplicate detection use `deleted_at IS NULL`.

### Money and audit

- Keep `roundMoney` on imported prices.
- Keep per-inserted Service resource audit events (`created`, source action) as today.

## Testing Decisions

Good tests assert external behavior only (validation outcomes, classification, summaries, permission denials)—not React internals or private helpers’ structure.

**Test these modules:**
- Service description limit helpers / Zod (accept 120, reject 121, trim behavior as specified).
- Service CSV schema (Spanish export headers, alias acceptance, plantilla shape, 500-row cap).
- Import preview planner (ok / skip active duplicate / allow soft-deleted name / field errors / description length).
- Chunk import runner (chunk size 50, progress signals, stop on first failure, no retry).
- Server Action contracts: preview and commit RBAC/tenant denial; skip duplicates; partial commit semantics as exposed by the API (prior art: `services-actions.test.ts`, `csv.test.ts`, clients bulk-import tests).

**Light / optional:** Service form counter blocking; import page smoke if existing component-test patterns fit.

**Not required for v1:** Playwright E2E happy path (may add later).

## Out of Scope

- Migrating Clients or Tickets CSV import/export to the new page/flow (shared primitives only).
- Database `varchar(120)` migration or forced truncation of existing long descriptions.
- Upsert-by-name or restore-soft-deleted-on-match.
- Background job queue / polling for imports.
- Automatic retry of failed chunks.
- Column mapping UI beyond fixed header aliases.
- Changing Service `name` uniqueness in the schema (application-level skip only).
- Offline PWA sync of catalog imports.

## Further Notes

- Product copy for the import page and errors should be Spanish, consistent with the rest of the dashboard.
- Feature slug suggestion for later shipping: `services-csv-import` (integration branch `feat/services-csv-import` when sliced).
- Grill decisions locked in chat: app-wide 120 without DB migration; skip active duplicates; dedicated page; always preview; soft-deleted allows insert; list keeps export / import navigates; 500 rows / chunk 50; Spanish export + aliases on import; edit blocks over-limit; results + downloadable report; stop on chunk failure; shared primitives without Clients/Tickets migration; plantilla with two examples.
