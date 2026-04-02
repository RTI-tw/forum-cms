-- 資料遷移：舊 is_active = false 且非停權者 → inactive（依賴上一筆 migration 已 commit 的 enum 值）
UPDATE "Member"
SET status = 'inactive'::"MemberStatusType"
WHERE "is_active" = false
  AND status IS DISTINCT FROM 'banned'::"MemberStatusType";

ALTER TABLE "Member" DROP COLUMN "is_active";

-- 移除會員社交 M2M（後台 list 已刪除欄位）
DROP TABLE "_Member_follower";
DROP TABLE "_Member_block";
DROP TABLE "_Member_following_category";
