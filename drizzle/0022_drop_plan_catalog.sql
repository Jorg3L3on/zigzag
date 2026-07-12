ALTER TABLE "Company" DROP CONSTRAINT "Company_plan_id_Plan_id_fk";
--> statement-breakpoint
DROP INDEX "Company_plan_id_idx";
--> statement-breakpoint
ALTER TABLE "Company" DROP COLUMN "plan_id";
--> statement-breakpoint
ALTER TABLE "Company" DROP COLUMN "entitlement_limit_overrides";
--> statement-breakpoint
DROP TABLE "Plan";
