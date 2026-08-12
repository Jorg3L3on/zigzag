-- Presupuesto document kind on Ticket (#386).
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "document_kind" varchar(20) NOT NULL DEFAULT 'ticket';
--> statement-breakpoint
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp(3);
--> statement-breakpoint
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "canceled_at" timestamp(3);
--> statement-breakpoint
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "converted_to_ticket_id" bigint;
--> statement-breakpoint
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "converted_from_ticket_id" bigint;
--> statement-breakpoint
UPDATE "Ticket" SET "document_kind" = 'ticket' WHERE "document_kind" IS NULL OR "document_kind" = '';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Ticket_company_id_document_kind_active_idx"
  ON "Ticket" ("company_id", "document_kind")
  WHERE "deleted_at" IS NULL;
