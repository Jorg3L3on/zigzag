-- Composite indexes to keep tenant-scoped list queries fast at scale
-- (ordering by recency and filtering by finished status).

CREATE INDEX IF NOT EXISTS "Ticket_company_id_created_at_idx"
  ON "Ticket"("company_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "Ticket_company_id_finished_idx"
  ON "Ticket"("company_id", "finished");
CREATE INDEX IF NOT EXISTS "Client_company_id_created_at_idx"
  ON "Client"("company_id", "created_at" DESC);
