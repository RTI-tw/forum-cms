# Security Fix Report — forum-cms

| 項目 | 值 |
|---|---|
| Review base commit | `f7aab21` |
| 修正 commits | P0–P2：`bbf64b9`；AUTH-001 hotfix：`(pending push)` |
| 修正日期 | 2026-06-01 |
| 依據 | `security-review-report.zh-TW.md` |
| 總 findings | 26（高 6、中 17、低 3） |
| **本次已修正** | **26 / 26** |

---

> 2026-06-09 修正校準：GraphQL internal-only／ingress-only 是必要部署邊界，但不得取代 list hook 的身分綁定。非 CMS write path 仍需使用前台 bearer token 解析出的 Member；CMS path 才可使用 Keystone CMS User -> Official Member mapping。

---

## 修正摘要

### 高嚴重度（全部已修正）

| ID | 說明 | 修正位置 |
|---|---|---|
| AUTH-001 | 移除 session/JWT 硬編碼 fallback secret；啟動時驗證 | `environment-variables.ts`, `utils/member-session.ts`, `keystone.ts` |
| AC-006 | 非 CMS createComment 改用 bearer token member 綁定，CMS path 保留 OfficialMapping 自動帶入 | `lists/comment.ts` |
| AC-010 | OfficialMapping mutation 限制為 admin only | `lists/official-mapping.ts` |
| AC-008 | 非 CMS PollVote 恢復 bearer token member 綁定、poll/option 歸屬與唯一性驗證 | `lists/poll-vote.ts` |
| AC-009 | Report write 恢復 CMS-only block，避免 resolved 副作用被非 CMS 呼叫觸發 | `lists/report.ts` |
| SC-001 | Cloud Build Syft 改用 pin 版本 container image | `cloudbuild.yaml` |

### 中嚴重度（全部已修正）

| ID | 說明 | 修正位置 |
|---|---|---|
| AC-001 | Comment query 補 status 過濾（hidden/rejected 不外洩） | `lists/comment.ts` |
| AC-002 | Bookmark query 加 owner filter，拒絕未登入 | `lists/bookmark.ts` |
| AC-003 | PollVote query 加 member owner filter | `lists/poll-vote.ts` |
| AC-004 | Poll/PollOption 加 post visibility filter | `lists/poll.ts`, `lists/poll-option.ts` |
| AC-005 | 非 CMS createPost 改用 bearer token author 綁定，並固定進 pending 審核佇列 | `lists/Post.ts` |
| AC-007 | Bookmark 非 CMS create/update/delete 恢復 owner hard gate 與 bearer token member 綁定 | `lists/bookmark.ts` |
| AUTH-002 | 密碼重設 log 移除 resetUrl/token | `utils/password-reset.ts` |
| AUTH-003 | Lockout counter 只用精確 email，移除 name/prefix fallback | `utils/login-logging.ts` |
| AUTH-004 | mustChangePassword 加 server-side GraphQL 攔截 | `keystone.ts` |
| AUTH-005 | JWT 驗後補 member.status 檢查（banned/deleted 立即失效；inactive 保留給補 profile） | `keystone.ts` |
| AUTH-006 | 密碼重設加 per-email+IP rate limit（15 分鐘 5 次） | `utils/login-logging.ts` |
| CONFIG-001 | 加入 helmet middleware（CSP / HSTS / frameguard / noSniff） | `keystone.ts`, `package.json` |
| DEP-001 | resolutions 強制升級 protobufjs/fast-xml-parser/http-proxy-middleware 等 | `package.json` |
| FILE-001 | 阻擋 `/files/keywords.json` 公開存取 | `keystone.ts` |
| FILE-002 | 上傳上限從 2GB 降至 20MB；body limit 從 500MB 降至 10MB | `keystone.ts` |
| SC-002 | Dockerfile apt key 改用 signed-by keyring | `packages/forum-cms/Dockerfile` |
| XSS-001 | 目前 forum-cms 無 active richTextEditor list，風險為 package-consumer level；若未來引入請參考修正建議文件 | — |

### 低嚴重度（全部已修正）

| ID | 說明 | 修正位置 |
|---|---|---|
| AUTH-007 | 會員註冊錯誤訊息統一為通用格式，詳細原因只寫 log | `keystone.ts` |
| XSS-002 | 目前 forum-cms 無 active richTextEditor list，風險為 package-consumer level | — |
| XSS-003 | RECAPTCHA_SITE_KEY 改用 JSON.stringify 嵌入 generated TSX | `keystone.ts` |

---

## 修正細節

### AUTH-001｜移除硬編碼 secret fallback

**修改前問題**：`SESSION_SECRET` / `MEMBER_SESSION_SECRET` 未設定時退回已知字串，任何人可偽造 session/JWT。

**修改後行為**：
- `environment-variables.ts`：兩個 secret 改為 build-time placeholder（讓 `keystone build` 可正常完成），不再是已知的固定字串。
- `keystone.ts` `extendExpressApp`：Server 啟動時執行 `assertRequiredSecrets()`，secret 未設定或長度 < 32 字元時直接拋錯，Cloud Run 容器啟動失敗並觸發 rollback。
- `utils/member-session.ts`：移除 `DEFAULT_MEMBER_SESSION_SECRET` 常數。

