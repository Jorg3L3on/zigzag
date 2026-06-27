CREATE TABLE IF NOT EXISTS "Notification" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "user_id" BIGINT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "resource_type" TEXT,
  "resource_id" TEXT,
  "dedupe_key" TEXT,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_company_id_idx"
  ON "Notification"("company_id");
CREATE INDEX IF NOT EXISTS "Notification_company_read_idx"
  ON "Notification"("company_id", "read_at");
CREATE INDEX IF NOT EXISTS "Notification_created_at_idx"
  ON "Notification"("created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_company_dedupe_uidx"
  ON "Notification"("company_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
