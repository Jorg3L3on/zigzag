ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'SETUP';
--> statement-breakpoint
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
--> statement-breakpoint
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
--> statement-breakpoint
UPDATE "Company" SET "status" = 'SUSPENDED' WHERE "status" = 'INACTIVE';