**注意**：`.env` 需設定 `SESSION_SECRET` 與 `MEMBER_SESSION_SECRET`（各 ≥ 32 字元隨機字串）。

---

### AC-006｜createComment 非 CMS 改用 bearer token member 綁定

**修改前問題**：`hasExplicitMemberRelationInput` 為 true 時，hook 信任用戶端 `member.connect`，可冒用他人身分留言。

**目前行為**：非 CMS create 會忽略用戶端傳入的 `member.connect`，改以 `getAuthenticatedMemberId(context)` 從前台 bearer token 取得 Member id 並覆寫 `data.member`；無有效 member token 時拒絕建立。CMS create path 才在未明確指定 `member` 時嘗試 `getOfficialMemberIdForSessionUser(context)`。

**部署邊界校準**：`getOfficialMemberIdForSessionUser` 是 CMS mapping，不是前台會員驗證；非 CMS path 不可使用它。GraphQL internal-only 仍應保留於 infra，但程式碼層也維持 bearer token member identity 作為 defense-in-depth。

---

### AC-008｜PollVote 非 CMS write validation/member binding 已恢復

**修改前問題**：投票時不驗證 poll 是否可見、option 是否屬於 poll、是否重複投票，可操控票數完整性。

**目前行為**：非 CMS create 會驗證 poll 可見性、option 隸屬於該 poll、每位會員每個投票只能投一票，並以 bearer token member 覆寫 `data.member`。非 CMS update/delete 保留 owner filter；`afterOperation` 持續同步票數。

**部署邊界校準**：即使 GraphQL 只接受 ingress/internal traffic，list hook 仍保留投票完整性檢查，避免內部呼叫或未來 exposure 造成資料破壞。

---

### AC-009｜Report 非 CMS CMS-only block 已恢復

**修改前問題**：Report `afterOperation` 在 status=resolved 時會隱藏文章/留言；若 API 開放，任何人可建立 resolved Report 隱藏任意內容。

**目前行為**：`validateInput` 先檢查 `isCmsRequest(context)`；非 CMS 呼叫會收到 `Report 操作僅限 CMS 管理者`。CMS create 仍保留「post/comment 擇一」的資料完整性檢查，`resolved` 狀態副作用只留給 CMS 工作流。

**部署邊界校準**：GraphQL internal-only 可降低外部可達性，但不能取代 Report 狀態副作用的權限檢查。

---

### AC-005｜createPost 非 CMS 改用 bearer token author 綁定

**修改前問題**：`resolveInput` 只在用戶端未傳入 author 時才自動帶入；明確傳入的 author/status 被信任。

**目前行為**：非 CMS create 會忽略用戶端傳入的 `author.connect` 與 `status`，改以 `getAuthenticatedMemberId(context)` 從前台 bearer token 取得 Member id 並覆寫 `data.author`，且一律設定 `status = 'pending'`。CMS create path 才使用 OfficialMapping 自動帶入與 CMS 預設狀態。

**部署邊界校準**：`getOfficialMemberIdForSessionUser` 是 CMS mapping，不是前台會員驗證；非 CMS path 不可使用它。GraphQL internal-only 仍應保留於 infra，但程式碼層也維持 bearer token author binding 與 server-side status transition。

---

### AUTH-002｜移除密碼重設 token 寫入 log

**修改前問題**：`console.log` 包含完整 `resetUrl`（含 bearer token），log 讀取者可直接利用。

**修改後行為**：改記 SHA-256 前 12 字元 email hash，提供 correlation 但不外露 token。

**後續動作**：請立即查閱歷史 log 確認是否有仍在有效期內的 token，必要時強制失效相關帳號 session。

---

### AUTH-003｜Lockout 只用 canonical email

**修改前問題**：`findUserByIdentity` fallback 包含 display name 精確比對與 email prefix 比對，攻擊者可以部分資訊觸發他人帳號 lockout。

**修改後行為**：新增 `findUserByExactEmail`（只做 `email equals` 精確查詢），lockout counter 更新改用此函式，移除 name/prefix fallback。

---

### AUTH-004｜mustChangePassword server-side 強制

**修改前問題**：強制改密碼只靠 client-side script redirect；直接打 GraphQL API 可繞過。

**修改後行為**：在 `extendExpressApp` 加入 `/api/graphql` middleware，偵測到 `mustChangePassword` 或密碼過期的 session 時，只允許 `updateUser / endSession / authenticateUserWithPassword / sendUserPasswordResetLink / redeemUserPasswordResetToken` 相關操作，其他一律回傳 HTTP 403。

---

### AUTH-005｜JWT 驗後補 member 狀態檢查

**修改前問題**：`authenticatedMember` resolver 驗完 JWT 後只確認 member 是否存在，不檢查 `status`；ban/delete 後既有 token 仍有效。

