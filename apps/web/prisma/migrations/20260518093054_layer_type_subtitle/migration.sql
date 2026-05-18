-- AlterTable
ALTER TABLE `Layer` ADD COLUMN `subtitleData` JSON NULL,
    ADD COLUMN `type` VARCHAR(20) NOT NULL DEFAULT 'html';
