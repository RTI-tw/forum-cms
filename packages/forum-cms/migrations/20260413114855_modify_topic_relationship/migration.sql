/*
  Warnings:

  - You are about to drop the `_Post_topics` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_Post_topics" DROP CONSTRAINT "_Post_topics_A_fkey";

-- DropForeignKey
ALTER TABLE "_Post_topics" DROP CONSTRAINT "_Post_topics_B_fkey";

-- DropIndex
DROP INDEX "Member_nationality_idx";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "topics" INTEGER;

-- DropTable
DROP TABLE "_Post_topics";

-- CreateIndex
CREATE INDEX "Post_topics_idx" ON "Post"("topics");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_topics_fkey" FOREIGN KEY ("topics") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
