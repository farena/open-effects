-- CreateTable
CREATE TABLE `BusinessContext` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `summary` TEXT NOT NULL,
    `audience` TEXT NOT NULL,
    `products` TEXT NOT NULL,
    `tone` TEXT NOT NULL,
    `keyMessages` JSON NOT NULL,
    `differentiators` JSON NOT NULL,
    `competitors` TEXT NOT NULL,
    `notes` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
