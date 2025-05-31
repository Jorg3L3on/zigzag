-- CreateTable
CREATE TABLE `Service` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `price` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `client_name` VARCHAR(100) NULL,
    `client_tel` VARCHAR(10) NULL,
    `ticket_date` DATETIME(3) NULL,
    `total` DOUBLE NULL,
    `email` VARCHAR(40) NULL,
    `finished` BOOLEAN NOT NULL DEFAULT false,
    `document` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServicesTickets` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `service_id` BIGINT NOT NULL,
    `ticket_id` BIGINT NOT NULL,
    `sub_total` DOUBLE NOT NULL,
    `price` DOUBLE NOT NULL,
    `quantity` INTEGER NOT NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `ServicesTickets_service_id_idx`(`service_id`),
    INDEX `ServicesTickets_ticket_id_idx`(`ticket_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `password` VARCHAR(191) NOT NULL,
    `remember_token` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ServicesTickets` ADD CONSTRAINT `ServicesTickets_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `Service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServicesTickets` ADD CONSTRAINT `ServicesTickets_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `Ticket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

