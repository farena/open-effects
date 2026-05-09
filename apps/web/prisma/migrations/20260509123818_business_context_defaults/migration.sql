-- AlterTable
ALTER TABLE `BusinessContext` MODIFY `summary` TEXT NOT NULL DEFAULT '',
    MODIFY `audience` TEXT NOT NULL DEFAULT '',
    MODIFY `products` TEXT NOT NULL DEFAULT '',
    MODIFY `tone` TEXT NOT NULL DEFAULT '',
    MODIFY `competitors` TEXT NOT NULL DEFAULT '',
    MODIFY `notes` TEXT NOT NULL DEFAULT '';
