# Validation Summary — Re-Review（繁中台灣版）

原始 findings 驗證結果：**26 / 26 已修正**。

新發現 findings：**3 個**（中 1、低 2）。

2026-06-09 部署邊界校準：`AC-006` 與 `AC-005` 在 GraphQL internal-only／ingress-only 前提下不再列為 active public findings；下方保留「已修正」紀錄作為 defense-in-depth。

---

## 原始 Findings（全部已修正）

- `AUTH-001` 高 硬編碼 session/JWT secret fallback - ✅ 已修正
- `AC-006` 高 createComment 信任用戶端 member - ✅ 已修正；GQL internal-only 時移出 active findings
- `AC-009` 高 Report 可隱藏任意文章留言 - ✅ 已修正；GQL internal-only 時移出 active findings
- `AC-010` 高 Editor 自行授予 OfficialMapping 權限 - ✅ 已修正
- `AC-008` 高 PollVote 缺少驗證 - ✅ 已修正；GQL internal-only 時移出 active findings
- `SC-001` 高 Cloud Build curl\|sh 安裝 Syft - ✅ 已修正
- `AC-001` 中 Comment query 洩漏 hidden/rejected - ✅ 已修正
- `AC-002` 中 Bookmark BOLA - ✅ 已修正
- `AC-003` 中 PollVote BOLA - ✅ 已修正
- `AC-004` 中 Poll/PollOption 草稿洩漏 - ✅ 已修正
- `AC-005` 中 createPost 信任用戶端 author/status - ✅ 已修正；GQL internal-only 時移出 active findings
- `AC-007` 中 Bookmark mutation owner 缺失 - ✅ 已修正；GQL internal-only 時移出 active findings
- `AUTH-002` 中 Reset token 寫入 log - ✅ 已修正
- `AUTH-003` 中 Lockout 可被 name/prefix 觸發 - ✅ 已修正
- `AUTH-004` 中 mustChangePassword 僅 client-side - ✅ 已修正
- `AUTH-005` 中 ban 後 JWT 仍有效 - ✅ 已修正
- `AUTH-006` 中 reCAPTCHA 停用無 rate limit - ✅ 已修正
- `CONFIG-001` 中 未設定 security headers - ✅ 已修正（附帶 NEW-001）
- `DEP-001` 中 依賴套件漏洞 - ✅ 已修正（resolutions 加入）
- `FILE-001` 中 keywords.json 公開存取 - ✅ 已修正
- `FILE-002` 中 2GB 上傳 buffering - ✅ 已修正
- `SC-002` 中 Dockerfile apt key 未 pin - ✅ 已修正
- `XSS-001` 中 Rich-text embedded-code - ✅ 確認無 active usage
- `AUTH-007` 低 會員註冊帳號列舉 - ✅ 已修正
- `XSS-002` 低 Rich-text link URL - ✅ 確認無 active usage
- `XSS-003` 低 RECAPTCHA_SITE_KEY 插值 - ✅ 已修正

---

## 新發現 Findings

- `NEW-001` 中 helmet CSP 阻擋 reCAPTCHA 外部腳本（退化）- 信心程度：高
- `NEW-002` 低 mustChangePassword 攔截可被 GraphQL 命名繞過 - 信心程度：低
- `NEW-003` 低 rate limit Map 未清理過期項目 - 信心程度：高
