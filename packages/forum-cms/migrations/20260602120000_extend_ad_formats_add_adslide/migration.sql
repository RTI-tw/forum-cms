-- CreateEnum
CREATE TYPE "AdFormatType" AS ENUM ('single_image', 'carousel', 'video', 'third_party');

-- AlterTable
ALTER TABLE "Ad"
    ADD COLUMN "format" "AdFormatType" NOT NULL DEFAULT 'single_image',
    ADD COLUMN "videoFile_filesize" INTEGER,
    ADD COLUMN "videoFile_filename" TEXT,
    ADD COLUMN "adCode" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "AdSlide" (
    "id" SERIAL NOT NULL,
    "ad" INTEGER,
    "image" INTEGER,
    "linkUrl" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "AdSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdSlide_ad_idx" ON "AdSlide"("ad");

-- CreateIndex
CREATE INDEX "AdSlide_image_idx" ON "AdSlide"("image");

-- CreateIndex
CREATE INDEX "AdSlide_createdBy_idx" ON "AdSlide"("createdBy");

-- CreateIndex
CREATE INDEX "AdSlide_updatedBy_idx" ON "AdSlide"("updatedBy");

-- AddForeignKey
ALTER TABLE "AdSlide" ADD CONSTRAINT "AdSlide_ad_fkey" FOREIGN KEY ("ad") REFERENCES "Ad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSlide" ADD CONSTRAINT "AdSlide_image_fkey" FOREIGN KEY ("image") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSlide" ADD CONSTRAINT "AdSlide_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSlide" ADD CONSTRAINT "AdSlide_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
