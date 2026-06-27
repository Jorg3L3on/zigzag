-- Tenant data integrity: add foreign keys for core tenant-owned tables and make
-- Role/Permission names unique per company instead of globally.
--
-- Foreign keys are added NOT VALID so the migration never fails on pre-existing
-- rows; they are still enforced for all new/modified rows. Run VALIDATE
-- CONSTRAINT manually once historical data is known clean.

-- Client.company_id -> Company.id
DO $$ BEGIN
  ALTER TABLE "Client"
    ADD CONSTRAINT "Client_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Service.company_id -> Company.id
DO $$ BEGIN
  ALTER TABLE "Service"
    ADD CONSTRAINT "Service_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Ticket.company_id / client_id / userId
DO $$ BEGIN
  ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "Client"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ServicesTickets.service_id / ticket_id
DO $$ BEGIN
  ALTER TABLE "ServicesTickets"
    ADD CONSTRAINT "ServicesTickets_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "Service"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ServicesTickets"
    ADD CONSTRAINT "ServicesTickets_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ClientServiceSchedule.company_id / client_id / service_id
DO $$ BEGIN
  ALTER TABLE "ClientServiceSchedule"
    ADD CONSTRAINT "ClientServiceSchedule_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientServiceSchedule"
    ADD CONSTRAINT "ClientServiceSchedule_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "Client"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientServiceSchedule"
    ADD CONSTRAINT "ClientServiceSchedule_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "Service"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- TicketPayment.ticket_id / company_id
DO $$ BEGIN
  ALTER TABLE "TicketPayment"
    ADD CONSTRAINT "TicketPayment_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TicketPayment"
    ADD CONSTRAINT "TicketPayment_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Notification.company_id
DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "Company"("id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Per-company uniqueness for Role and Permission names.
DROP INDEX IF EXISTS "Role_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Role_company_id_name_key"
  ON "Role"("company_id", "name");

DROP INDEX IF EXISTS "Permission_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_company_id_name_key"
  ON "Permission"("company_id", "name");
