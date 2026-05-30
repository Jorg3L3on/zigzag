CREATE TABLE "ClientServiceSchedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"interval_value" integer NOT NULL,
	"interval_unit" varchar(10) NOT NULL,
	"last_service_at" timestamp (3),
	"next_due_at" timestamp (3) NOT NULL,
	"paused_at" timestamp (3),
	"pause_reason" text,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3),
	"deleted_at" timestamp (3)
);
--> statement-breakpoint
CREATE INDEX "ClientServiceSchedule_company_id_idx" ON "ClientServiceSchedule" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "ClientServiceSchedule_next_due_at_idx" ON "ClientServiceSchedule" USING btree ("next_due_at");
--> statement-breakpoint
CREATE INDEX "ClientServiceSchedule_client_id_idx" ON "ClientServiceSchedule" USING btree ("client_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ClientServiceSchedule_company_client_service_uidx" ON "ClientServiceSchedule" USING btree ("company_id","client_id","service_id") WHERE "deleted_at" is null;
