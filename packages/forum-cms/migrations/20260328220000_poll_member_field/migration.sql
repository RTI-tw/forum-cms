-- AlterTable: Poll 關聯前台會員（Member）
ALTER TABLE "Poll" ADD COLUMN "member" INTEGER;

CREATE INDEX "Poll_member_idx" ON "Poll"("member");

ALTER TABLE "Poll" ADD CONSTRAINT "Poll_member_fkey" FOREIGN KEY ("member") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
