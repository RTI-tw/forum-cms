-- CreateEnum
CREATE TYPE "HomepageImageStatusType" AS ENUM ('draft', 'active', 'inactive');

-- CreateTable
CREATE TABLE "HomepageImage" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "image" INTEGER,
    "linkUrl" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER DEFAULT 0,
    "status" "HomepageImageStatusType" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "HomepageImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomepageImage_image_idx" ON "HomepageImage"("image");

-- CreateIndex
CREATE INDEX "HomepageImage_createdBy_idx" ON "HomepageImage"("createdBy");

-- CreateIndex
CREATE INDEX "HomepageImage_updatedBy_idx" ON "HomepageImage"("updatedBy");

-- AddForeignKey
ALTER TABLE "HomepageImage" ADD CONSTRAINT "HomepageImage_image_fkey" FOREIGN KEY ("image") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageImage" ADD CONSTRAINT "HomepageImage_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageImage" ADD CONSTRAINT "HomepageImage_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
