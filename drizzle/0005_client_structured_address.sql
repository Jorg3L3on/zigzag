ALTER TABLE "Client" ADD COLUMN "street" text;
--> statement-breakpoint
ALTER TABLE "Client" ADD COLUMN "exterior_number" text;
--> statement-breakpoint
ALTER TABLE "Client" ADD COLUMN "interior_number" text;
--> statement-breakpoint
ALTER TABLE "Client" ADD COLUMN "neighborhood" text;
--> statement-breakpoint
ALTER TABLE "Client" ADD COLUMN "city" text;
--> statement-breakpoint
ALTER TABLE "Client" ADD COLUMN "state" text;
--> statement-breakpoint
ALTER TABLE "Client" ADD COLUMN "postal_code" text;
--> statement-breakpoint
ALTER TABLE "Client" ADD COLUMN "country" text;
--> statement-breakpoint
UPDATE "Client"
SET "street" = NULLIF(BTRIM("address"), '')
WHERE "street" IS NULL AND NULLIF(BTRIM("address"), '') IS NOT NULL;
