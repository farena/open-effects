-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `fps` INTEGER NOT NULL DEFAULT 30,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Scene` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `durationFrames` INTEGER NOT NULL,
    `transitionIn` JSON NULL,

    INDEX `Scene_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Layer` (
    `id` VARCHAR(191) NOT NULL,
    `sceneId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `html` TEXT NOT NULL,
    `css` TEXT NOT NULL,
    `startFrame` INTEGER NOT NULL DEFAULT 0,
    `endFrame` INTEGER NOT NULL,

    INDEX `Layer_sceneId_idx`(`sceneId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Keyframe` (
    `id` VARCHAR(191) NOT NULL,
    `layerId` VARCHAR(191) NOT NULL,
    `frame` INTEGER NOT NULL,
    `property` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `easingOut` JSON NOT NULL,

    INDEX `Keyframe_layerId_property_frame_idx`(`layerId`, `property`, `frame`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AudioTrack` (
    `id` VARCHAR(191) NOT NULL,
    `sceneId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `startFrame` INTEGER NOT NULL,
    `trimStart` INTEGER NOT NULL DEFAULT 0,
    `trimEnd` INTEGER NOT NULL,
    `eq` JSON NULL,

    INDEX `AudioTrack_sceneId_idx`(`sceneId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolumeKeyframe` (
    `id` VARCHAR(191) NOT NULL,
    `audioTrackId` VARCHAR(191) NOT NULL,
    `frame` INTEGER NOT NULL,
    `value` DOUBLE NOT NULL,
    `easingOut` JSON NOT NULL,

    INDEX `VolumeKeyframe_audioTrackId_frame_idx`(`audioTrackId`, `frame`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Asset_sha256_key`(`sha256`),
    INDEX `Asset_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SavedComponent` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `preview` VARCHAR(191) NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SavedComponent_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Scene` ADD CONSTRAINT `Scene_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Layer` ADD CONSTRAINT `Layer_sceneId_fkey` FOREIGN KEY (`sceneId`) REFERENCES `Scene`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Keyframe` ADD CONSTRAINT `Keyframe_layerId_fkey` FOREIGN KEY (`layerId`) REFERENCES `Layer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AudioTrack` ADD CONSTRAINT `AudioTrack_sceneId_fkey` FOREIGN KEY (`sceneId`) REFERENCES `Scene`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AudioTrack` ADD CONSTRAINT `AudioTrack_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolumeKeyframe` ADD CONSTRAINT `VolumeKeyframe_audioTrackId_fkey` FOREIGN KEY (`audioTrackId`) REFERENCES `AudioTrack`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
