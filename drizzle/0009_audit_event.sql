CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" SERIAL NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_user_id" BIGINT,
  "actor_company_id" INTEGER,
  "target_company_id" INTEGER,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT,
  "action" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "payload" JSONB,
  "request_meta" JSONB,

  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditEvent_occurred_at_idx"
  ON "AuditEvent"("occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "AuditEvent_target_company_id_occurred_at_idx"
  ON "AuditEvent"("target_company_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "AuditEvent_actor_user_id_occurred_at_idx"
  ON "AuditEvent"("actor_user_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "AuditEvent_resource_type_resource_id_idx"
  ON "AuditEvent"("resource_type", "resource_id");

DO $$ BEGIN
  ALTER TABLE "AuditEvent"
    ADD CONSTRAINT "AuditEvent_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuditEvent"
    ADD CONSTRAINT "AuditEvent_actor_company_id_fkey"
    FOREIGN KEY ("actor_company_id") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuditEvent"
    ADD CONSTRAINT "AuditEvent_target_company_id_fkey"
    FOREIGN KEY ("target_company_id") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
