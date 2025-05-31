/*
  Warnings:

  - The primary key for the `Service` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deleted_at` on the `Service` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Service` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `ServicesTickets` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deleted_at` on the `ServicesTickets` table. All the data in the column will be lost.
  - You are about to drop the column `sub_total` on the `ServicesTickets` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `ServicesTickets` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `service_id` on the `ServicesTickets` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - Added the required column `description` to the `Service` table without a default value. This is not possible if the table is not empty.
  - Made the column `created_at` on table `Service` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `Service` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `ServicesTickets` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `ServicesTickets` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `ServicesTickets` DROP FOREIGN KEY `ServicesTickets_service_id_fkey`;

-- AlterTable
ALTER TABLE `Service` DROP PRIMARY KEY,
    DROP COLUMN `deleted_at`,
    ADD COLUMN `description` VARCHAR(191) NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `name` VARCHAR(191) NOT NULL,
    MODIFY `created_at` DATETIME(3) NULL,
    MODIFY `updated_at` DATETIME(3) NULL,
    ADD PRIMARY KEY (`id`);

-- Update existing records
UPDATE `Service` SET 
    `description` = CONCAT('Description for ', `name`),
    `created_at` = CURRENT_TIMESTAMP(3),
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `description` IS NULL OR `created_at` IS NULL OR `updated_at` IS NULL;

-- Make columns required after updating data
ALTER TABLE `Service` 
    MODIFY `description` VARCHAR(191) NOT NULL,
    MODIFY `created_at` DATETIME(3) NOT NULL,
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `ServicesTickets` DROP PRIMARY KEY,
    DROP COLUMN `deleted_at`,
    DROP COLUMN `sub_total`,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `service_id` INTEGER NOT NULL,
    MODIFY `created_at` DATETIME(3) NULL,
    MODIFY `updated_at` DATETIME(3) NULL,
    ADD PRIMARY KEY (`id`);

-- Update existing records in ServicesTickets
UPDATE `ServicesTickets` SET 
    `created_at` = CURRENT_TIMESTAMP(3),
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `created_at` IS NULL OR `updated_at` IS NULL;

-- Make columns required after updating data
ALTER TABLE `ServicesTickets`
    MODIFY `created_at` DATETIME(3) NOT NULL,
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AddForeignKey
ALTER TABLE `ServicesTickets` ADD CONSTRAINT `ServicesTickets_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `Service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
