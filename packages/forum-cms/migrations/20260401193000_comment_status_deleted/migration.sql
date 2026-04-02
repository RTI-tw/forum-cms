-- 留言狀態新增 deleted（已刪除），供 CMS 權限規則與前台顯示區分
ALTER TYPE "CommentStatusType" ADD VALUE 'deleted';
