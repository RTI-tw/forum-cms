# Prisma migrations（forum-cms）

## 套用方式

在 `packages/forum-cms` 目錄：

```bash
yarn db-migrate
```

（等同 `keystone prisma migrate deploy`，需設定 `DATABASE_URL`。）

## 現有 migration 摘要

| 目錄 | 說明 |
|------|------|
| `20251120064536_init` | 初始 schema |
| `20260225074406_align_schema_with_spec` | 對齊 spec |
| `20260326120000_add_spam_score_post_comment` | `Post`、`Comment` 新增可為 null 的 `spamScore`（`DOUBLE PRECISION`） |
| `20260327200000_add_post_title_translations` | `Post` 新增 `title_zh` / `title_en` / `title_vi` / `title_id` / `title_th`（與 commit 多語標題欄位對齊） |
| `20260408000000_post_is_boost` | `Post` 新增 `isBoost`（置頂／boost 旗標，`BOOLEAN NOT NULL DEFAULT false`） |

## 為何「自動翻譯 hook」沒有對應 migration？

在 `Topic`、`Poll`、`PollOption`、`Content`（`static-content`）等 list 上新增的 **`afterOperation` 翻譯 hook** 只會呼叫 HTTP，**沒有新增或修改 Prisma 欄位**，因此**不需要**、也不會產生新的 migration。

若之後在 lists 裡**新增或修改欄位**，請在改完 `lists/*.ts` 後：

1. 讓 Keystone 重新產生 `schema.prisma`（例如 `keystone build` / 專案慣用的 postinstall），再  
2. 使用本機資料庫執行 `keystone prisma migrate dev --name <名稱>` 產生新 migration，  
   或手寫 `migration.sql` 並與 `schema.prisma` 保持一致。
