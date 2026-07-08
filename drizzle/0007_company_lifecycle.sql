ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'SETUP';
--> statement-breakpoint
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
--> statement-breakpoint
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
