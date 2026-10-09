-- Inline (ad-hoc) service lines (ZIG-I5-1): a line can live only in its
-- ticket/presupuesto without a catalog Service. Existing rows keep service_id
-- and get name = NULL.
ALTER TABLE "ServicesTickets"
  ALTER COLUMN "service_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "ServicesTickets"
  ADD COLUMN IF NOT EXISTS "name" varchar(100);
--> statement-breakpoint
ALTER TABLE "ServicesTickets"
  ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ServicesTickets"
    ADD CONSTRAINT "ServicesTickets_service_or_name_chk"
    CHECK ("service_id" IS NOT NULL OR "name" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
