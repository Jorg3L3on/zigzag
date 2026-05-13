-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "street" TEXT,
ADD COLUMN "interior_number" TEXT,
ADD COLUMN "exterior_number" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "postal_code" TEXT,
ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "settings" JSONB;

UPDATE "Company" SET
  "street" = "address",
  "exterior_number" = 'S/N',
  "neighborhood" = '',
  "city" = '',
  "state" = '',
  "country" = 'México',
  "postal_code" = ''
WHERE true;

ALTER TABLE "Company" ALTER COLUMN "street" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "exterior_number" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "neighborhood" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "state" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "country" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "postal_code" SET NOT NULL;

ALTER TABLE "Company" DROP COLUMN "address";
