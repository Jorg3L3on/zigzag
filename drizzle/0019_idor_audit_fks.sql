-- IDOR audit: add missing tenant FKs on audit tables not covered by 0014.
-- NOT VALID so migration never fails on pre-existing rows; enforced for new/modified rows.

-- TicketAuditEvent.company_id -> Company.id
DO $$ BEGIN
  ALTER TABLE "TicketAuditEvent"
    ADD CONSTRAINT "TicketAuditEvent_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- TicketAuditEvent.actor_user_id -> User.id
DO $$ BEGIN
  ALTER TABLE "TicketAuditEvent"
    ADD CONSTRAINT "TicketAuditEvent_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;
