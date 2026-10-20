-- OAuth hardening for the MCP connector (ZIG-I23-11). Additive only.
-- Grants get a refresh window, an absolute lifetime, refresh-reuse detection and
-- a link to the authorization code that minted them (replay revokes the grant).
ALTER TABLE "McpOAuthGrant"
  ADD COLUMN IF NOT EXISTS "refresh_expires_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "absolute_expires_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "previous_refresh_token_hash" text,
  ADD COLUMN IF NOT EXISTS "authorization_code_id" integer,
  ADD COLUMN IF NOT EXISTS "revoked_reason" text;
--> statement-breakpoint
-- Existing grants keep working: 90 days to refresh from now, one year from consent.
UPDATE "McpOAuthGrant"
SET "refresh_expires_at" = COALESCE("refresh_expires_at", now() + interval '90 days'),
    "absolute_expires_at" = COALESCE("absolute_expires_at", "created_at" + interval '365 days')
WHERE "refresh_expires_at" IS NULL OR "absolute_expires_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthGrant_previous_refresh_token_hash_idx"
  ON "McpOAuthGrant" USING btree ("previous_refresh_token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthGrant_authorization_code_id_idx"
  ON "McpOAuthGrant" USING btree ("authorization_code_id");
--> statement-breakpoint
-- CIMD clients are re-fetched once their document is older than 24 h.
ALTER TABLE "McpOAuthClient"
  ADD COLUMN IF NOT EXISTS "fetched_at" timestamp(3) with time zone;
--> statement-breakpoint
-- private_key_jwt assertions are single use: one row per jti until it expires.
CREATE TABLE IF NOT EXISTS "McpOAuthJwtAssertion" (
  "jti" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "expires_at" timestamp(3) with time zone NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthJwtAssertion_expires_at_idx"
  ON "McpOAuthJwtAssertion" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthAuthorizationCode_expires_at_idx"
  ON "McpOAuthAuthorizationCode" USING btree ("expires_at");
