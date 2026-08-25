CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" bigint NOT NULL,
  "name" text NOT NULL,
  "key_hash" text NOT NULL,
  "key_prefix" text NOT NULL,
  "scopes" text[] DEFAULT '{"read"}' NOT NULL,
  "allowed_company_ids" integer[] DEFAULT '{}' NOT NULL,
  "last_used_at" timestamp(3),
  "expires_at" timestamp(3),
  "revoked_at" timestamp(3),
  "created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_key_prefix_key" ON "ApiKey" USING btree ("key_prefix");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ApiKey_user_id_idx" ON "ApiKey" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "McpOAuthClient" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "client_secret_hash" text,
  "client_name" text NOT NULL,
  "redirect_uris" text[] NOT NULL,
  "grant_types" text[] DEFAULT '{"authorization_code","refresh_token"}' NOT NULL,
  "response_types" text[] DEFAULT '{"code"}' NOT NULL,
  "token_endpoint_auth_method" text DEFAULT 'none' NOT NULL,
  "client_uri" text,
  "logo_uri" text,
  "created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthClient_client_id_key" ON "McpOAuthClient" USING btree ("client_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "McpOAuthAuthorizationCode" (
  "id" serial PRIMARY KEY NOT NULL,
  "code_hash" text NOT NULL,
  "client_id" text NOT NULL,
  "user_id" bigint NOT NULL,
  "redirect_uri" text NOT NULL,
  "scopes" text[] NOT NULL,
  "allowed_company_ids" integer[] DEFAULT '{}' NOT NULL,
  "code_challenge" text NOT NULL,
  "code_challenge_method" text DEFAULT 'S256' NOT NULL,
  "resource" text NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "used_at" timestamptz(3),
  "created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthAuthorizationCode_code_hash_key" ON "McpOAuthAuthorizationCode" USING btree ("code_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthAuthorizationCode_client_id_idx" ON "McpOAuthAuthorizationCode" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthAuthorizationCode_user_id_idx" ON "McpOAuthAuthorizationCode" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "McpOAuthGrant" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" bigint NOT NULL,
  "client_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "token_prefix" text NOT NULL,
  "refresh_token_hash" text,
  "refresh_token_prefix" text,
  "scopes" text[] NOT NULL,
  "allowed_company_ids" integer[] DEFAULT '{}' NOT NULL,
  "resource" text NOT NULL,
  "last_used_at" timestamptz(3),
  "expires_at" timestamptz(3),
  "revoked_at" timestamptz(3),
  "created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthGrant_token_prefix_key" ON "McpOAuthGrant" USING btree ("token_prefix");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthGrant_refresh_token_hash_key" ON "McpOAuthGrant" USING btree ("refresh_token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthGrant_refresh_token_prefix_key" ON "McpOAuthGrant" USING btree ("refresh_token_prefix");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthGrant_user_id_idx" ON "McpOAuthGrant" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthGrant_client_id_idx" ON "McpOAuthGrant" USING btree ("client_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "McpOAuthTokenAttempt" (
  "id" serial PRIMARY KEY NOT NULL,
  "path" text NOT NULL,
  "method" text NOT NULL,
  "content_type" text,
  "grant_type" text,
  "has_code" boolean DEFAULT false NOT NULL,
  "has_verifier" boolean DEFAULT false NOT NULL,
  "has_assertion" boolean DEFAULT false NOT NULL,
  "client_id_kind" text,
  "redirect_kind" text,
  "resource_kind" text,
  "error" text,
  "invalid_grant_reason" text,
  "http_status" integer,
  "created_at" timestamp(3) DEFAULT now() NOT NULL,
  "updated_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "McpOAuthTokenAttempt_created_at_idx" ON "McpOAuthTokenAttempt" USING btree ("created_at");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_client_id_McpOAuthClient_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."McpOAuthClient"("client_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "McpOAuthAuthorizationCode" ADD CONSTRAINT "McpOAuthAuthorizationCode_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "McpOAuthGrant" ADD CONSTRAINT "McpOAuthGrant_client_id_McpOAuthClient_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."McpOAuthClient"("client_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "McpOAuthGrant" ADD CONSTRAINT "McpOAuthGrant_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
