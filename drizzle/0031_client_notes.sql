-- Client notes (ZIG-I17-3): free text about the client. Additive only.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "notes" text;
