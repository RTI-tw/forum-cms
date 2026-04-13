/*
  Warnings:

  - The values [pending] on the enum `MemberStatusType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MemberStatusType_new" AS ENUM ('active', 'inactive', 'banned');
ALTER TABLE "Member" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Member" ALTER COLUMN "status" TYPE "MemberStatusType_new" USING ("status"::text::"MemberStatusType_new");
ALTER TYPE "MemberStatusType" RENAME TO "MemberStatusType_old";
ALTER TYPE "MemberStatusType_new" RENAME TO "MemberStatusType";
DROP TYPE "MemberStatusType_old";
ALTER TABLE "Member" ALTER COLUMN "status" SET DEFAULT 'inactive';
COMMIT;

-- AlterTable
ALTER TABLE "Member" ALTER COLUMN "status" SET DEFAULT 'inactive';
