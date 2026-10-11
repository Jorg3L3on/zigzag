import { sql } from 'drizzle-orm';

/** Anything with Drizzle's `execute` (a db, a transaction or a script db). */
type SqlExecutor = { execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown> };

/**
 * Numbers every Ticket that has no folio yet, continuing each company's series
 * after its highest number, and brings the counters up to date. Seeds and
 * imports that insert rows directly call it; the app itself allocates folios
 * with `allocateDocumentFolio` inside the creating transaction.
 */
export const backfillMissingFolios = async (executor: SqlExecutor): Promise<void> => {
  await executor.execute(sql`
    WITH base AS (
      SELECT "company_id", "document_kind", COALESCE(MAX("folio_number"), 0) AS mx
      FROM "Ticket"
      WHERE "company_id" IS NOT NULL
      GROUP BY "company_id", "document_kind"
    ),
    numbered AS (
      SELECT
        t."id",
        base.mx + ROW_NUMBER() OVER (
          PARTITION BY t."company_id", t."document_kind"
          ORDER BY t."created_at", t."id"
        ) AS rn
      FROM "Ticket" t
      JOIN base
        ON base."company_id" = t."company_id" AND base."document_kind" = t."document_kind"
      WHERE t."company_id" IS NOT NULL AND t."folio_number" IS NULL
    )
    UPDATE "Ticket" AS t
    SET
      "folio_number" = numbered.rn,
      "folio_prefix" = CASE WHEN t."document_kind" = 'presupuesto' THEN 'P' ELSE 'R' END
    FROM numbered
    WHERE t."id" = numbered."id"
  `);

  await executor.execute(sql`
    INSERT INTO "DocumentFolioCounter" ("company_id", "document_kind", "last_number")
    SELECT "company_id", "document_kind", MAX("folio_number")
    FROM "Ticket"
    WHERE "company_id" IS NOT NULL AND "folio_number" IS NOT NULL
    GROUP BY "company_id", "document_kind"
    ON CONFLICT ("company_id", "document_kind")
    DO UPDATE SET "last_number" = GREATEST("DocumentFolioCounter"."last_number", EXCLUDED."last_number")
  `);
};
