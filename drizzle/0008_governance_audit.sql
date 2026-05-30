CREATE TABLE IF NOT EXISTS "GovernanceAuditEvent" (
  "id" SERIAL NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "company_id" INTEGER,
  "actor_user_id" BIGINT,
  "actor_company_id" INTEGER,
  "event_type" TEXT NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GovernanceAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GovernanceAuditEvent_resource_type_resource_id_idx"
  ON "GovernanceAuditEvent"("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "GovernanceAuditEvent_company_id_idx"
  ON "GovernanceAuditEvent"("company_id");
CREATE INDEX IF NOT EXISTS "GovernanceAuditEvent_actor_user_id_idx"
  ON "GovernanceAuditEvent"("actor_user_id");
CREATE INDEX IF NOT EXISTS "GovernanceAuditEvent_actor_company_id_idx"
  ON "GovernanceAuditEvent"("actor_company_id");

DO $$ BEGIN
  ALTER TABLE "GovernanceAuditEvent"
    ADD CONSTRAINT "GovernanceAuditEvent_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GovernanceAuditEvent"
    ADD CONSTRAINT "GovernanceAuditEvent_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "GovernanceAuditEvent"
    ADD CONSTRAINT "GovernanceAuditEvent_actor_company_id_fkey"
    FOREIGN KEY ("actor_company_id") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
