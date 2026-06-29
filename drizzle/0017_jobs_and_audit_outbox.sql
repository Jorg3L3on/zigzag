-- Postgres-backed background job queue (no Redis) drained by Vercel Cron, and a
-- transactional outbox that durably captures audit events whose direct write
-- fails (fixes the previous fail-open audit behavior).

CREATE TABLE IF NOT EXISTS "JobQueue" (
  "id" serial PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "run_at" timestamp(3) DEFAULT now() NOT NULL,
  "locked_at" timestamp(3),
  "last_error" text,
  "created_at" timestamp(3) DEFAULT now() NOT NULL,
  "updated_at" timestamp(3)
);

CREATE INDEX IF NOT EXISTS "JobQueue_status_run_at_idx"
  ON "JobQueue"("status", "run_at");

CREATE TABLE IF NOT EXISTS "AuditOutbox" (
  "id" serial PRIMARY KEY NOT NULL,
  "event" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "created_at" timestamp(3) DEFAULT now() NOT NULL,
  "processed_at" timestamp(3)
);

CREATE INDEX IF NOT EXISTS "AuditOutbox_status_idx"
  ON "AuditOutbox"("status");