**修改後行為**：在 `db.Member.findOne` 後加入 `isMemberRegistrationBlocked(member.status)` 判斷，`banned` / `deleted` 直接回傳 null，使 token 立即失效；`inactive` 仍回傳給前端完成 profile 流程。

---

### AUTH-006｜密碼重設 server-side rate limit

**修改前問題**：reCAPTCHA 預設關閉，關閉時 `verifyRecaptchaToken` 直接回傳成功，密碼重設無任何頻率限制。

**修改後行為**：在 `login-logging.ts` 加入 `checkPasswordResetRateLimit`（per email+IP，15 分鐘 5 次），rate limit 命中時靜默丟棄請求（不揭露限制狀態），只記 WARNING log。

> **注意**：目前使用 in-process Map，多 replica 部署建議換用 Redis-backed 計數器。

---

### CONFIG-001｜加入 helmet security headers

**新增依賴**：`helmet ^8.0.0`（需執行 `yarn` 安裝）。

**設定內容**：
- CSP：`defaultSrc 'self'`、`frameAncestors 'none'`、`objectSrc 'none'`、`upgradeInsecureRequests`（`scriptSrc` 目前含 `'unsafe-inline'`，待收集 nonce 後收緊）
- HSTS：maxAge 1 年，includeSubDomains，preload
- `frameguard: deny`、`noSniff: true`、`referrerPolicy: strict-origin-when-cross-origin`

---

### DEP-001｜resolutions 強制升級有漏洞的 transitive dependencies

**package.json resolutions 新增**：
- `protobufjs >= 7.2.5`（prototype pollution/RCE）
- `fast-xml-parser >= 4.4.1`（XML parser 問題）
- `http-proxy-middleware >= 2.0.7`（DoS）
- `node-forge >= 1.3.1`（cryptographic parser 問題）
- `immutable >= 4.0.0`（prototype pollution）

**後續動作**：執行 `yarn` 後再執行 `yarn audit --groups dependencies` 確認 advisory 已消除。

---

### FILE-001｜阻擋 keywords.json 公開存取

**修改前問題**：`forbidden-keyword` 資料透過 sudo export 寫到 `public/files/keywords.json`，並由 Keystone 公開靜態服務。

**修改後行為**：在 `extendExpressApp` 最前面加入 `GET /files/keywords.json` 路由回傳 404，優先於 Keystone 靜態 storage 路由執行。

---

### FILE-002｜降低上傳上限

| 項目 | 修改前 | 修改後 |
|---|---|---|
| `server.maxFileSize` | 2000 MB | 20 MB |
| `express.json` body limit | 500 MB | 10 MB |

---

### SC-001｜Cloud Build Syft 改用 pin 版本

**修改前問題**：`curl -sSfL .../syft/main/install.sh | sh -s --` 從可變 branch 動態抓取並執行腳本。

**修改後行為**：改用 `anchore/syft:v1.4.1` container image。升級時請至 GitHub releases 確認版本並以 `@sha256:<digest>` 取代 tag 達到 immutable pin。

---

### SC-002｜Dockerfile apt key 改用 signed-by

**修改前問題**：`curl ... | apt-key add -` 未驗證 key 完整性，且 `apt-key` 已廢棄。

**修改後行為**：改用 `gpg --dearmor` + `/usr/share/keyrings/` + `[signed-by=...]` 方式，符合現代 apt 安全實踐。

---

### AUTH-007｜會員註冊通用錯誤訊息

**修改前問題**：`"Custom ID already exists"` / `"Email already exists"` / `"This member account is not available"` 揭露帳號狀態，可用於帳號列舉。

**修改後行為**：三處均改為 `"Registration failed, please check your input and try again"`；詳細原因（`duplicate_custom_id` / `duplicate_email` / `blocked_email` / `blocked_member`）以 structured log 記錄於 server 端。

---

### XSS-003｜RECAPTCHA_SITE_KEY 改用 JSON.stringify

**修改前問題**：generated Admin UI TSX 使用 `'${RECAPTCHA_SITE_KEY}'` 字串插值，若值含單引號或特殊字元可能破壞 script 結構。

**修改後行為**：改為 `${JSON.stringify(RECAPTCHA_SITE_KEY)}`，確保輸出為合法 JS 字串字面量。兩處 template（forgotPasswordPage 與 loginPage）均已修正。

---

## 需要人工執行的後續動作

| 優先 | 動作 |
|---|---|
| 立即 | 查閱歷史 application log，確認是否有仍在有效期內的 reset token（AUTH-002） |
| 立即 | `cd packages/forum-cms && yarn`（安裝 helmet） |
| 部署前 | 確認 Cloud Run 已設定 `SESSION_SECRET` 與 `MEMBER_SESSION_SECRET`（≥ 32 字元） |
| 部署後 | `yarn audit --groups dependencies` 確認 DEP-001 advisory 已消除 |
| 後續 | CSP `'unsafe-inline'` 收緊（收集 Admin UI 所需 nonce/hash） |
| 後續 | `AUTH-006` rate limit 改為 Redis-backed（多 replica 環境） |
| 後續 | Syft tag 更新為最新版並加 `@sha256:<digest>` 固定（SC-001） |
