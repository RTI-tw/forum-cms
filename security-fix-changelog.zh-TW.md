# Security Fix Changelog

- Commit base：`f7aab21`
- 修正日期：2026-06-01
- 依據：`security-review-report.zh-TW.md` + `security-review-validation-summary.zh-TW.md`

---

## P0 — 立即修正

### AUTH-001｜移除 CMS 與會員 session 簽章金鑰的硬編碼 fallback

| 項目 | 內容 |
|---|---|
| 嚴重度 | 高 |
| 受影響檔案 | `packages/forum-cms/environment-variables.ts`<br>`packages/forum-cms/utils/member-session.ts` |

**變更內容**

`environment-variables.ts`
- 移除 `SESSION_SECRET` 的硬編碼 fallback 字串（原：`'default_session_secret_and_...'`）
- 移除 `MEMBER_SESSION_SECRET` 的 `|| ''` fallback
- 新增 `assertRequiredSecrets()` IIFE，模組載入時立即驗證兩個 secret 均已設定且長度 ≥ 32 字元，不足則拋錯中止服務

`member-session.ts`
- 移除 `DEFAULT_MEMBER_SESSION_SECRET` 常數及 `getSessionSecret()` 中的 `|| DEFAULT_...` fallback
- `getSessionSecret()` 直接回傳已在啟動時驗證過的 `envVar.memberSession.secret`

**注意事項**

本機開發環境請在 `.env` 設定以下兩個環境變數（各至少 32 字元的隨機字串），否則服務無法啟動：
```
SESSION_SECRET=<隨機字串，至少 32 字元>
MEMBER_SESSION_SECRET=<隨機字串，至少 32 字元>
```

---

### AC-006｜createComment 一律以 CMS User 對應 Official Member 覆寫 member

| 項目 | 內容 |
|---|---|
| 嚴重度 | 高 |
| 受影響檔案 | `packages/forum-cms/lists/comment.ts` |

**變更內容**

`resolveInput` hook（create 分支）
- 非 CMS 呼叫：移除 `hasExplicitMemberRelationInput` 判斷，一律呼叫 `getOfficialMemberIdForSessionUser(context)` 取得 Keystone CMS User 對應的 Official Member 並強制覆寫 `data.member`；若 session 無效則拋錯
- CMS 呼叫：保留原有「未明確指定才自動帶入」邏輯

部署邊界校準：若 production 已強制 GraphQL 只接受 ingress/internal service traffic，原本 public API member 冒用 attack path 已自 active findings 移出；此程式修正保留為 defense-in-depth。若未來重新讓前台會員直接呼叫 GraphQL mutation，需改以 bearer token member identity 綁定 `member`。

---

### AUTH-002｜移除密碼重設 URL（含 token）寫入 log

| 項目 | 內容 |
|---|---|
| 嚴重度 | 中 |
| 受影響檔案 | `packages/forum-cms/utils/password-reset.ts` |

**變更內容**

- 新增 `import crypto from "crypto"`
- 將 `console.log` 中的 `resetUrl` 欄位移除
- 改記 `emailHash`（SHA-256 前 12 字元 hex），提供 correlation 資訊但不外露可用 token

**後續動作（人工）**

請立即檢查歷史 application log，確認是否有仍在有效期內的 reset token 外洩；必要時對相關帳號強制重設密碼或使現有 token 失效。

---

## P1 — 高效益修正

### AC-010｜OfficialMapping mutation 限制為 admin only

| 項目 | 內容 |
|---|---|
| 嚴重度 | 高 |
| 受影響檔案 | `packages/forum-cms/lists/official-mapping.ts` |

**變更內容**

- `operation.update`、`operation.create`、`operation.delete` 從 `allowRoles(admin, editor)` 改為 `allowRoles(admin)`
- `operation.query` 維持 `allowRoles(admin, editor)`（editor 仍可查閱）

---

### SC-001｜Cloud Build Syft 安裝改用固定版本 container image

| 項目 | 內容 |
|---|---|
| 嚴重度 | 高 |
| 受影響檔案 | `cloudbuild.yaml` |

**變更內容**

- 移除 `curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s ...`（從 main branch 動態抓取並執行）
- 改用 `anchore/syft:v1.4.1` container image 直接呼叫

**後續建議**

升級 Syft 版本時，請至 https://github.com/anchore/syft/releases 確認最新 release，並以 `@sha256:<digest>` 取代 tag（immutable pin），進一步強化 supply-chain 完整性。

---

### CONFIG-001｜加入 helmet security header middleware

| 項目 | 內容 |
|---|---|
| 嚴重度 | 中 |
| 受影響檔案 | `packages/forum-cms/keystone.ts`<br>`packages/forum-cms/package.json` |

**變更內容**

`package.json`
- 新增 dependency：`"helmet": "^8.0.0"`

