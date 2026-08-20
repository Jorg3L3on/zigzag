-- Field work notes on Ticket (Epic C Anotar).
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "work_notes" text;
