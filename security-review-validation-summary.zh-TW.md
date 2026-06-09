# Validation Summary（繁中台灣版）

保留 findings 總數：21。

- 高：3
- 中：15
- 低：3

2026-06-09 修正校準：`AC-006`、`AC-008`、`AC-009`、`AC-005`、`AC-007` 仍以程式碼修正處理；GraphQL internal-only／ingress-only 是額外部署邊界，不取代非 CMS write path 的 bearer token member identity 綁定。

## Findings 弱點項目

- `AC-010` 高 Editor 可自行授予 OfficialMapping 審核權限 - 信心程度：高
- `AUTH-001` 高 CMS 與會員 session 簽章金鑰存在硬編碼 fallback - 信心程度：高
- `SC-001` 高 Cloud Build 執行未 pin 版本的遠端 Syft installer - 信心程度：高
- `AC-001` 中 公開 comment query 可能洩漏 hidden 或 rejected 留言 - 信心程度：高
- `AC-002` 中 Bookmark query 的 BOLA 會洩漏其他會員書籤 - 信心程度：高
- `AC-003` 中 PollVote query 的 BOLA 會洩漏其他會員投票 - 信心程度：高
- `AC-004` 中 直接查詢 Poll 與 PollOption 可能洩漏草稿或隱藏投票資料 - 信心程度：高
- `AUTH-002` 中 密碼重設 URL（含 reset token）被寫入 log - 信心程度：高
- `AUTH-003` 中 登入 lockout 可被 username 或 email prefix 觸發 - 信心程度：高
- `AUTH-004` 中 強制改密碼狀態主要靠 client-side redirect 執行 - 信心程度：高
- `AUTH-005` 中 會員被 ban 或 delete 後，既有 JWT 到期前仍會被接受 - 信心程度：高
- `AUTH-006` 中 reCAPTCHA 關閉時，密碼重設沒有 server-side throttle - 信心程度：高
- `CONFIG-001` 中 未明確設定 CSP、HSTS 或 clickjacking 防護 header - 信心程度：高
- `DEP-001` 中 Production dependency tree 含 critical prototype-pollution、RCE、XXE 與 DoS advisories - 信心程度：高
- `FILE-001` 中 公開 keywords.json 洩漏受限制的審核關鍵字資料 - 信心程度：高
- `FILE-002` 中 圖片上傳上限允許驗證前的大量記憶體 buffering - 信心程度：中
- `SC-002` 中 Dockerfile 在 root package install 前匯入未 pin 的 apt trust key - 信心程度：高
- `XSS-001` 中 Rich-text embedded-code block 會在套件使用者端執行 stored scripts - 信心程度：中
- `AUTH-007` 低 會員註冊會揭露 email、customId 與 blocked account 狀態 - 信心程度：高
- `XSS-002` 低 Rich-text link URL 缺少 scheme allowlist - 信心程度：中
- `XSS-003` 低 RECAPTCHA_SITE_KEY 未經 JS escape 就插入 generated Admin UI TSX - 信心程度：高

## 已修正且需維持部署邊界

- `AC-006` createComment：非 CMS path 以 bearer token member 綁定；CMS path 才使用 OfficialMapping
- `AC-008` PollVote：非 CMS path 保留 poll/option/唯一性驗證與 member 綁定
- `AC-009` Report：write path 保留 CMS-only block
- `AC-005` createPost：非 CMS path 以 bearer token author 綁定並固定 pending
- `AC-007` Bookmark：非 CMS create/update/delete 保留 owner hard gate
