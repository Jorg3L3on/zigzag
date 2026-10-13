-- Web Push subscriptions of the installed PWA (ZIG-I20-2). One row per device a
-- user opted in on; every send is scoped by company_id. Additive only.
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL,
  "user_id" bigint NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp(3) NOT NULL DEFAULT now(),
  "last_seen_at" timestamp(3) NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_company_id_Company_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "public"."Company"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_user_id_User_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription" USING btree ("endpoint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PushSubscription_company_id_idx" ON "PushSubscription" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PushSubscription_user_id_idx" ON "PushSubscription" USING btree ("user_id");
