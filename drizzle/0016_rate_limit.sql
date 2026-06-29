-- Distributed fixed-window rate limit counters (no Redis).
-- One row per identifier (e.g. "login:email:x", "api:user:1"); the window
-- resets when reset_at passes. See src/lib/rate-limit-store.ts.

CREATE TABLE IF NOT EXISTS "RateLimit" (
  "identifier" text PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "reset_at" timestamp(3) NOT NULL
);
