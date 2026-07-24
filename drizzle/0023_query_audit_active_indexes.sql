-- Soft-delete-aware composite indexes for tenant list queries (execution plan 2.2).
-- Matches WHERE company_id = ? AND deleted_at IS NULL ORDER BY created_at DESC
-- so Postgres prefers index scans over sequential scans once a tenant grows.

CREATE INDEX IF NOT EXISTS "Ticket_company_id_created_at_active_idx"
  ON "Ticket"("company_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "Ticket_company_id_finished_active_idx"
  ON "Ticket"("company_id", "finished")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "Client_company_id_created_at_active_idx"
  ON "Client"("company_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "Service_company_id_created_at_active_idx"
  ON "Service"("company_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "User_company_id_created_at_active_idx"
  ON "User"("company_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

-- Ticket audit history is ordered by created_at per ticket / company.
CREATE INDEX IF NOT EXISTS "TicketAuditEvent_ticket_id_created_at_idx"
  ON "TicketAuditEvent"("ticket_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "TicketAuditEvent_company_id_created_at_idx"
  ON "TicketAuditEvent"("company_id", "created_at" DESC);
