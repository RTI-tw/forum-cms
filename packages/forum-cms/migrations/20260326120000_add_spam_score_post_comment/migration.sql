-- AlterTable
ALTER TABLE "Post" ADD COLUMN "spamScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "spamScore" DOUBLE PRECISION;
