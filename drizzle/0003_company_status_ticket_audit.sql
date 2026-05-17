DO $$ BEGIN
  CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "street" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "interior_number" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "exterior_number" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "postal_code" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "settings" JSONB;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Company' AND column_name = 'address'
  ) THEN
    UPDATE "Company" SET
      "street" = COALESCE("street", "address", ''),
      "exterior_number" = COALESCE("exterior_number", 'S/N'),
      "neighborhood" = COALESCE("neighborhood", ''),
      "city" = COALESCE("city", ''),
      "state" = COALESCE("state", ''),
      "country" = COALESCE("country", 'México'),
      "postal_code" = COALESCE("postal_code", '')
    WHERE "street" IS NULL
       OR "exterior_number" IS NULL
       OR "neighborhood" IS NULL
       OR "city" IS NULL
       OR "state" IS NULL
       OR "country" IS NULL
       OR "postal_code" IS NULL;
  ELSE
    UPDATE "Company" SET
      "street" = COALESCE("street", ''),
      "exterior_number" = COALESCE("exterior_number", 'S/N'),
      "neighborhood" = COALESCE("neighborhood", ''),
      "city" = COALESCE("city", ''),
      "state" = COALESCE("state", ''),
      "country" = COALESCE("country", 'México'),
      "postal_code" = COALESCE("postal_code", '')
    WHERE "street" IS NULL
       OR "exterior_number" IS NULL
       OR "neighborhood" IS NULL
       OR "city" IS NULL
       OR "state" IS NULL
       OR "country" IS NULL
       OR "postal_code" IS NULL;
  END IF;
END $$;

ALTER TABLE "Company" ALTER COLUMN "street" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "exterior_number" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "neighborhood" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "state" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "country" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "postal_code" SET NOT NULL;

ALTER TABLE "Company" DROP COLUMN IF EXISTS "address";

CREATE TABLE IF NOT EXISTS "TicketAuditEvent" (
  "id" SERIAL NOT NULL,
  "ticket_id" BIGINT NOT NULL,
  "company_id" INTEGER,
  "actor_user_id" BIGINT,
  "event_type" TEXT NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketAuditEvent_ticket_id_idx" ON "TicketAuditEvent"("ticket_id");
CREATE INDEX IF NOT EXISTS "TicketAuditEvent_company_id_idx" ON "TicketAuditEvent"("company_id");
CREATE INDEX IF NOT EXISTS "TicketAuditEvent_actor_user_id_idx" ON "TicketAuditEvent"("actor_user_id");

DO $$ BEGIN
  ALTER TABLE "TicketAuditEvent"
    ADD CONSTRAINT "TicketAuditEvent_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