`keystone.ts`
- 新增 `import helmet from "helmet"`
- 在 `extendExpressApp` 最前面加入 `app.use(helmet({...}))` middleware，設定：
  - `contentSecurityPolicy`：`defaultSrc 'self'`、`frameAncestors 'none'`、`objectSrc 'none'`、`upgradeInsecureRequests`（目前 `scriptSrc` 含 `'unsafe-inline'`，待收集 nonce 後收緊）
  - `hsts`：maxAge 1 年，includeSubDomains，preload
  - `frameguard: deny`
  - `noSniff: true`
  - `referrerPolicy: strict-origin-when-cross-origin`

**後續動作（人工）**

執行 `yarn` 安裝 helmet 套件後，確認 Admin UI 功能正常；若 CSP `'unsafe-inline'` 造成問題，請收集所需 hash/nonce 後收緊設定。

---

### AUTH-005｜JWT 驗證後補充 member 狀態檢查

| 項目 | 內容 |
|---|---|
| 嚴重度 | 中 |
| 受影響檔案 | `packages/forum-cms/keystone.ts` |

**變更內容**

`currentMember` GraphQL resolver
- 在 `context.sudo().db.Member.findOne()` 取回 member 後，補上 `member.status !== 'active'` 檢查
- 狀態非 `active`（即 `inactive` 或 `banned`）時回傳 `null`，使既有 JWT 立即失效

---

## P2 — 批次修正

### AC-002 + AC-007｜Bookmark query owner 隔離 + mutation owner binding

| 項目 | 內容 |
|---|---|
| 嚴重度 | 中 |
| 受影響檔案 | `packages/forum-cms/lists/bookmark.ts` |

**變更內容**

- `filter.query`：非 CMS 呼叫加入 `member.id equals authenticatedMemberId` 條件，拒絕未登入查詢
- 新增 `filter.update` / `filter.delete`：非 CMS 只允許操作自己的書籤
- 新增 `hooks.resolveInput`：非 CMS create 強制覆寫 `member` 為已驗證會員，拒絕未登入

---

### AC-003｜PollVote query owner 隔離

| 項目 | 內容 |
|---|---|
| 嚴重度 | 中 |
| 受影響檔案 | `packages/forum-cms/lists/poll-vote.ts` |

**變更內容**

- `filter.query`：非 CMS 呼叫加入 `member.id equals authenticatedMemberId` 條件，拒絕未登入查詢

---

### AC-001｜Comment query 補充 status 過濾

| 項目 | 內容 |
|---|---|
| 嚴重度 | 中 |
| 受影響檔案 | `packages/forum-cms/lists/comment.ts` |

**變更內容**

- `filter.query`：非 CMS 呼叫以 `OR` 條件限制：
  - `status = published`（所有人可見）
  - `status = archived` 且 `member.id = authenticatedMemberId`（本人可見自己的 archived 留言）
- 有效阻止 `hidden` 與 `rejected` 留言透過 API 洩漏

---

### AC-004｜Poll / PollOption 加入 post visibility filter

| 項目 | 內容 |
|---|---|
| 嚴重度 | 中 |
| 受影響檔案 | `packages/forum-cms/lists/poll.ts`<br>`packages/forum-cms/lists/poll-option.ts` |

**變更內容**

`poll.ts`
- 新增 import：`buildPostVisibilityWhere`、`getAuthenticatedMemberId`、`isCmsRequest`
- 新增 `filter.query`：非 CMS 呼叫要求 `post` 符合 post visibility，避免草稿/隱藏 Poll 洩漏

`poll-option.ts`
- 新增同上三個 import
- 新增 `filter.query`：非 CMS 呼叫要求 `poll.post` 符合 post visibility，避免草稿選項洩漏

---

## 尚未修正的 Findings（P3+）

以下 findings 未在本次變更中處理，請依資源排程後續跟進：

| ID | 嚴重度 | 說明 |
|---|---|---|
| AC-008 | 高 | PollVote 缺少 poll 可見性/期限/唯一性驗證 |
| AC-009 | 高 | Report create/update 對外開放時可隱藏任意內容 |
| AC-005 | 中 | createPost 信任用戶端提供的 author 與 status（GQL internal-only 時已自 active findings 移出） |
| AUTH-003 | 中 | 登入 lockout 可被 username/email prefix 觸發 |
| AUTH-004 | 中 | 強制改密碼狀態僅靠 client-side redirect |
| AUTH-006 | 中 | reCAPTCHA 關閉時密碼重設無 server-side throttle |
| DEP-001 | 中 | Production dependency 含已知漏洞（需升級套件） |
| FILE-001 | 中 | keywords.json 公開洩漏審核關鍵字 |
| FILE-002 | 中 | 圖片上傳上限允許 2GB buffering |
| SC-002 | 中 | Dockerfile apt key 未 pin |
| XSS-001 | 中 | Rich-text embedded-code 在客戶端執行 stored scripts |
| AUTH-007 | 低 | 會員註冊洩漏帳號狀態 |
| XSS-002 | 低 | Rich-text link URL 缺少 scheme allowlist |
| XSS-003 | 低 | RECAPTCHA_SITE_KEY 未經 JS escape 就插入 TSX |
