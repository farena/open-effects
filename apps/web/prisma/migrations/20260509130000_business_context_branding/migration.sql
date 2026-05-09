-- AlterTable
ALTER TABLE `BusinessContext`
    ADD COLUMN `companyName` TEXT NOT NULL,
    ADD COLUMN `primaryColor` VARCHAR(191) NULL,
    ADD COLUMN `secondaryColor` VARCHAR(191) NULL,
    ADD COLUMN `accentColor` VARCHAR(191) NULL,
    ADD COLUMN `logoLightAssetId` VARCHAR(191) NULL,
    ADD COLUMN `logoDarkAssetId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BusinessContext` MODIFY `companyName` TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX `BusinessContext_logoLightAssetId_idx` ON `BusinessContext`(`logoLightAssetId`);

-- CreateIndex
CREATE INDEX `BusinessContext_logoDarkAssetId_idx` ON `BusinessContext`(`logoDarkAssetId`);

-- AddForeignKey
ALTER TABLE `BusinessContext` ADD CONSTRAINT `BusinessContext_logoLightAssetId_fkey` FOREIGN KEY (`logoLightAssetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessContext` ADD CONSTRAINT `BusinessContext_logoDarkAssetId_fkey` FOREIGN KEY (`logoDarkAssetId`) REFERENCES `Asset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
