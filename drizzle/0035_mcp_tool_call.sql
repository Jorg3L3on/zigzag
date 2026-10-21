-- Agent activity log (ZIG-I23-8): one row per MCP tools/call, shown per
-- connection in /settings/connections. Rows older than 90 days are deleted by
-- the daily retention job. Additive only.
CREATE TABLE IF NOT EXISTS "McpToolCall" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "company_id" integer,
  "user_id" bigint NOT NULL,
  "api_key_id" integer,
  "oauth_grant_id" integer,
  "tool" text NOT NULL,
  "ok" boolean NOT NULL,
  "error_code" text,
  "duration_ms" integer NOT NULL,
  "created_at" timestamp(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_company_id_Company_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."Company"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_user_id_User_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_api_key_id_ApiKey_id_fk"
    FOREIGN KEY ("api_key_id") REFERENCES "public"."ApiKey"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "McpToolCall" ADD CONSTRAINT "McpToolCall_oauth_grant_id_McpOAuthGrant_id_fk"
    FOREIGN KEY ("oauth_grant_id") REFERENCES "public"."McpOAuthGrant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpToolCall_api_key_id_created_at_idx" ON "McpToolCall" USING btree ("api_key_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpToolCall_oauth_grant_id_created_at_idx" ON "McpToolCall" USING btree ("oauth_grant_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpToolCall_created_at_idx" ON "McpToolCall" USING btree ("created_at");
