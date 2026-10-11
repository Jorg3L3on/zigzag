-- Company folio series (ZIG-I17-4): P-0001 for presupuestos, R-0001 for tickets,
-- one counter per company and document kind. Additive: two nullable columns, a
-- counter table and a unique index. Existing rows are numbered in creation order.
-- data-loss-ok: the UPDATE only fills the new NULL folio columns; no existing value is changed or removed.
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "folio_number" integer;
--> statement-breakpoint
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "folio_prefix" varchar(8);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "DocumentFolioCounter" (
  "company_id" integer NOT NULL,
  "document_kind" varchar(20) NOT NULL,
  "last_number" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "DocumentFolioCounter_company_id_document_kind_pk"
    PRIMARY KEY ("company_id", "document_kind"),
  CONSTRAINT "DocumentFolioCounter_company_id_Company_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id")
);
--> statement-breakpoint
-- Backfill in creation order per company and kind. Deleted documents keep their number.
WITH numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "company_id", "document_kind"
      ORDER BY "created_at", "id"
    ) AS rn
  FROM "Ticket"
  WHERE "company_id" IS NOT NULL
)
UPDATE "Ticket" AS t
SET
  "folio_number" = numbered.rn,
  "folio_prefix" = CASE WHEN t."document_kind" = 'presupuesto' THEN 'P' ELSE 'R' END
FROM numbered
WHERE t."id" = numbered."id" AND t."folio_number" IS NULL;
--> statement-breakpoint
INSERT INTO "DocumentFolioCounter" ("company_id", "document_kind", "last_number")
SELECT "company_id", "document_kind", MAX("folio_number")
FROM "Ticket"
WHERE "company_id" IS NOT NULL AND "folio_number" IS NOT NULL
GROUP BY "company_id", "document_kind"
ON CONFLICT ("company_id", "document_kind")
DO UPDATE SET "last_number" = GREATEST("DocumentFolioCounter"."last_number", EXCLUDED."last_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_company_kind_folio_key"
  ON "Ticket" ("company_id", "document_kind", "folio_number")
  WHERE "folio_number" IS NOT NULL;
