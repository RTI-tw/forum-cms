-- AlterEnum：新增 inactive（須單獨一個 migration，PostgreSQL 要求 commit 後才能在下一筆交易使用新 enum 值）
ALTER TYPE "MemberStatusType" ADD VALUE 'inactive';
