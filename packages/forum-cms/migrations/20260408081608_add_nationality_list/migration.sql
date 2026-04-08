/*
  Warnings:

  - The `nationality` column on the `Member` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `language` on table `ForbiddenKeyword` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `Member` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "NationalityStatusType" AS ENUM ('active', 'inactive');

-- DropIndex
DROP INDEX "Comment_reactionCount_idx";

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "reactionCount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EditorChoice" ALTER COLUMN "state" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ForbiddenKeyword" ALTER COLUMN "language" SET NOT NULL,
ALTER COLUMN "language" SET DEFAULT 'zh';

-- AlterTable
ALTER TABLE "Image" ALTER COLUMN "sortOrder" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Member" ALTER COLUMN "status" SET NOT NULL,
DROP COLUMN "nationality",
ADD COLUMN     "nationality" INTEGER;

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "language" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Topic" ALTER COLUMN "state" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Nationality" (
    "id" SERIAL NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "nationalFlag" INTEGER,
    "status" "NationalityStatusType" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Nationality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Nationality_displayName_key" ON "Nationality"("displayName");

-- CreateIndex
CREATE INDEX "Nationality_nationalFlag_idx" ON "Nationality"("nationalFlag");

-- CreateIndex
CREATE INDEX "Nationality_createdBy_idx" ON "Nationality"("createdBy");

-- CreateIndex
CREATE INDEX "Nationality_updatedBy_idx" ON "Nationality"("updatedBy");

-- CreateIndex
CREATE INDEX "Member_nationality_idx" ON "Member"("nationality");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_nationality_fkey" FOREIGN KEY ("nationality") REFERENCES "Nationality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nationality" ADD CONSTRAINT "Nationality_nationalFlag_fkey" FOREIGN KEY ("nationalFlag") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nationality" ADD CONSTRAINT "Nationality_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nationality" ADD CONSTRAINT "Nationality_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
