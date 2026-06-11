# Validation Summary — Third Review（繁中台灣版）

- Review date：`2026-06-17`
- Scan id：`main_20260617`

**新 findings：0**

2026-06-09 修正校準：GraphQL internal-only／ingress-only 是部署邊界；非 CMS write path 仍保留 bearer token member identity 綁定，CMS path 才使用 OfficialMapping。

---

## 原始 26 findings — 全部已修正 ✅

- `AUTH-001` 高 硬編碼 secret fallback - ✅
- `AC-006` 高 createComment member 冒用 - ✅
- `AC-009` 高 Report 隱藏任意內容 - ✅
- `AC-010` 高 OfficialMapping 權限提升 - ✅
- `AC-008` 高 PollVote 缺少驗證 - ✅
- `SC-001` 高 curl\|sh 安裝 Syft - ✅
- `AC-001` 中 Comment 洩漏 hidden/rejected - ✅
- `AC-002` 中 Bookmark BOLA - ✅
- `AC-003` 中 PollVote BOLA - ✅
- `AC-004` 中 Poll/PollOption 草稿洩漏 - ✅
- `AC-005` 中 createPost author/status 冒用 - ✅
- `AC-007` 中 Bookmark mutation owner 缺失 - ✅
- `AUTH-002` 中 Reset token 寫入 log - ✅
- `AUTH-003` 中 Lockout name/prefix 觸發 - ✅
- `AUTH-004` 中 mustChangePassword 僅 client-side - ✅
- `AUTH-005` 中 ban 後 JWT 仍有效 - ✅
- `AUTH-006` 中 無 rate limit - ✅
- `CONFIG-001` 中 缺少 security headers - ✅
- `DEP-001` 中 依賴套件漏洞 - ✅
- `FILE-001` 中 keywords.json 公開 - ✅
- `FILE-002` 中 2GB 上傳 buffering - ✅
- `SC-002` 中 Dockerfile apt key - ✅
- `XSS-001` 中 Rich-text embedded-code（無 active usage）- ✅
- `AUTH-007` 低 會員註冊帳號列舉 - ✅
- `XSS-002` 低 Rich-text link URL（無 active usage）- ✅
- `XSS-003` 低 RECAPTCHA_SITE_KEY 插值 - ✅

## 再審 findings — 全部已修正 ✅

- `NEW-001` 中 CSP 阻擋 reCAPTCHA - ✅
- `NEW-002` 低 mustChangePassword substring bypass - ✅
- `NEW-003` 低 rate limit Map 記憶體 - ✅

## DEP-001 regression — 已修正 ✅

- `http-proxy-middleware` Node 20 不相容 - ✅
