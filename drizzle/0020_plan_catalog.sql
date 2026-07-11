CREATE TABLE "Plan" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"limits" jsonb NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan" USING btree ("slug");
--> statement-breakpoint
INSERT INTO "Plan" ("id", "slug", "name", "limits") VALUES
(1, 'starter', 'Starter', '{"users": 3, "clients": 25, "services": 25, "tickets_month": 50}'::jsonb),
(2, 'standard', 'Standard', '{"users": 15, "clients": 200, "services": 200, "tickets_month": 500}'::jsonb),
(3, 'enterprise', 'Enterprise', '{"users": null, "clients": null, "services": null, "tickets_month": null}'::jsonb);
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('"Plan"', 'id'), (SELECT MAX("id") FROM "Plan"));
--> statement-breakpoint
ALTER TABLE "Company" ADD COLUMN "plan_id" integer;
--> statement-breakpoint
ALTER TABLE "Company" ADD COLUMN "entitlement_limit_overrides" jsonb;
--> statement-breakpoint
UPDATE "Company"
SET "plan_id" = (
	SELECT p."id"
	FROM "Plan" p
	WHERE p."slug" = CASE
		WHEN ("Company"."settings"->>'plan') IN ('starter', 'standard', 'enterprise')
			THEN ("Company"."settings"->>'plan')
		ELSE 'standard'
	END
);
--> statement-breakpoint
ALTER TABLE "Company" ALTER COLUMN "plan_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "Company" ADD CONSTRAINT "Company_plan_id_Plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "Company_plan_id_idx" ON "Company" USING btree ("plan_id");
