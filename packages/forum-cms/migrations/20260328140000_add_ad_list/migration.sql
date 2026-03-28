-- CreateEnum
CREATE TYPE "AdStateType" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "Ad" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
    "showOnHomepageDeepTopic" BOOLEAN NOT NULL DEFAULT false,
    "image" INTEGER,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "state" "AdStateType" NOT NULL DEFAULT 'inactive',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ad_image_idx" ON "Ad"("image");

-- CreateIndex
CREATE INDEX "Ad_createdBy_idx" ON "Ad"("createdBy");

-- CreateIndex
CREATE INDEX "Ad_updatedBy_idx" ON "Ad"("updatedBy");

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_image_fkey" FOREIGN KEY ("image") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
